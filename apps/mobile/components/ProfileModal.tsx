import React, { useState } from 'react';
import { Modal, View, Text, Image, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { useAuth } from '../lib/auth';

export function ProfileModal() {
  const { profileOpen, setProfileOpen, user, updateProfile, changePassword, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [cur, setCur] = useState('');
  const [nextPw, setNextPw] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const onSave = async () => {
    setLoading(true); setError(''); setMsg('');
    try {
      await updateProfile({ name, email });
      setMsg('Perfil atualizado.');
    } catch (e: any) { setError(e?.message || 'Erro.'); }
    finally { setLoading(false); }
  };

  const onChangePw = async () => {
    setLoading(true); setError(''); setMsg('');
    try {
      await changePassword(cur, nextPw);
      setCur(''); setNextPw('');
      setMsg('Senha alterada.');
    } catch (e: any) { setError(e?.message || 'Erro.'); }
    finally { setLoading(false); }
  };

  const onLogout = async () => {
    await logout();
    setProfileOpen(false);
  };

  return (
    <Modal visible={profileOpen} transparent animationType="slide" onRequestClose={() => setProfileOpen(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>Perfil</Text>
            <TouchableOpacity onPress={() => setProfileOpen(false)}><X color="#fff" size={24} /></TouchableOpacity>
          </View>

          <ScrollView>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#212121', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                {user.photo ? (
                  <Image source={{ uri: user.photo }} style={{ width: 72, height: 72 }} />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>{user.initials}</Text>
                )}
              </View>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 8 }}>{user.name}</Text>
              <Text style={{ color: '#aaa', fontSize: 13 }}>{user.email} • {user.plan}</Text>
            </View>

            <TextInput value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor="#777" style={input} />
            <TextInput value={email} onChangeText={setEmail} placeholder="E-mail" placeholderTextColor="#777" style={input} autoCapitalize="none" keyboardType="email-address" />
            <TouchableOpacity onPress={onSave} disabled={loading} style={btn}>
              {loading ? <ActivityIndicator color="#030303" /> : <Text style={btnText}>Salvar perfil</Text>}
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: '#333', marginVertical: 20 }} />

            <Text style={{ color: '#fff', fontWeight: '600', marginBottom: 8 }}>Alterar senha</Text>
            <TextInput value={cur} onChangeText={setCur} placeholder="Senha atual" placeholderTextColor="#777" style={input} secureTextEntry />
            <TextInput value={nextPw} onChangeText={setNextPw} placeholder="Nova senha" placeholderTextColor="#777" style={input} secureTextEntry />
            <TouchableOpacity onPress={onChangePw} disabled={loading} style={[btn, { backgroundColor: '#212121' }]}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Alterar senha</Text>
            </TouchableOpacity>

            {msg ? <Text style={{ color: '#4caf50', marginVertical: 8 }}>{msg}</Text> : null}
            {error ? <Text style={{ color: '#ff5555', marginVertical: 8 }}>{error}</Text> : null}

            <TouchableOpacity onPress={onLogout} style={[btn, { backgroundColor: '#ff0000', marginTop: 20 }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Sair da conta</Text>
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
  marginTop: 4,
} as const;

const btnText = { color: '#030303', fontWeight: '700', fontSize: 15 } as const;
