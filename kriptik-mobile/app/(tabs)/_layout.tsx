/**
 * Tabs Layout
 *
 * Bottom tab navigation for main app screens
 */

import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

// Tab icon component
function TabIcon({
  name,
  focused,
}: {
  name: 'home' | 'builds' | 'settings';
  focused: boolean;
}) {
  const icons = {
    home: (
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: focused ? '#F59E0B' : '#57534E',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: focused ? '#F59E0B' : '#57534E',
          }}
        />
      </View>
    ),
    builds: (
      <View
        style={{
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 20,
            height: 4,
            backgroundColor: focused ? '#F59E0B' : '#57534E',
            borderRadius: 2,
            marginBottom: 3,
          }}
        />
        <View
          style={{
            width: 14,
            height: 4,
            backgroundColor: focused ? '#F59E0B80' : '#57534E80',
            borderRadius: 2,
            marginBottom: 3,
          }}
        />
        <View
          style={{
            width: 8,
            height: 4,
            backgroundColor: focused ? '#F59E0B40' : '#57534E40',
            borderRadius: 2,
          }}
        />
      </View>
    ),
    settings: (
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: focused ? '#F59E0B' : '#57534E',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: focused ? '#F59E0B' : '#57534E',
          }}
        />
      </View>
    ),
  };

  return icons[name];
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0C0A09',
          borderTopWidth: 1,
          borderTopColor: '#1C1917',
          height: 84,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: '#57534E',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Projects',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="builds"
        options={{
          title: 'Builds',
          tabBarIcon: ({ focused }) => <TabIcon name="builds" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
