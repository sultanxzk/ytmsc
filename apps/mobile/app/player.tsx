import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, ScrollView, StyleSheet, Alert } from 'react-native';
import { ChevronDown, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1, ThumbsUp, ThumbsDown, MoreVertical, Timer, Plus, Trash2, Download, Volume2, ChevronUp, ChevronDown as Down, ListMusic } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAudio } from '../components/YTMobileAudioProvider';
import { fetchLyrics, fmtSec, getUpNext, type Track } from '../lib/api';

const { width } = Dimensions.get('window');

export default function FullScreenPlayer() {
  const router = useRouter();
  const {
    currentTrack, queue, currentIndex, isPlaying, currentTime, duration,
    shuffle, repeat, volume, rate, sleepTimerMin,
    togglePlay, next, prev, seek, toggleShuffle, cycleRepeat, playTrack, addToQueue, downloadTrackOffline,
    toggleLike, toggleDislike, likes, dislikes,
    setVolumeState, setRateState, setSleepTimer,
    playlists, createPlaylist, addTrackToPlaylist, removeFromQueue, playQueueAt, clearQueue, moveInQueue,
  } = useAudio();
  const [activeTab, setActiveTab] = useState<'queue' | 'lyrics' | 'about'>('queue');
  const [lyrics, setLyrics] = useState('');
  const [upNext, setUpNext] = useState<Track[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!currentTrack?.videoId) return;
    fetchLyrics(currentTrack.videoId).then(setLyrics);
    getUpNext(currentTrack.videoId).then(setUpNext);
  }, [currentTrack?.videoId]);

  if (!currentTrack) {
    return (
      <View style={styles.root}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()}><ChevronDown color="#ffffff" size={28} /></TouchableOpacity>
          <Text style={styles.kicker}>NENHUMA FAIXA</Text>
          <View style={{ width: 28 }} />
        </View>
        <Text style={styles.empty}>Selecione uma música para começar</Text>
      </View>
    );
  }

  const pct = duration ? Math.min(1, currentTime / duration) : 0;
  const liked = likes.includes(currentTrack.videoId);
  const disliked = dislikes.includes(currentTrack.videoId);

  const openMenu = () => {
    Alert.alert('Opções', currentTrack.title, [
      { text: 'Adicionar à fila', onPress: () => addToQueue(currentTrack) },
      { text: 'Baixar offline', onPress: () => downloadTrackOffline(currentTrack) },
      { text: liked ? 'Remover curtida' : 'Curtir', onPress: () => toggleLike(currentTrack) },
      { text: disliked ? 'Remover não curti' : 'Não curtir', onPress: () => toggleDislike(currentTrack) },
      { text: 'Letra', onPress: () => setActiveTab('lyrics') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.back()}><ChevronDown color="#ffffff" size={28} /></TouchableOpacity>
        <Text style={styles.kicker}>
          {sleepTimerMin ? `TIMER ${sleepTimerMin}MIN` : 'TOCANDO DO ÁLBUM'}
        </Text>
        <TouchableOpacity onPress={openMenu}><MoreVertical color="#ffffff" size={24} /></TouchableOpacity>
      </View>

      <View style={styles.artWrap}>
        <Image source={{ uri: currentTrack.cover }} style={styles.art} />
      </View>

      <View style={styles.metaRow}>
        <TouchableOpacity onPress={() => toggleDislike(currentTrack)}>
          <ThumbsDown color={disliked ? '#ff0000' : '#ffffff'} size={22} fill={disliked ? '#ff0000' : 'none'} />
        </TouchableOpacity>
        <View style={styles.metaCenter}>
          <Text numberOfLines={1} style={styles.title}>{currentTrack.title}</Text>
          <Text numberOfLines={1} style={styles.artist}>{currentTrack.artist}</Text>
        </View>
        <TouchableOpacity onPress={() => toggleLike(currentTrack)}>
          <ThumbsUp color={liked ? '#ff0000' : '#ffffff'} size={22} fill={liked ? '#ff0000' : 'none'} />
        </TouchableOpacity>
      </View>

      <View style={styles.timelineWrap}>
        <View style={styles.timelineTrack}>
          <View style={[styles.timelineFill, { width: `${pct * 100}%` }]} />
          <View style={[styles.timelineDot, { left: `${pct * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmtSec(currentTime)}</Text>
          <Text style={styles.time}>{fmtSec(duration)}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleShuffle} style={{ opacity: shuffle ? 1 : 0.6 }}>
          <Shuffle color={shuffle ? '#ff0000' : '#ffffff'} size={22} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => prev()}><SkipBack color="#ffffff" size={28} fill="#ffffff" /></TouchableOpacity>
        <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
          {isPlaying
            ? <Pause color="#030303" size={32} fill="#030303" />
            : <Play color="#030303" size={32} fill="#030303" />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => next()}><SkipForward color="#ffffff" size={28} fill="#ffffff" /></TouchableOpacity>
        <TouchableOpacity onPress={cycleRepeat}>
          {repeat === 'one'
            ? <Repeat1 color="#ff0000" size={22} />
            : <Repeat color={repeat === 'all' ? '#ff0000' : '#ffffff'} size={22} />}
        </TouchableOpacity>
      </View>

      <View style={styles.extraRow}>
        <TouchableOpacity onPress={() => setSleepTimer(sleepTimerMin ? null : 15)} style={styles.extraChip}>
          <Timer color={sleepTimerMin ? '#ff0000' : '#ffffff'} size={18} />
          <Text style={[styles.extraText, sleepTimerMin ? { color: '#ff0000' } : {}]}>
            {sleepTimerMin ? `${sleepTimerMin}min` : 'Timer'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRateState(rate === 1 ? 1.5 : rate === 1.5 ? 2 : 0.75)} style={styles.extraChip}>
          <Text style={styles.extraText}>{rate}x</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setVolumeState(volume === 0 ? 0.85 : 0)} style={styles.extraChip}>
          <Volume2 color="#ffffff" size={18} />
          <Text style={styles.extraText}>{volume === 0 ? 'Mudo' : Math.round(volume * 100) + '%'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <View style={styles.tabBar}>
          {([
            ['queue', 'A SEGUIR'],
            ['lyrics', 'LETRA'],
            ['about', 'SOBRE'],
          ] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveTab(key)}
              style={[styles.tab, activeTab === key && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.tabContent}>
          {activeTab === 'queue' && (
            <View>
              {queue.length > 0 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={styles.sectionTitle}>Fila • {queue.length}</Text>
                  <TouchableOpacity onPress={clearQueue} style={{ backgroundColor: '#212121', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>Limpar</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {queue.length ? queue.map((t, i) => {
                const isCur = i === currentIndex;
                return (
                  <View key={t.videoId + i} style={styles.row}>
                    <TouchableOpacity onPress={() => playQueueAt(i)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Image source={{ uri: t.cover }} style={styles.rowArt} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={[styles.rowTitle, isCur && { color: '#ff0000' }]}>
                          {isCur ? '▶ ' : ''}{t.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.rowSub}>{t.artist}</Text>
                      </View>
                      <Text style={styles.rowTime}>{t.duration || fmtSec(t.durationSec)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeFromQueue(i)} style={{ padding: 6 }}>
                      <Trash2 color="#aaaaaa" size={18} />
                    </TouchableOpacity>
                  </View>
                );
              }) : upNext.map((t) => (
                <TouchableOpacity
                  key={t.videoId}
                  onPress={() => playTrack(t, [currentTrack, ...upNext])}
                  style={styles.row}
                >
                  <Image source={{ uri: t.cover }} style={styles.rowArt} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.rowTitle}>{t.title}</Text>
                    <Text numberOfLines={1} style={styles.rowSub}>{t.artist}</Text>
                  </View>
                  <Text style={styles.rowTime}>{t.duration || fmtSec(t.durationSec)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {activeTab === 'lyrics' && (
            <Text style={styles.lyrics}>{lyrics || 'Letra não encontrada para esta faixa.'}</Text>
          )}
          {activeTab === 'about' && (
            <View>
              <Text style={styles.aboutName}>{currentTrack.artist}</Text>
              <Text style={styles.aboutText}>{currentTrack.album || 'YouTube Music'} • duração {fmtSec(duration)}</Text>
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionTitle}>Adicionar à playlist</Text>
                <TouchableOpacity
                  onPress={async () => { const pl = await createPlaylist('Nova playlist'); await addTrackToPlaylist(pl.id, currentTrack); Alert.alert('OK', `Adicionada a ${pl.name}`); }}
                  style={styles.plRow}
                >
                  <Plus color="#ffffff" size={18} />
                  <Text style={styles.plText}>Nova playlist</Text>
                </TouchableOpacity>
                {playlists.map((pl) => (
                  <TouchableOpacity key={pl.id} onPress={() => addTrackToPlaylist(pl.id, currentTrack)} style={styles.plRow}>
                    <ListMusic color="#aaaaaa" size={18} />
                    <Text style={styles.plText}>{pl.name} • {pl.trackIds.length}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030303', paddingTop: 50 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  kicker: { color: '#aaaaaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  artWrap: { alignItems: 'center', marginBottom: 24, paddingHorizontal: 24 },
  art: { width: width - 48, height: width - 48, borderRadius: 4, backgroundColor: '#212121' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  metaCenter: { flex: 1, alignItems: 'center', marginHorizontal: 16 },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  artist: { color: '#aaaaaa', fontSize: 15, textAlign: 'center' },
  timelineWrap: { paddingHorizontal: 24, marginBottom: 16 },
  timelineTrack: { height: 4, backgroundColor: '#333333', borderRadius: 2, marginBottom: 8 },
  timelineFill: { position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: '#FF0000', borderRadius: 2 },
  timelineDot: { position: 'absolute', top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF0000', marginLeft: -6 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: '#aaaaaa', fontSize: 12 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, marginBottom: 12 },
  playBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  extraRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 24 },
  extraChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#212121', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  extraText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  tabs: { flex: 1, backgroundColor: '#121212', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222222', height: 48 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#ffffff' },
  tabText: { color: '#aaaaaa', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#ffffff' },
  tabContent: { flex: 1, padding: 16 },
  sectionTitle: { color: '#ffffff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rowArt: { width: 44, height: 44, borderRadius: 4, backgroundColor: '#212121' },
  rowTitle: { color: '#ffffff', fontSize: 14, fontWeight: '500', marginLeft: 12 },
  rowSub: { color: '#aaaaaa', fontSize: 13, marginLeft: 12 },
  rowTime: { color: '#aaaaaa', fontSize: 12 },
  lyrics: { color: '#ffffff', fontSize: 16, lineHeight: 28, fontWeight: '500', textAlign: 'center' },
  aboutName: { color: '#ffffff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  aboutText: { color: '#aaaaaa', fontSize: 13, lineHeight: 20 },
  plRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  plText: { color: '#ffffff', fontSize: 14 },
  empty: { color: '#aaaaaa', textAlign: 'center', marginTop: 40 },
});
