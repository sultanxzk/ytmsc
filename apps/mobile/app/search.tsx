import React, { useState } from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { ArrowLeft, Play, Search as SearchIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAudio } from '../components/YTMobileAudioProvider';
import { searchTracks, fmtSec, type Track } from '../lib/api';

export default function SearchScreen() {
  const router = useRouter();
  const { playTrack, currentTrack, loadingId } = useAudio();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = async () => {
    const term = q.trim();
    if (!term) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      setResults(await searchTracks(term));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#030303', paddingTop: 55 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <ArrowLeft color="#ffffff" size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#212121', borderRadius: 24, paddingHorizontal: 16, height: 44 }}>
          <SearchIcon color="#aaaaaa" size={20} style={{ marginRight: 8 }} />
          <TextInput
            value={q}
            onChangeText={setQ}
            onSubmitEditing={run}
            placeholder="Pesquisar músicas, álbuns, artistas..."
            placeholderTextColor="#aaaaaa"
            style={{ flex: 1, color: '#ffffff', fontSize: 15 }}
            returnKeyType="search"
            autoFocus
          />
          <TouchableOpacity onPress={run}>
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>BUSCAR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FF0000" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.videoId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
          ListEmptyComponent={
            searched ? (
              <Text style={{ color: '#aaaaaa', textAlign: 'center', marginTop: 40 }}>Nenhum resultado para "{q}".</Text>
            ) : (
              <Text style={{ color: '#aaaaaa', textAlign: 'center', marginTop: 40 }}>Digite e aperte buscar.</Text>
            )
          }
          renderItem={({ item }) => {
            const isCurrent = currentTrack?.videoId === item.videoId;
            return (
              <TouchableOpacity
                onPress={() => {
                  console.log('[SEARCH] Botão clicado! Item:', item.title, item.videoId);
                  Alert.alert('Debug', `Tentando tocar: ${item.title}`);
                  playTrack(item, results);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}
              >
                <Image source={{ uri: item.cover }} style={{ width: 48, height: 48, borderRadius: 4, backgroundColor: '#212121' }} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text numberOfLines={1} style={{ color: isCurrent ? '#FF0000' : '#ffffff', fontSize: 14, fontWeight: '500' }}>{item.title}</Text>
                  <Text numberOfLines={1} style={{ color: '#aaaaaa', fontSize: 13 }}>{item.artist} • {item.duration || fmtSec(item.durationSec)}</Text>
                </View>
                {loadingId === item.videoId
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Play color="#ffffff" size={20} fill="#ffffff" />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
