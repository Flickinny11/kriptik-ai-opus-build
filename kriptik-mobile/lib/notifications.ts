/**
 * Push Notifications Setup for KripTik Mobile
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useNotificationStore } from '../store/notification-store';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function setupNotifications() {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.log('EAS project ID not configured');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return tokenData.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

export function setupNotificationListeners() {
  // Handle notification received while app is foregrounded
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const { title, body, data } = notification.request.content;

      // Add to notification store
      useNotificationStore.getState().addNotification({
        id: notification.request.identifier,
        type: (data?.type as 'build' | 'agent' | 'training' | 'system' | 'chat') || 'system',
        title: title || 'Notification',
        body: body || '',
        data: data as Record<string, unknown>,
        read: false,
        createdAt: new Date().toISOString(),
      });

      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  );

  // Handle notification tap
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const { data } = response.notification.request.content;

      // Navigate based on notification type
      handleNotificationNavigation(data as Record<string, unknown>);

      // Mark as read
      useNotificationStore.getState().markAsRead(
        response.notification.request.identifier
      );

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  );

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

function handleNotificationNavigation(data?: Record<string, unknown>) {
  if (!data) {
    router.push('/(tabs)');
    return;
  }

  const { type, id, projectId, buildId, agentId, trainingId } = data;

  switch (type) {
    case 'build':
      if (buildId) {
        router.push(`/build/${buildId}`);
      } else {
        router.push('/(tabs)/builds');
      }
      break;

    case 'agent':
      if (agentId) {
        router.push(`/feature-agent/${agentId}`);
      } else {
        router.push('/(tabs)/agents');
      }
      break;

    case 'training':
      if (trainingId) {
        router.push(`/ai-lab/training/${trainingId}`);
      } else {
        router.push('/(tabs)/ai-lab');
      }
      break;

    case 'project':
      if (projectId) {
        router.push(`/project/${projectId}`);
      } else {
        router.push('/(tabs)');
      }
      break;

    case 'chat':
      router.push('/(tabs)');
      break;

    default:
      router.push('/(tabs)');
  }
}

// Schedule local notification (for testing or local alerts)
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  trigger?: Notifications.NotificationTriggerInput
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: trigger || null,
  });
}

// Cancel all scheduled notifications
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Set badge count
export async function setBadgeCount(count: number) {
  if (Platform.OS === 'ios') {
    await Notifications.setBadgeCountAsync(count);
  }
}

// Clear badge
export async function clearBadge() {
  if (Platform.OS === 'ios') {
    await Notifications.setBadgeCountAsync(0);
  }
}
