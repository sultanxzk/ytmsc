import * as Updates from 'expo-updates';
import { Alert, Platform } from 'react-native';

export type UpdateState = 'checking' | 'available' | 'downloading' | 'ready' | 'idle' | 'error';

let inFlight: Promise<UpdateState> | null = null;

export async function checkForUpdate(): Promise<UpdateState> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await Updates.checkForUpdateAsync();
      return res.isAvailable ? 'available' : 'idle';
    } catch {
      return 'error';
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function fetchUpdate(onProgress?: (pct: number) => void): Promise<UpdateState> {
  const res = await Updates.fetchUpdateAsync();
  if (res.isNew) return 'ready';
  return 'idle';
}

export async function reloadForUpdate() {
  await Updates.reloadAsync();
}

export function isDevOrWeb() {
  return Platform.OS === 'web' || __DEV__;
}

export async function runOtaCheck({ silent = true }: { silent?: boolean } = {}) {
  if (isDevOrWeb()) return 'idle' as UpdateState;
  try {
    const state = await checkForUpdate();
    if (state === 'available') {
      Alert.alert(
        'Atualização disponível',
        'Uma nova versão do app está pronta. Quer atualizar agora?',
        [
          { text: 'Depois', style: 'cancel' },
          {
            text: 'Atualizar agora',
            onPress: async () => {
              await fetchUpdate();
              await reloadForUpdate();
            },
          },
        ]
      );
      return state;
    }
    if (state === 'ready') {
      // já baixado em boot anterior
      Alert.alert(
        'Atualização pronta',
        'Uma atualização já foi baixada. Atualizar agora?',
        [
          { text: 'Depois', style: 'cancel' },
          { text: 'Atualizar agora', onPress: reloadForUpdate },
        ]
      );
      return state;
    }
    return state;
  } catch {
    return 'error' as UpdateState;
  }
}
