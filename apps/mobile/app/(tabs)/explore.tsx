import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Image, TouchableOpacity, Dimensions, FlatList, ActivityIndicator } from 'react-native';
import { Music, BarChart2, Smile, Radio, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAudio } from '../../components/YTMobileAudioProvider';
import { API_BASE, type Track } from '../../lib/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 40) / 2;

const CATEGORY_ICONS: Record<string, any> = {
  new: Music,
  charts: BarChart2,
  moods: Smile,
  podcasts: Radio,
  default: Music,
};

type Genre = { id: string; label: string; browseId: string };
type Section = { title: string; items: Track[] };

export default function ExploreScreen() {
  const router = useRouter();
  const { playTrack, currentTrack, loadingId } = useAudio();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/explore`, { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setGenres((json?.genres || []).map((g: any) => ({ id: g.id || g.browseId, label: g.label || '', browseId: g.browseId || g.id })));
        setSections((json?.sections || []).map((s: any) => ({ title: s.title || '', items: (s.items || []).filter((i: any) => i.videoId || i.id).map((i: any) => ({ id: i.browseId || i.id || i.videoId, videoId: i.videoId || '', title: i.title || '', artist: i.artist || '', cover: i.cover || i.thumbnail, durationSec: i.durationSec, duration: i.duration })) })));
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: '#030303', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color="#FF0000" /></View>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#030303', paddingTop: 55 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '700' }}>Explorar</Text>
        <TouchableOpacity onPress={() => router.push('/search')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#212121', alignItems: 'center', justifyContent: 'center' }}>
          <Search color="#fff" size={18} />
        </TouchableOpacity>
      </View>

      {genres.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 32 }}>
          {genres.slice(0, 4).map((g, i) => {
            const colors = ['#ff2d55', '#5856d6', '#ffcc00', '#34c759'];
            const Icon = CATEGORY_ICONS.default;
            return (
              <TouchableOpacity key={g.id + i} onPress={() => g.browseId && router.push({ pathname: '/browse/[id]', params: { id: g.browseId } })} style={{ width: CARD_WIDTH, height: 80, backgroundColor: '#111111', borderRadius: 6, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', borderLeftWidth: 4, borderLeftColor: colors[i % 4] }}>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', maxWidth: '70%' }}>{g.label}</Text>
                <Icon color={colors[i % 4]} size={20} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {sections.map((s) => (
        <View key={s.title} style={{ marginBottom: 24 }}>
          <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 16 }}>{s.title}</Text>
          <FlatList
            data={s.items}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, i) => 'exp-' + (item.videoId || item.id) + i}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => item.videoId ? playTrack(item, s.items.filter((x) => x.videoId)) : item.id && router.push({ pathname: '/browse/[id]', params: { id: item.id } })}
                style={{ marginRight: 16, width: 144 }}
              >
                <Image source={{ uri: item.cover }} style={{ width: 144, height: 144, borderRadius: 4, backgroundColor: '#212121', marginBottom: 8 }} />
                <Text numberOfLines={2} style={{ color: '#ffffff', fontSize: 14, fontWeight: '500', lineHeight: 18 }}>{item.title}</Text>
                <Text numberOfLines={1} style={{ color: '#aaaaaa', fontSize: 13 }}>{item.artist}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ))}
    </ScrollView>
  );
}
