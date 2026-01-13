import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../../lib/design-system';
import { GlassCard, Button } from '../../components/ui';
import { useAuthStore } from '../../store/auth-store';
import {
  UserIcon,
  BellIcon,
  LockIcon,
  GlobeIcon,
  QRCodeIcon,
  ChevronRightIcon,
  LogoutIcon,
  KripTikLogoIcon,
} from '../../components/icons';

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
}

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = true,
}: SettingItemProps) {
  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.settingIcon}>{icon}</View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (showChevron && onPress && (
        <ChevronRightIcon size={20} color={colors.text.tertiary} />
      ))}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const [notifications, setNotifications] = useState(true);
  const [biometric, setBiometric] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleQRScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/qr-scanner');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </Animated.View>

        {/* Profile Card */}
        <Animated.View entering={FadeInDown.delay(150)}>
          <GlassCard style={styles.profileCard} variant="elevated">
            <View style={styles.profileContent}>
              <View style={styles.avatar}>
                <UserIcon size={32} color={colors.accent.primary} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.name || 'User'}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
              </View>
              <ChevronRightIcon size={20} color={colors.text.tertiary} />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Device Pairing */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <GlassCard style={styles.pairingCard}>
            <View style={styles.pairingContent}>
              <View style={styles.pairingIcon}>
                <QRCodeIcon size={32} color={colors.accent.secondary} />
              </View>
              <View style={styles.pairingInfo}>
                <Text style={styles.pairingTitle}>Pair with Desktop</Text>
                <Text style={styles.pairingSubtitle}>
                  Scan QR code from KripTik web app
                </Text>
              </View>
            </View>
            <Button
              title="Scan QR Code"
              onPress={handleQRScan}
              size="sm"
              fullWidth
            />
          </GlassCard>
        </Animated.View>

        {/* Settings Sections */}
        <Animated.View entering={FadeInDown.delay(250)} style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <GlassCard style={styles.settingsCard}>
            <SettingItem
              icon={<BellIcon size={20} color={colors.text.secondary} />}
              title="Push Notifications"
              subtitle="Receive build and agent updates"
              rightElement={
                <Switch
                  value={notifications}
                  onValueChange={(value) => {
                    setNotifications(value);
                    Haptics.selectionAsync();
                  }}
                  trackColor={{
                    false: colors.background.tertiary,
                    true: colors.accent.muted,
                  }}
                  thumbColor={notifications ? colors.accent.primary : colors.text.tertiary}
                />
              }
              showChevron={false}
            />
            <View style={styles.divider} />
            <SettingItem
              icon={<LockIcon size={20} color={colors.text.secondary} />}
              title="Biometric Lock"
              subtitle="Use Face ID or fingerprint"
              rightElement={
                <Switch
                  value={biometric}
                  onValueChange={(value) => {
                    setBiometric(value);
                    Haptics.selectionAsync();
                  }}
                  trackColor={{
                    false: colors.background.tertiary,
                    true: colors.accent.muted,
                  }}
                  thumbColor={biometric ? colors.accent.primary : colors.text.tertiary}
                />
              }
              showChevron={false}
            />
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <GlassCard style={styles.settingsCard}>
            <SettingItem
              icon={<UserIcon size={20} color={colors.text.secondary} />}
              title="Edit Profile"
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <SettingItem
              icon={<GlobeIcon size={20} color={colors.text.secondary} />}
              title="Connected Accounts"
              subtitle="GitHub, Google"
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <SettingItem
              icon={<LockIcon size={20} color={colors.text.secondary} />}
              title="Security"
              onPress={() => {}}
            />
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350)} style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <GlassCard style={styles.settingsCard}>
            <SettingItem
              icon={<GlobeIcon size={20} color={colors.text.secondary} />}
              title="Help Center"
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <SettingItem
              icon={<GlobeIcon size={20} color={colors.text.secondary} />}
              title="Privacy Policy"
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <SettingItem
              icon={<GlobeIcon size={20} color={colors.text.secondary} />}
              title="Terms of Service"
              onPress={() => {}}
            />
          </GlassCard>
        </Animated.View>

        {/* Sign Out */}
        <Animated.View entering={FadeInDown.delay(400)}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogoutIcon size={20} color={colors.status.error} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* App Info */}
        <Animated.View entering={FadeInDown.delay(450)} style={styles.appInfo}>
          <KripTikLogoIcon size={32} />
          <Text style={styles.appName}>KripTik AI</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  header: {
    marginBottom: spacing['2xl'],
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  profileCard: {
    marginBottom: spacing.lg,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
  },
  profileEmail: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  pairingCard: {
    marginBottom: spacing['2xl'],
  },
  pairingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  pairingIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairingInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  pairingTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  pairingSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing['2xl'],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  settingTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bodyMedium,
    color: colors.text.primary,
  },
  settingSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginLeft: spacing.lg + 36 + spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  logoutText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.status.error,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.sm,
  },
  appName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
  },
  appVersion: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
  },
});
