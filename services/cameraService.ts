import { CameraResult } from '../types';

/**
 * Intelligently selects and requests the best available camera stream.
 * Prioritizes rear-facing cameras if available, otherwise falls back to any video input.
 * @returns A promise that resolves with a CameraResult object.
 */
export const getCameraStream = async (): Promise<CameraResult> => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { stream: null, error: "Camera access is not supported by this browser." };
  }

  // First, try to get the ideal camera (rear-facing)
  const idealConstraints: MediaStreamConstraints = {
    video: {
      facingMode: { ideal: 'environment' }
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(idealConstraints);
    return { stream, error: null };
  } catch (err) {
    console.warn("Could not get rear-facing camera, trying fallback...", err);
    // If the ideal camera fails (e.g., on a laptop), try any camera
    try {
      const fallbackConstraints: MediaStreamConstraints = { video: true };
      const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      return { stream, error: null };
    } catch (fallbackErr) {
      // Handle errors from the fallback attempt
      let errorMessage = "An unknown error occurred while accessing the camera.";
      if (fallbackErr instanceof DOMException) {
        switch (fallbackErr.name) {
          case 'NotAllowedError':
            errorMessage = "Camera access was denied. Please grant permission in your browser settings.";
            break;
          case 'NotFoundError':
          case 'OverconstrainedError':
            errorMessage = "No camera was found on this device.";
            break;
          case 'NotReadableError':
            errorMessage = "The camera is currently in use by another application.";
            break;
          default:
            errorMessage = `Could not access camera. Error: ${fallbackErr.message}`;
        }
      }
      console.error("Error getting camera stream on fallback:", fallbackErr);
      return { stream: null, error: errorMessage };
    }
  }
};