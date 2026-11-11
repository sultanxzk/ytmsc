import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Image, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput } from 'react-native';
import { Play, Trash2, Plus, ThumbsUp, Search } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudio } from '../../components/YTMobileAudioProvider';
import { getHistory, type Playlist } from '../../lib/store';
import type { Track } from '../../lib/api';
import { useRouter } from 'expo-router';

type Tab = 'downloads' | 'playlists' | 'liked' | 'history';

export default function LibraryScreen() {
  const router = useRouter();
  const {
    downloadedTracks, deleteOfflineTrack, playTrack,
    playlists, createPlaylist, deletePlaylist, renamePlaylist, likes,
    currentTrack,
  } = useAudio();
  const [offline, setOffline] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [tab, setTab] = useState<Tab>('downloads');
  const [refreshing, setRefreshing] = useState(false);
  const [newPlName, setNewPlName] = useState('');

  const load = async () => {
    const out: Track[] = [];
    for (const id of downloadedTracks) {
      const raw = await AsyncStorage.getItem(`@track_offline_${id}`);
      if (raw) out.push(JSON.parse(raw) as Track);
    }
    setOffline(out);
    const h = await getHistory();
    setHistory(h.map((e) => e.track));
  };

  useEffect(() => { load(); }, [downloadedTracks]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const askNewPlaylist = () => {
    Alert.prompt('Nova playlist', 'Nome da playlist', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Criar', onPress: async (name?: string) => { if (name) await createPlaylist(name); } },
    ], 'plain-text', '', 'default');
  };

  const likedTracks = [...offline, ...history, ...(currentTrack ? [currentTrack] : [])]
    .filter((t, i, arr) => arr.findIndex((x) => x.videoId === t.videoId) === i)
    .filter((t) => likes.includes(t.videoId));

  const renderList = (list: Track[], emptyMsg: string) => {
    if (!list.length) {
      return (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <Text style={{ color: '#aaaaaa', fontSize: 14 }}>{emptyMsg}</Text>
        </View>
      );
    }
    return list.map((t) => (
      <View key={t.videoId} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <TouchableOpacity onPress={() => playTrack(t, list)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image source={{ uri: t.cover }} style={{ width: 48, height: 48, borderRadius: 4, backgroundColor: '#212121' }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text numberOfLines={1} style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>{t.title}</Text>
            <Text numberOfLines={1} style={{ color: '#aaaaaa', fontSize: 13 }}>{t.artist}</Text>
          </View>
          <Play color="#ffffff" size={20} fill="#ffffff" />
        </TouchableOpacity>
        {tab === 'downloads' && (
          <TouchableOpacity onPress={() => deleteOfflineTrack(t.videoId)} style={{ padding: 8 }}>
            <Trash2 color="#aaaaaa" size={20} />
          </TouchableOpacity>
        )}
      </View>
    ));
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'downloads', label: 'Baixadas' },
    { key: 'playlists', label: 'Playlists' },
    { key: 'liked', label: `Curtidas ${likedTracks.length}` },
    { key: 'history', label: 'Histórico' },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#030303', paddingTop: 55 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '700' }}>Biblioteca</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => router.push('/update-test' as any)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#212121', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18 }}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/search')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#212121', alignItems: 'center', justifyContent: 'center' }}>
            <Search color="#fff" size={18} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                backgroundColor: active ? '#ffffff' : '#212121',
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginRight: 8,
              }}
            >
              <Text style={{ color: active ? '#030303' : '#ffffff', fontSize: 13, fontWeight: '600' }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tab === 'downloads' && renderList(offline, 'Nenhuma faixa offline ainda.')}
      {tab === 'history' && renderList(history, 'Nenhum histórico ainda.')}
      {tab === 'liked' && renderList(likedTracks, 'Nenhuma curtida ainda.')}

      {tab === 'playlists' && (
        <View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <TextInput
              value={newPlName}
              onChangeText={setNewPlName}
              placeholder="Nome da nova playlist..."
              placeholderTextColor="#777"
              style={{ flex: 1, backgroundColor: '#212121', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 14 }}
            />
            <TouchableOpacity
              onPress={async () => {
                if (!newPlName.trim()) return;
                await createPlaylist(newPlName);
                setNewPlName('');
              }}
              style={{ backgroundColor: '#ffffff', paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus color="#030303" size={20} />
            </TouchableOpacity>
          </View>

          {playlists.length === 0 ? (
            <Text style={{ color: '#aaaaaa', fontSize: 14, textAlign: 'center', marginTop: 20 }}>Nenhuma playlist ainda.</Text>
          ) : playlists.map((pl: Playlist) => (
            <View key={pl.id} style={{ marginBottom: 20, backgroundColor: '#111', borderRadius: 8, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>{pl.name}</Text>
                  <Text style={{ color: '#aaaaaa', fontSize: 12 }}>{pl.trackIds.length} faixas</Text>
                </View>
                <TouchableOpacity onPress={() => pl.tracks[0] && playTrack(pl.tracks[0], pl.tracks)} style={{ padding: 8 }}>
                  <Play color="#ffffff" size={20} fill="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deletePlaylist(pl.id)} style={{ padding: 8 }}>
                  <Trash2 color="#ff5555" size={20} />
                </TouchableOpacity>
              </View>
              {pl.tracks.slice(0, 3).map((t) => (
                <View key={t.videoId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                  <Image source={{ uri: t.cover }} style={{ width: 36, height: 36, borderRadius: 4, backgroundColor: '#212121' }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text numberOfLines={1} style={{ color: '#fff', fontSize: 13 }}>{t.title}</Text>
                    <Text numberOfLines={1} style={{ color: '#aaa', fontSize: 12 }}>{t.artist}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
