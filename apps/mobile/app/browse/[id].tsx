import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Play } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAudio } from '../../components/YTMobileAudioProvider';
import { getBrowsePage, fmtSec, type Track } from '../../lib/api';

export default function BrowseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { playTrack, playTracks, currentTrack, loadingId } = useAudio();
  const [title, setTitle] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getBrowsePage(id)
      .then((d) => { setTitle(d.title); setTracks(d.tracks); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: '#030303', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color="#FF0000" /></View>;
  }

  return (
    <FlatList
      style={{ backgroundColor: '#030303' }}
      data={tracks}
      keyExtractor={(item) => item.videoId}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
      ListHeaderComponent={
        <View style={{ marginTop: 16, marginBottom: 20 }}>
          <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '700' }}>{title || 'Detalhe'}</Text>
          <Text style={{ color: '#aaaaaa', fontSize: 13, marginTop: 4 }}>{tracks.length} faixas</Text>
          <TouchableOpacity
            onPress={() => playTracks(tracks)}
            style={{ marginTop: 16, backgroundColor: '#ffffff', borderRadius: 24, height: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
          >
            <Play color="#030303" size={20} fill="#030303" style={{ marginRight: 8 }} />
            <Text style={{ color: '#030303', fontWeight: '700' }}>Tocar tudo</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => {
        const isCurrent = currentTrack?.videoId === item.videoId;
        return (
          <TouchableOpacity onPress={() => playTrack(item, tracks)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Image source={{ uri: item.cover }} style={{ width: 48, height: 48, borderRadius: 4, backgroundColor: '#212121' }} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text numberOfLines={1} style={{ color: isCurrent ? '#FF0000' : '#ffffff', fontSize: 14, fontWeight: '500' }}>{item.title}</Text>
              <Text numberOfLines={1} style={{ color: '#aaaaaa', fontSize: 13 }}>{item.artist}</Text>
            </View>
            <Text style={{ color: '#aaaaaa', fontSize: 12 }}>{item.duration || fmtSec(item.durationSec)}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}
