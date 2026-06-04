// app/_layout.js — root navigation stack.
import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useTheme } from '../theme/theme';

// Dev-only: silence known deprecation warnings that come from dependencies
// (not our own code) and that we can't fix ourselves. Add a new substring or
// regex here when a recurring third-party warning has been triaged, so it
// doesn't need chasing down again. These are no-ops in production builds.
LogBox.ignoreLogs([
  'InteractionManager has been deprecated',
]);

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: t.bg },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="filter/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="filter/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="filter/edit/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ presentation: 'card' }} />
          <Stack.Screen name="settings/parts" options={{ presentation: 'card' }} />
          <Stack.Screen name="part/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="part/new" options={{ presentation: 'modal' }} />
        </Stack>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}