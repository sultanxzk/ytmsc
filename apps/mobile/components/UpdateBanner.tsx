import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { isDevOrWeb, subscribeUpdates, type UpdateState } from '../lib/updater';

export function UpdateBanner() {
  const [state, setState] = useState<'idle' | 'checking' | 'available' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (isDevOrWeb()) return;
    const unsub = subscribeUpdates((s: UpdateState) => setState(s as any));
    return () => { unsub(); };
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
