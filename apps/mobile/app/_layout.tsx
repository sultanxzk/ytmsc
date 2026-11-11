import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { YTMobileAudioProvider } from '../components/YTMobileAudioProvider';
import { AuthProvider } from '../lib/auth.provider';
import { LoginModal } from '../components/LoginModal';
import { ProfileModal } from '../components/ProfileModal';
import { UpdateBanner } from '../components/UpdateBanner';
import { runOtaCheck } from '../lib/updater';

export default function RootLayout() {
  useEffect(() => {
    // FORÇA atualização OTA imediatamente no boot
    const forceUpdate = async () => {
      try {
        if (!Updates.isEnabled || __DEV__) return;

        console.log('[FORCE OTA] Verificando atualizações...');
        const check = await Updates.checkForUpdateAsync();

        if (check.isAvailable) {
          console.log('[FORCE OTA] Atualização encontrada! Baixando...');
          const fetch = await Updates.fetchUpdateAsync();

          if (fetch.isNew) {
            console.log('[FORCE OTA] Atualização baixada! Reiniciando...');
            Alert.alert(
              'Atualização Crítica',
              'Uma atualização importante foi baixada. O app será reiniciado agora.',
              [{ text: 'OK', onPress: () => Updates.reloadAsync() }]
            );
          }
        } else {
          console.log('[FORCE OTA] Nenhuma atualização disponível');
        }
      } catch (err) {
        console.warn('[FORCE OTA] Erro:', err);
      }
    };

    // Executa após 2 segundos do boot
    const t = setTimeout(forceUpdate, 2000);

    // OTA check original (mantém como fallback)
    const t2 = setTimeout(() => runOtaCheck(), 1500);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  return (
    <AuthProvider>
      <YTMobileAudioProvider>
        <StatusBar style="light" backgroundColor="#030303" />
        <UpdateBanner />
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
        <LoginModal />
        <ProfileModal />
      </YTMobileAudioProvider>
    </AuthProvider>
  );
}
