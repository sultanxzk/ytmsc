import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';
import { checkForUpdate, isDevOrWeb } from '../lib/updater';

export function UpdateBanner() {
  const [state, setState] = useState<'idle' | 'checking' | 'available' | 'ready' | 'error'>('idle');
  const [pct, setPct] = useState(0);

  const refresh = async () => {
    if (isDevOrWeb()) return;
    try {
      const s = await checkForUpdate();
      setState(s === 'available' ? 'available' : s === ('ready' as any) ? 'ready' : 'idle');
      // @ts-ignore expo-updates em web/dev pode derrubar
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    // checa no boot silenciosamente
    refresh();
  }, []);

  if (state === 'idle' || state === 'checking') return null;

  if (state === 'available' || state === 'ready') {
    return (
      <View style={{ backgroundColor: '#1f1f1f', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Atualização disponível</Text>
          <Text style={{ color: '#aaa', fontSize: 12 }}>Toque para atualizar sem reinstalar</Text>
        </View>
        <TouchableOpacity
          onPress={async () => {
            const res = await Updates.fetchUpdateAsync();
            if (res.isNew) {
              Alert.alert('Atualização pronta', 'O app será reiniciado agora.', [
                { text: 'OK', onPress: () => Updates.reloadAsync() },
              ]);
            }
          }}
          style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 }}
        >
          <Text style={{ color: '#030303', fontWeight: '700', fontSize: 13 }}>Atualizar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}
