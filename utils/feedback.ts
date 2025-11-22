
/**
 * Triggers a gentle haptic feedback vibration if the browser supports it.
 * This is used for button presses and other key interactions.
 */
export const triggerHapticFeedback = () => {
  if (window.navigator && 'vibrate' in window.navigator) {
    try {
      window.navigator.vibrate(50); // A short, gentle vibration.
    } catch (e) {
      // Catch potential errors, e.g., if called too frequently.
      console.warn("Haptic feedback failed:", e);
    }
  }
};

/**
 * Triggers a more insistent haptic feedback for urgent warnings.
 */
export const triggerUrgentHapticFeedback = () => {
  if (window.navigator && 'vibrate' in window.navigator) {
    try {
      // A pattern of vibrations for urgent alerts.
      window.navigator.vibrate([200, 100, 200]);
    } catch (e) {
      console.warn("Urgent haptic feedback failed:", e);
    }
  }
};
