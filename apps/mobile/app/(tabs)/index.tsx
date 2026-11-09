import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Image, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Play, Download, Check, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAudio } from '../../components/YTMobileAudioProvider';
import { fetchHome, fmtSec, type Track } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const CHIPS = ['Tudo', 'Músicas', 'Playlists', 'Álbuns', 'Artistas', 'Energia', 'Foco', 'Tranquilidade'];

export default function HomeFeed() {
  const router = useRouter();
  const { user, setAuthOpen, setProfileOpen } = useAuth();
  const {
    playTrack, playTracks, downloadTrackOffline, downloadProgress,
    downloadedTracks, currentTrack, loadingId,
  } = useAudio();
  const [sections, setSections] = useState<{ title: string; items: Track[] }[]>([]);
  const [quick, setQuick] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [chip, setChip] = useState('Tudo');

  const load = async () => {
    try {
      const data = await fetchHome();
      setSections(data.sections);
      setQuick(data.quick);
      setError('');
    } catch {
      setError('Não foi possível carregar a home. Verifique a internet e tente de novo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onDownload = (t: Track) => {
    if (!downloadedTracks.includes(t.videoId)) downloadTrackOffline(t);
  };

  const renderTrackRow = (item: Track, list: Track[], index: number) => {
    const progress = downloadProgress[item.videoId];
    const isDownloaded = downloadedTracks.includes(item.videoId);
    const isCurrent = currentTrack?.videoId === item.videoId;
    const isLoading = loadingId === item.videoId;
    return (
      <View key={item.videoId + index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <TouchableOpacity onPress={() => playTrack(item, list)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image source={{ uri: item.cover }} style={{ width: 48, height: 48, borderRadius: 4, backgroundColor: '#212121' }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text numberOfLines={1} style={{ color: isCurrent ? '#FF0000' : '#ffffff', fontSize: 14, fontWeight: '500', marginBottom: 2 }}>{item.title}</Text>
            <Text numberOfLines={1} style={{ color: '#aaaaaa', fontSize: 13 }}>Música • {item.artist} • {item.duration || fmtSec(item.durationSec)}</Text>
            {progress != null && progress < 1 && (
              <View style={{ height: 3, backgroundColor: '#333', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                <View style={{ height: 3, backgroundColor: '#FF0000', width: `${Math.round(progress * 100)}%` }} />
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDownload(item)}
          disabled={isDownloaded || (progress != null && progress < 1)}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDownloaded ? '#1f1f1f' : 'transparent', alignItems: 'center', justifyContent: 'center' }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : isDownloaded ? (
            <Check color="#FF0000" size={20} />
          ) : progress != null && progress < 1 ? (
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>{Math.round(progress * 100)}%</Text>
          ) : (
            <Download color="#AAAAAA" size={20} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#030303', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FF0000" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#030303' }}
      contentContainerStyle={{ paddingBottom: 140 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#fff" />}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 55, marginBottom: 16 }}>
        <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 }}>YouTube Music</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => router.push('/search')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#212121', alignItems: 'center', justifyContent: 'center' }}>
            <Search color="#ffffff" size={18} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (user ? setProfileOpen(true) : setAuthOpen(true))}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#212121', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          >
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={{ width: 36, height: 36 }} />
            ) : (
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{user?.initials || 'U'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 24, maxHeight: 38 }}>
        {CHIPS.map((c) => {
          const active = chip === c;
          return (
            <TouchableOpacity
              key={c}
              onPress={() => setChip(c)}
              style={{ backgroundColor: active ? '#ffffff' : '#212121', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}
            >
              <Text style={{ color: active ? '#030303' : '#ffffff', fontSize: 14, fontWeight: '500' }}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {error ? <Text style={{ color: '#ff5555', paddingHorizontal: 16, marginBottom: 16 }}>{error}</Text> : null}

      {quick.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <View>
              <Text style={{ color: '#aaaaaa', fontSize: 12, textTransform: 'uppercase', marginBottom: 2, fontWeight: '500' }}>Iniciar rádio com base em</Text>
              <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>Escolha a dedo</Text>
            </View>
            <TouchableOpacity
              onPress={() => playTracks(quick)}
              style={{ borderWidth: 1, borderColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#111' }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Tocar tudo</Text>
            </TouchableOpacity>
          </View>
          {quick.map((t, i) => renderTrackRow(t, quick, i))}
        </View>
      )}

      {sections.map((section) => (
        <View key={section.title} style={{ marginBottom: 24 }}>
          <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', paddingHorizontal: 16, marginBottom: 16 }}>{section.title}</Text>
          <FlatList
            data={section.items}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            keyExtractor={(item, i) => 'sec-' + item.videoId + i}
            renderItem={({ item, index }) => (
              <TouchableOpacity onPress={() => playTrack(item, section.items)} style={{ marginRight: 16, width: 144 }}>
                <View style={{ position: 'relative' }}>
                  <Image source={{ uri: item.cover }} style={{ width: 144, height: 144, borderRadius: 4, backgroundColor: '#212121', marginBottom: 8 }} />
                  <View style={{ position: 'absolute', bottom: 16, right: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: currentTrack?.videoId === item.videoId ? '#FF0000' : 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    {loadingId === item.videoId
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Play color="#ffffff" size={16} fill="#ffffff" style={{ marginLeft: 2 }} />}
                  </View>
                </View>
                <Text numberOfLines={2} style={{ color: '#ffffff', fontSize: 14, fontWeight: '500', lineHeight: 18, marginBottom: 2 }}>{item.title}</Text>
                <Text numberOfLines={1} style={{ color: '#aaaaaa', fontSize: 13 }}>{item.artist}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ))}
    </ScrollView>
  );
}
