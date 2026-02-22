/**
 * Browser Notification Helpers
 * 
 * Manages browser Notification API permissions and display.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function showNotification(title: string, body: string, options?: NotificationOptions) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Check if page is visible - if not, show notification
  if (document.visibilityState === 'visible') {
    // Page is visible, maybe show an in-app toast instead
    return;
  }

  new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'proactive-reminder',
    ...options,
  });
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
