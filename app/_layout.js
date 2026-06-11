// app/_layout.js — root navigation stack.

import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useTheme } from '../theme/theme';
import OnboardingModal from '../components/OnboardingModal';

// react-native-draggable-flatlist (Assets reorder) still calls the deprecated
// InteractionManager API. It's harmless and the fix belongs upstream, so we
// swallow just that one warning. Remove this if the library updates.
LogBox.ignoreLogs(['InteractionManager has been deprecated']);

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
          <Stack.Screen name="device/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="device/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="device/edit/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ presentation: 'card' }} />
          <Stack.Screen name="settings/filters" options={{ presentation: 'card' }} />
          <Stack.Screen name="filter/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="filter/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="asset/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="picker" options={{ presentation: 'modal' }} />
        </Stack>

        {/* Always mounted so first-run shows automatically and Help → Replay
            intro can re-open it from any screen. It's a no-op while hidden. */}
        <OnboardingModal />
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}