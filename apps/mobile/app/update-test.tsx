import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react-native';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';

export default function UpdateTestScreen() {
  const router = useRouter();
  const [log, setLog] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  const addLog = (msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const checkForUpdate = async () => {
    setChecking(true);
    setLog([]);
    try {
      addLog('🔍 Verificando atualizações...');
      addLog(`📱 Canal: ${Updates.channel || 'N/A'}`);
      addLog(`🔑 Runtime: ${Updates.runtimeVersion || 'N/A'}`);

      const manifest = Updates.manifest;
      addLog(`📋 Manifest: ${manifest ? 'presente' : 'ausente'}`);

      const result = await Updates.checkForUpdateAsync();
      addLog(`✅ Check completo: ${JSON.stringify(result)}`);

      if (result.isAvailable) {
        addLog('🎉 Atualização disponível! Baixando...');
        const fetchResult = await Updates.fetchUpdateAsync();
        addLog(`📦 Download completo: ${JSON.stringify(fetchResult)}`);

        if (fetchResult.isNew) {
          Alert.alert(
            'Atualização pronta!',
            'O app será reiniciado agora.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Reiniciar', onPress: () => Updates.reloadAsync() },
            ]
          );
        } else {
          addLog('⚠️ Nenhuma atualização nova após download');
        }
      } else {
        addLog('ℹ️ Nenhuma atualização disponível');
      }
    } catch (error: any) {
      addLog(`❌ Erro: ${error?.message || String(error)}`);
      Alert.alert('Erro', error?.message || 'Erro ao verificar atualização');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#030303' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 60, marginBottom: 20 }}>
        <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
          Test OTA Update
        </Text>
        <Text style={{ color: '#aaaaaa', fontSize: 14 }}>
          Forçar checagem de atualização OTA
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
        <TouchableOpacity
          onPress={checkForUpdate}
          disabled={checking}
          style={{
            backgroundColor: checking ? '#444' : '#FF0000',
            padding: 16,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <RefreshCw color="#ffffff" size={20} />
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
            {checking ? 'Verificando...' : 'Verificar Atualização'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={{ backgroundColor: '#111', borderRadius: 8, padding: 12 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            Log de Diagnóstico:
          </Text>
          {log.length === 0 ? (
            <Text style={{ color: '#888', fontSize: 13 }}>
              Clique no botão acima para verificar atualizações
            </Text>
          ) : (
            log.map((line, i) => (
              <Text key={i} style={{ color: '#ccc', fontSize: 12, marginBottom: 4, fontFamily: 'monospace' }}>
                {line}
              </Text>
            ))
          )}
        </View>

        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 20,
            padding: 12,
            backgroundColor: '#212121',
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14 }}>Voltar</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
