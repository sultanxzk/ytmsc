import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { X, Mail, Lock, User, Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { useAuth } from '../lib/auth';

export function LoginModal() {
  const { authOpen, setAuthOpen, login, requestCode, verifyCode } = useAuth();
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const close = () => { setAuthOpen(false); setError(''); setDemoCode(null); };

  const onSubmitPassword = async () => {
    setLoading(true); setError('');
    try {
      await login(name, email, password);
    } catch (e: any) {
      setError(e?.message || 'Erro ao entrar.');
    } finally { setLoading(false); }
  };

  const onRequestCode = async () => {
    setLoading(true); setError('');
    try {
      const res = await requestCode(email);
      setDemoCode(res.demoCode);
    } catch (e: any) { setError(e?.message || 'Erro ao solicitar código.'); }
    finally { setLoading(false); }
  };

  const onVerify = async () => {
    setLoading(true); setError('');
    try { await verifyCode(email, code); }
    catch (e: any) { setError(e?.message || 'Erro ao verificar código.'); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={authOpen} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>Entrar</Text>
            <TouchableOpacity onPress={close}><X color="#fff" size={24} /></TouchableOpacity>
          </View>

          <ScrollView>
            <View style={{ flexDirection: 'row', marginBottom: 20, backgroundColor: '#212121', borderRadius: 8, padding: 4 }}>
              {(['password', 'code'] as const).map((m) => (
                <TouchableOpacity key={m} onPress={() => setMode(m)} style={{ flex: 1, paddingVertical: 10, borderRadius: 6, backgroundColor: mode === m ? '#fff' : 'transparent', alignItems: 'center' }}>
                  <Text style={{ color: mode === m ? '#030303' : '#fff', fontWeight: '600' }}>{m === 'password' ? 'Senha' : 'Código'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {mode === 'password' && (
              <>
                <TextInput value={name} onChangeText={setName} placeholder="Nome (para cadastro)" placeholderTextColor="#777" style={input} autoCapitalize="words" />
                <TextInput value={email} onChangeText={setEmail} placeholder="E-mail" placeholderTextColor="#777" style={input} autoCapitalize="none" keyboardType="email-address" />
                <View style={{ position: 'relative' }}>
                  <TextInput value={password} onChangeText={setPassword} placeholder="Senha" placeholderTextColor="#777" style={input} secureTextEntry={!showPw} />
                  <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={{ position: 'absolute', right: 12, top: 12 }}>
                    {showPw ? <EyeOff color="#aaa" size={20} /> : <Eye color="#aaa" size={20} />}
                  </TouchableOpacity>
                </View>
                {error ? <Text style={err}>{error}</Text> : null}
                <TouchableOpacity onPress={onSubmitPassword} disabled={loading} style={btn}>
                  {loading ? <ActivityIndicator color="#030303" /> : <Text style={btnText}>Entrar / Criar conta</Text>}
                </TouchableOpacity>
              </>
            )}

            {mode === 'code' && (
              <>
                <TextInput value={email} onChangeText={setEmail} placeholder="E-mail" placeholderTextColor="#777" style={input} autoCapitalize="none" keyboardType="email-address" />
                {!demoCode ? (
                  <>
                    {error ? <Text style={err}>{error}</Text> : null}
                    <TouchableOpacity onPress={onRequestCode} disabled={loading} style={btn}>
                      {loading ? <ActivityIndicator color="#030303" /> : <Text style={btnText}>Solicitar código</Text>}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={{ color: '#4caf50', marginVertical: 8, fontSize: 13 }}>
                      Código (demonstração): {demoCode}
                    </Text>
                    <TextInput value={code} onChangeText={setCode} placeholder="Código de 6 dígitos" placeholderTextColor="#777" style={input} keyboardType="numeric" maxLength={6} />
                    {error ? <Text style={err}>{error}</Text> : null}
                    <TouchableOpacity onPress={onVerify} disabled={loading} style={btn}>
                      {loading ? <ActivityIndicator color="#030303" /> : <Text style={btnText}>Verificar e entrar</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            <TouchableOpacity onPress={close} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: '#aaa', fontSize: 13 }}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const input = {
  backgroundColor: '#212121',
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 12,
  color: '#fff',
  marginBottom: 12,
  fontSize: 15,
} as const;

const btn = {
  backgroundColor: '#fff',
  borderRadius: 8,
  paddingVertical: 12,
  alignItems: 'center',
  marginTop: 8,
} as const;

const btnText = { color: '#030303', fontWeight: '700', fontSize: 15 } as const;
const err = { color: '#ff5555', fontSize: 13, marginVertical: 8 } as const;
