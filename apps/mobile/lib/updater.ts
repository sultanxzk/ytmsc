import * as Updates from 'expo-updates';
import { Alert, Platform } from 'react-native';

export type UpdateState = 'checking' | 'available' | 'downloading' | 'ready' | 'idle' | 'error';

// Subscribers que o UpdateBanner usa para mostrar "Atualização disponível" / "Baixando...".
type Listener = (state: UpdateState) => void;
const listeners = new Set<Listener>();
export function subscribeUpdates(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(state: UpdateState) {
  for (const cb of listeners) {
    try { cb(state); } catch {}
  }
}

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

export async function fetchUpdate(): Promise<UpdateState> {
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

/**
 * Fluxo OTA robusto:
 * 1) Se já há um update baixado pendente no boot (isUpdatePending), aplica direto.
 * 2) Senão checa se há update disponível e dispara download automático.
 * 3) Emite estado para o UpdateBanner (sem depender só de Alert).
 */
export async function runOtaCheck(): Promise<UpdateState> {
  if (isDevOrWeb()) return 'idle';
  try {
    // 1) Update já baixado em boot anterior -> reload imediato
    if ((Updates as any).isUpdatePending) {
      emit('ready');
      Alert.alert(
        'Atualização pronta',
        'Uma atualização já foi baixada. O app será recarregado agora.',
        [{ text: 'OK', onPress: reloadForUpdate }]
      );
      return 'ready';
    }

    emit('available');
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      emit('idle');
      return 'idle';
    }

    Alert.alert(
      'Atualização disponível',
      'Uma nova versão do app está pronta. Baixando agora...',
      [
        { text: 'Depois', style: 'cancel' },
        {
          text: 'Atualizar agora',
          onPress: async () => {
            emit('downloading');
            const res = await Updates.fetchUpdateAsync();
            if (res.isNew) {
              emit('ready');
              Alert.alert('Atualização pronta', 'O app será reiniciado agora.', [
                { text: 'OK', onPress: reloadForUpdate },
              ]);
            } else {
              emit('idle');
            }
          },
        },
      ]
    );

    // Baixa em segundo plano mesmo sem confirmacao (melhora UX: usuario so clica OK depois)
    try {
      const res = await Updates.fetchUpdateAsync();
      if (res.isNew) {
        emit('ready');
      }
    } catch {}

    return 'available';
  } catch {
    emit('error');
    return 'error';
  }
}
