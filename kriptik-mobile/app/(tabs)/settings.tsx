/**
 * Settings Screen
 *
 * User account and app settings
 */

import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import * as Notifications from 'expo-notifications';

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 32 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: '#A8A29E',
          marginBottom: 12,
          paddingHorizontal: 20,
          fontFamily: 'DM Sans Medium',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: '#1C1917',
          marginHorizontal: 20,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  isLast = false,
  rightElement,
  destructive = false,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}) {
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: '#292524',
      }}
    >
      <Text
        style={{
          fontSize: 15,
          color: destructive ? '#EF4444' : '#FFFFFF',
          fontFamily: 'DM Sans',
        }}
      >
        {label}
      </Text>
      {rightElement || (
        value && (
          <Text
            style={{
              fontSize: 15,
              color: '#57534E',
              fontFamily: 'DM Sans',
            }}
          >
            {value}
          </Text>
        )
      )}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }

  return content;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [buildUpdates, setBuildUpdates] = useState(true);

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in your device settings to receive build updates.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
    }
    setNotificationsEnabled(value);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your projects and data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement account deletion API
            Alert.alert('Coming Soon', 'Account deletion will be available soon.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0C0A09' }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: '#FFFFFF',
            fontFamily: 'Outfit Bold',
          }}
        >
          Settings
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Account Section */}
        <SettingsSection title="Account">
          <SettingsRow
            label="Name"
            value={user?.name || 'Not set'}
            onPress={() => {
              // TODO: Navigate to edit profile
            }}
          />
          <SettingsRow label="Email" value={user?.email || 'Not set'} isLast />
        </SettingsSection>

        {/* Notifications Section */}
        <SettingsSection title="Notifications">
          <SettingsRow
            label="Push Notifications"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: '#292524', true: '#F59E0B40' }}
                thumbColor={notificationsEnabled ? '#F59E0B' : '#57534E'}
              />
            }
          />
          <SettingsRow
            label="Build Updates"
            rightElement={
              <Switch
                value={buildUpdates}
                onValueChange={setBuildUpdates}
                disabled={!notificationsEnabled}
                trackColor={{ false: '#292524', true: '#F59E0B40' }}
                thumbColor={buildUpdates && notificationsEnabled ? '#F59E0B' : '#57534E'}
              />
            }
            isLast
          />
        </SettingsSection>

        {/* About Section */}
        <SettingsSection title="About">
          <SettingsRow
            label="Version"
            value="1.0.0"
          />
          <SettingsRow
            label="Terms of Service"
            onPress={() => Linking.openURL('https://kriptik.ai/terms')}
          />
          <SettingsRow
            label="Privacy Policy"
            onPress={() => Linking.openURL('https://kriptik.ai/privacy')}
            isLast
          />
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="Account Actions">
          <SettingsRow
            label="Sign Out"
            onPress={handleSignOut}
            destructive
          />
          <SettingsRow
            label="Delete Account"
            onPress={handleDeleteAccount}
            destructive
            isLast
          />
        </SettingsSection>

        {/* Footer */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 24,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: '#F59E0B15',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#F59E0B' }}>K</Text>
          </View>
          <Text
            style={{
              fontSize: 14,
              color: '#57534E',
              fontFamily: 'DM Sans',
            }}
          >
            KripTik AI
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: '#44403C',
              fontFamily: 'DM Sans',
              marginTop: 4,
            }}
          >
            Build with AI
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
