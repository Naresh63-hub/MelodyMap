import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

let lastHapticTime = 0;
const HAPTIC_RATE_LIMIT = 100; // ms between haptics

/**
 * Trigger haptic feedback with cross-platform support
 * Uses Capacitor Haptics on mobile, navigator.vibrate() on web as fallback
 */
export async function triggerHaptic(type: HapticType): Promise<void> {
  const now = Date.now();
  
  // Rate limit haptics to prevent spam
  if (now - lastHapticTime < HAPTIC_RATE_LIMIT) {
    return;
  }
  lastHapticTime = now;

  try {
    // Try Capacitor Haptics first (native mobile)
    await triggerCapacitorHaptic(type);
  } catch (error) {
    // Fallback to Web Vibration API
    triggerWebHaptic(type);
  }
}

async function triggerCapacitorHaptic(type: HapticType): Promise<void> {
  if (type === 'selection') {
    await Haptics.selectionChanged();
    return;
  }
  const style = getImpactStyle(type);

  if (style) {
    await Haptics.impact({ style });
  } else {
    // For custom patterns (success, warning, error), use notification
    await Haptics.notification({
      type: getNotificationType(type),
    });
  }
}

function triggerWebHaptic(type: HapticType): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  const pattern = getVibrationPattern(type);
  if (pattern) {
    navigator.vibrate(pattern);
  }
}

function getImpactStyle(type: HapticType): ImpactStyle | null {
  switch (type) {
    case 'light':
      return ImpactStyle.Light;
    case 'medium':
      return ImpactStyle.Medium;
    case 'heavy':
      return ImpactStyle.Heavy;
    default:
      return null;
  }
}

function getNotificationType(type: HapticType): NotificationType {
  switch (type) {
    case 'warning':
      return NotificationType.Warning;
    case 'error':
      return NotificationType.Error;
    default:
      return NotificationType.Success;
  }
}

function getVibrationPattern(type: HapticType): number | number[] | null {
  switch (type) {
    case 'light':
      return 10;
    case 'medium':
      return 25;
    case 'heavy':
      return 50;
    case 'selection':
      return 5;
    case 'success':
      return [50, 50, 50];
    case 'warning':
      return [30, 100, 30];
    case 'error':
      return [50, 50, 50, 50, 50];
    default:
      return null;
  }
}
