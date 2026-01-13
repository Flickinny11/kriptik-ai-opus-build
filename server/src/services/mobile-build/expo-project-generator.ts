/**
 * Expo Project Generator
 *
 * Generates React Native + Expo project structure for mobile builds
 */

import fs from 'fs/promises';
import path from 'path';
import type { ExpoProjectTemplate } from './types';

const SANDBOX_BASE = process.env.SANDBOX_PATH || '/tmp/kriptik-sandboxes';

export class ExpoProjectGenerator {
  /**
   * Generate a new Expo project with the specified configuration
   */
  async generateProject(template: ExpoProjectTemplate): Promise<string> {
    const projectPath = path.join(SANDBOX_BASE, 'mobile', `${template.slug}-${Date.now()}`);

    // Create directory structure
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'app'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'app', '(tabs)'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'components'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'lib'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'assets'), { recursive: true });

    // Generate configuration files
    await this.generateAppJson(projectPath, template);
    await this.generatePackageJson(projectPath, template);
    await this.generateEasJson(projectPath);
    await this.generateTsConfig(projectPath);
    await this.generateBabelConfig(projectPath);
    await this.generateTailwindConfig(projectPath);
    await this.generateMetroConfig(projectPath);
    await this.generateGlobalCss(projectPath);

    // Generate app entry point
    await this.generateAppLayout(projectPath);
    await this.generateTabsLayout(projectPath);
    await this.generateHomeScreen(projectPath);

    return projectPath;
  }

  private async generateAppJson(projectPath: string, template: ExpoProjectTemplate): Promise<void> {
    const appJson = {
      expo: {
        name: template.name,
        slug: template.slug,
        version: template.version,
        orientation: 'portrait',
        icon: './assets/icon.png',
        scheme: template.scheme,
        userInterfaceStyle: 'automatic',
        newArchEnabled: true,
        splash: template.splash || {
          image: './assets/splash.png',
          resizeMode: 'contain',
          backgroundColor: '#0C0A09',
        },
        assetBundlePatterns: ['**/*'],
        ios: {
          supportsTablet: template.iosSupportsTablet,
          bundleIdentifier: template.bundleIdentifier,
        },
        android: {
          adaptiveIcon: {
            foregroundImage: './assets/adaptive-icon.png',
            backgroundColor: '#0C0A09',
          },
          package: template.package,
        },
        web: {
          bundler: 'metro',
          output: 'static',
          favicon: './assets/favicon.png',
        },
        plugins: ['expo-router'],
        experiments: {
          typedRoutes: true,
        },
      },
    };

    await fs.writeFile(
      path.join(projectPath, 'app.json'),
      JSON.stringify(appJson, null, 2)
    );
  }

  private async generatePackageJson(projectPath: string, template: ExpoProjectTemplate): Promise<void> {
    const packageJson = {
      name: template.slug,
      version: template.version,
      main: 'expo-router/entry',
      scripts: {
        start: 'expo start',
        android: 'expo start --android',
        ios: 'expo start --ios',
        web: 'expo start --web',
      },
      dependencies: {
        '@expo/vector-icons': '^14.0.3',
        expo: '~52.0.0',
        'expo-constants': '~17.0.0',
        'expo-font': '~13.0.0',
        'expo-linking': '~7.0.0',
        'expo-router': '~4.0.0',
        'expo-splash-screen': '~0.29.0',
        'expo-status-bar': '~2.0.0',
        'expo-system-ui': '~4.0.0',
        nativewind: '^4.0.36',
        react: '18.3.1',
        'react-native': '0.76.0',
        'react-native-gesture-handler': '~2.20.0',
        'react-native-reanimated': '~3.16.0',
        'react-native-safe-area-context': '4.12.0',
        'react-native-screens': '~4.1.0',
        tailwindcss: '^3.4.15',
        zustand: '^5.0.0',
      },
      devDependencies: {
        '@babel/core': '^7.24.0',
        '@types/react': '~18.3.0',
        typescript: '~5.3.0',
      },
      private: true,
    };

    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  private async generateEasJson(projectPath: string): Promise<void> {
    const easJson = {
      cli: {
        version: '>= 12.0.0',
        appVersionSource: 'remote',
      },
      build: {
        development: {
          developmentClient: true,
          distribution: 'internal',
          ios: { simulator: true },
          android: { buildType: 'apk' },
        },
        preview: {
          distribution: 'internal',
          android: { buildType: 'apk' },
        },
        production: {
          autoIncrement: true,
        },
      },
      submit: {
        production: {},
      },
    };

    await fs.writeFile(
      path.join(projectPath, 'eas.json'),
      JSON.stringify(easJson, null, 2)
    );
  }

  private async generateTsConfig(projectPath: string): Promise<void> {
    const tsConfig = {
      extends: 'expo/tsconfig.base',
      compilerOptions: {
        strict: true,
        paths: {
          '@/*': ['./*'],
        },
      },
      include: ['**/*.ts', '**/*.tsx', '.expo/types/**/*.ts', 'expo-env.d.ts'],
    };

    await fs.writeFile(
      path.join(projectPath, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
  }

  private async generateBabelConfig(projectPath: string): Promise<void> {
    const babelConfig = `module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
`;

    await fs.writeFile(path.join(projectPath, 'babel.config.js'), babelConfig);
  }

  private async generateTailwindConfig(projectPath: string): Promise<void> {
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0C0A09',
          secondary: '#1C1917',
          tertiary: '#292524',
        },
        accent: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#14B8A6',
      },
    },
  },
  plugins: [],
};
`;

    await fs.writeFile(path.join(projectPath, 'tailwind.config.js'), tailwindConfig);
  }

  private async generateMetroConfig(projectPath: string): Promise<void> {
    const metroConfig = `const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
`;

    await fs.writeFile(path.join(projectPath, 'metro.config.js'), metroConfig);
  }

  private async generateGlobalCss(projectPath: string): Promise<void> {
    const globalCss = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;

    await fs.writeFile(path.join(projectPath, 'global.css'), globalCss);
  }

  private async generateAppLayout(projectPath: string): Promise<void> {
    const appLayout = `import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import '../global.css';

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0C0A09' }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0C0A09' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  );
}
`;

    await fs.writeFile(path.join(projectPath, 'app', '_layout.tsx'), appLayout);
  }

  private async generateTabsLayout(projectPath: string): Promise<void> {
    const tabsLayout = `import { Tabs } from 'expo-router';
import { View } from 'react-native';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
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
  );
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
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
`;

    await fs.writeFile(path.join(projectPath, 'app', '(tabs)', '_layout.tsx'), tabsLayout);
  }

  private async generateHomeScreen(projectPath: string): Promise<void> {
    const homeScreen = `import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0C0A09' }} edges={['top']}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: '#FFFFFF',
            marginBottom: 8,
          }}
        >
          Welcome
        </Text>
        <Text style={{ fontSize: 16, color: '#A8A29E' }}>
          Your app is ready to be built!
        </Text>
      </View>
    </SafeAreaView>
  );
}
`;

    await fs.writeFile(path.join(projectPath, 'app', '(tabs)', 'index.tsx'), homeScreen);
  }
}

export default ExpoProjectGenerator;
