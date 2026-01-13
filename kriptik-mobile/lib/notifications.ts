/**
 * KripTik Mobile Push Notifications
 *
 * Handles push notification setup and registration
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  type: 'build_complete' | 'build_failed' | 'build_progress' | 'feature_agent_complete';
  buildId?: string;
  projectId?: string;
  message?: string;
}

/**
 * Registers for push notifications and returns the token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Check if running on a real device
  if (!Device.isDevice) {
    console.log('[Notifications] Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return null;
  }

  // Get the push token
  try {
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;

    // Register the token with the backend
    const platform = Platform.OS as 'ios' | 'android';
    await api.registerPushToken(token, platform);

    return token;
  } catch (error) {
    console.error('[Notifications] Failed to get push token:', error);
    return null;
  }
}

/**
 * Adds a listener for notification received while app is foregrounded
 */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Adds a listener for notification response (user tapped notification)
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Parses notification data from a notification response
 */
export function parseNotificationData(
  response: Notifications.NotificationResponse
): NotificationData | null {
  const data = response.notification.request.content.data as Record<string, unknown>;

  if (!data || typeof data.type !== 'string') {
    return null;
  }

  return {
    type: data.type as NotificationData['type'],
    buildId: data.buildId as string | undefined,
    projectId: data.projectId as string | undefined,
    message: data.message as string | undefined,
  };
}

/**
 * Sets the badge count on iOS
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'ios') {
    await Notifications.setBadgeCountAsync(count);
  }
}

/**
 * Clears all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await setBadgeCount(0);
}

/**
 * Schedules a local notification (useful for testing)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData,
  seconds = 1
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as unknown as Record<string, unknown>,
      sound: true,
    },
    trigger: { seconds },
  });
}
