import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, animations } from '../../lib/design-system';
import {
  HomeIcon,
  BuildIcon,
  AgentsIcon,
  LabIcon,
  SettingsIcon,
} from '../../components/icons';
import { useNotificationStore } from '../../store/notification-store';

interface TabIconProps {
  focused: boolean;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  badge?: number;
}

function TabIcon({ focused, icon: Icon, label, badge }: TabIconProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(focused ? 1 : 0.9, animations.spring.snappy),
      },
    ],
    opacity: withSpring(focused ? 1 : 0.6, animations.spring.snappy),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: withSpring(focused ? 0.6 : 0, animations.spring.smooth),
    transform: [
      {
        scale: withSpring(focused ? 1.2 : 0.8, animations.spring.smooth),
      },
    ],
  }));

  return (
    <View style={styles.tabIconContainer}>
      {/* Glow effect */}
      <Animated.View style={[styles.tabGlow, glowStyle]} />

      {/* Icon */}
      <Animated.View style={animatedStyle}>
        <Icon
          size={24}
          color={focused ? colors.accent.primary : colors.text.secondary}
        />
      </Animated.View>

      {/* Label */}
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? colors.accent.primary : colors.text.secondary },
        ]}
      >
        {label}
      </Text>

      {/* Badge */}
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const { unreadCount } = useNotificationStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={HomeIcon}
              label="Home"
              badge={unreadCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="builds"
        options={{
          title: 'Builds',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={BuildIcon} label="Builds" />
          ),
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          title: 'Agents',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={AgentsIcon} label="Agents" />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-lab"
        options={{
          title: 'AI Lab',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={LabIcon} label="AI Lab" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={SettingsIcon} label="Settings" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    height: 80,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 60,
    height: 48,
  },
  tabGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.glow,
  },
  tabLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bodyMedium,
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: 8,
    backgroundColor: colors.status.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.text.primary,
    fontSize: 10,
    fontFamily: typography.fontFamily.bodySemiBold,
  },
});
