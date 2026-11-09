import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Play, Pause, SkipForward, ThumbsUp } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAudio } from './YTMobileAudioProvider';
import { fmtSec } from '../lib/api';

export function MiniPlayer() {
  const router = useRouter();
  const { currentTrack, isPlaying, togglePlay, next, currentTime, duration, toggleLike, likes } = useAudio();

  const liked = currentTrack ? likes.includes(currentTrack.videoId) : false;

  if (!currentTrack) return null;

  const pct = duration ? Math.min(1, currentTime / duration) : 0;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => router.push('/player')}
      style={{
        position: 'absolute',
        bottom: 64,
        left: 0,
        right: 0,
        backgroundColor: '#212121',
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        zIndex: 50,
      }}
    >
      {/* Progresso fino */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#333' }} />
      <View style={{ position: 'absolute', top: 0, left: 0, height: 2, backgroundColor: '#FF0000', width: `${pct * 100}%` }} />

      <Image source={{ uri: currentTrack.cover }} style={{ width: 40, height: 40, borderRadius: 2, backgroundColor: '#111' }} />

      <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
        <Text numberOfLines={1} style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>{currentTrack.title}</Text>
        <Text numberOfLines={1} style={{ color: '#aaaaaa', fontSize: 12 }}>{currentTrack.artist} • {fmtSec(currentTime)}/{fmtSec(duration)}</Text>
      </View>

      <TouchableOpacity onPress={() => currentTrack && toggleLike(currentTrack)} style={{ marginHorizontal: 8 }}>
        <ThumbsUp color={liked ? '#FF0000' : '#FFFFFF'} size={20} fill={liked ? '#FF0000' : 'none'} />
      </TouchableOpacity>
      <TouchableOpacity onPress={togglePlay} style={{ marginHorizontal: 10 }}>
        {isPlaying ? <Pause color="#FFFFFF" size={24} fill="#FFFFFF" /> : <Play color="#FFFFFF" size={24} fill="#FFFFFF" />}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => next()} style={{ marginHorizontal: 10 }}>
        <SkipForward color="#FFFFFF" size={24} fill="#FFFFFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
