import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

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
 * 3) Applies downloaded updates automatically without user prompts.
 */
export async function runOtaCheck(): Promise<UpdateState> {
  if (isDevOrWeb()) return 'idle';
  try {
    // 1) Update já baixado em boot anterior -> reload imediato
    if ((Updates as any).isUpdatePending) {
      emit('ready');
      await reloadForUpdate();
      return 'ready';
    }

    emit('checking');
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      emit('idle');
      return 'idle';
    }

    // Encontrou atualização! Mantém o estado 'available' fixo
    emit('available');

    // Baixa em segundo plano automaticamente
    try {
      emit('downloading');
      const res = await Updates.fetchUpdateAsync();
      if (res.isNew) {
        emit('ready');
        // Apply downloaded updates automatically without interrupting the user.
        await reloadForUpdate();
      } else {
        emit('idle');
      }
    } catch (err) {
      console.warn('[OTA] Erro ao baixar:', err);
      emit('available'); // Mantém como disponível mesmo se falhar o download
    }

    return 'available';
  } catch (err) {
    console.warn('[OTA] Erro ao checar:', err);
    emit('error');
    return 'error';
  }
}
