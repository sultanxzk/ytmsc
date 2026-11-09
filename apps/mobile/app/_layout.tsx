import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { YTMobileAudioProvider } from '../components/YTMobileAudioProvider';
import { runOtaCheck } from '../lib/updater';

export default function RootLayout() {
  useEffect(() => {
    // OTA: checa no boot se há update (JS-only, sem baixar APK)
    const t = setTimeout(() => runOtaCheck(), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <YTMobileAudioProvider>
      <StatusBar style="light" backgroundColor="#030303" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#030303' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#030303' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="player" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />
        <Stack.Screen name="browse/[id]" options={{ headerShown: true, title: 'Detalhe' }} />
      </Stack>
    </YTMobileAudioProvider>
  );
}
