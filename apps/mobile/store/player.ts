// LEGADO: o estado real do player hoje vive no YTMobileAudioProvider (expo-av).
// Este módulo apenas reexporta o tipo Track para quem importa daqui,
// para não quebrar caminhos antigos. Não crie um segundo player aqui.
export type { Track } from '../lib/api';
export { useAudio as usePlayer } from '../components/YTMobileAudioProvider';
export { useAudio as usePlayerStore } from '../components/YTMobileAudioProvider';
