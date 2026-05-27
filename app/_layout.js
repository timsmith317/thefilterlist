// app/_layout.js — root navigation stack.
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
