
import { GoogleGenAI, Type } from "@google/genai";
import { NavigationAnalysis } from "../types";

// Ensure API_KEY is available in the environment
const apiKey = process.env.API_KEY;
if (!apiKey) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Creates a user-friendly error message from a Gemini API error object.
 * @param error The error object caught from the API call.
 * @param context A string describing the action that failed (e.g., "analyze the scene").
 * @returns A specific, user-facing error message.
 */
const getGeminiErrorUserMessage = (error: unknown, context: string): string => {
    console.error(`Error in ${context}:`, error);

    if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message).toLowerCase();
        if (message.includes('rate limit') || message.includes('resource exhausted')) {
            return "The service is currently busy. Please wait a moment before trying again.";
        }
        if (message.includes('api key not valid')) {
            return "There is an API key configuration error.";
        }
        if (message.includes('model') && message.includes('not found')) {
            return "The AI model is currently unavailable. This may be a temporary issue.";
        }
        if (message.includes('billing')) {
            return "There is a billing issue with the AI service account.";
        }
        if (message.includes('deadline exceeded') || message.includes('timeout')) {
            return "The request to the AI service timed out. Please check your internet connection.";
        }
        // Check for content safety blocking
        if (message.includes('blocked') && (message.includes('safety') || message.includes('policy'))) {
             return "The request was blocked for safety reasons.";
        }
    }
    // Generic fallback
    return `Failed to ${context}. The AI service may be unavailable or experiencing issues.`;
};


/**
 * Converts a File or Blob object to a base64 encoded string.
 * @param file The file or blob to convert.
 * @returns A promise that resolves with the base64 string.
 */
const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/png;base64,")
            resolve(result.split(',')[1]);
        };
        reader.onerror = (error) => reject(error);
    });
};

/**
 * Sends an image to Gemini for navigation analysis and returns structured instructions.
 * @param file The image blob to analyze.
 * @returns A promise that resolves with the navigation analysis.
 */
export const analyzeNavigationFrame = async (file: Blob): Promise<NavigationAnalysis> => {
    try {
        const base64Image = await fileToBase64(file);
        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: file.type,
            },
        };

        const prompt = `
        **ROLE & GOAL:** You are an AI navigation assistant for a visually impaired user. Your goal is to analyze the video frame and provide a SINGLE, SHORT, DIRECT movement instruction to help the user navigate safely.

        **RULES:**
        1.  **Keep responses short (1–2 sentences maximum).**
        2.  **Only give movement instructions.** Do not describe the scene aesthetically.
        3.  **Use simple words:** left, right, stop, wait, forward.
        4.  **Identify obstacles:** person, vehicle, object, wall, pole, stairs.
        5.  **Safety First:**
            *   If it’s dangerous or an immediate collision risk → say “Stop”
            *   If path is blocked → say “Wait until clear.”
            *   If path is clear → say “Move forward.”

        **OUTPUT EXAMPLES:**
        *   “Person ahead. Move slightly left.”
        *   “Car in front. Wait until it passes.”
        *   “Right side blocked. Move left.”
        *   “Path clear. Move forward.”
        *   “Bike approaching from right. Stop”

        Return a JSON object with the instruction, a list of obstacles seen, and an urgency level.`;

        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        instruction: { 
                            type: Type.STRING,
                            description: "Short movement instruction (1-2 sentences)." 
                        },
                        obstacles: { 
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of identified obstacles."
                        },
                        urgency: { 
                            type: Type.STRING, 
                            enum: ["high", "medium", "low"],
                            description: "Urgency level of the situation."
                        },
                    },
                    required: ['instruction', 'obstacles', 'urgency'],
                },
            }
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as NavigationAnalysis;
    } catch (error) {
        const userMessage = getGeminiErrorUserMessage(error, "analyze the scene");
        throw new Error(userMessage);
    }
};


/**
 * Sends an image to Gemini to perform OCR.
 * @param file The image blob containing text.
 * @returns A promise that resolves with the extracted text.
 */
export const readTextFromImage = async (file: Blob): Promise<string> => {
    try {
        const base64Image = await fileToBase64(file);
        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: file.type,
            },
        };

        const prompt = `
        **ROLE & GOAL:**
        You are a specialized, high-precision Optical Character Recognition (OCR) service. Your single purpose is to extract all readable text from the provided image with the highest possible accuracy, ignoring all non-text elements.

        **CONTEXT:**
        The image is a single frame from a live camera feed. The user may be in motion, so the image could be blurry, at an angle, poorly lit, or partially obscured. Be robust to these conditions.

        **CRITICAL RULES:**
        1.  **FOCUS ON TEXT ONLY:** Transcribe only alphanumeric characters (A-Z, a-z, 0-9) and standard punctuation (e.g., .,?!'-_\"@#$%&).
        2.  **AGGRESSIVELY IGNORE NON-TEXT:** You must completely disregard logos, icons, illustrations, photos, and any other graphical elements. For example, if you see the text "EXIT" next to a running man icon, your output must be ONLY "EXIT".
        3.  **PRESERVE FORMATTING:** Maintain the original line breaks, spacing, and paragraph structure. This is critical for context and readability.
        4.  **NO TEXT SCENARIO:** If there is absolutely no readable text in the image, your response MUST be the exact phrase \`No text detected.\` and nothing else.
        5.  **NO INTERPRETATION:** Do not add any commentary, explanations, or summaries. Your output must be a direct and literal transcription of the text found in the image.

        Analyze the provided image according to these rules and return only the extracted text.`;
        
        const textPart = { text: prompt };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
        });

        return response.text.trim();
    } catch (error) {
        const userMessage = getGeminiErrorUserMessage(error, "read text from the image");
        return userMessage;
    }
};
