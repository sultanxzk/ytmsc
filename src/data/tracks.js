// Lista local de fallback — músicas completas livres (SoundHelix).
// Usada apenas quando a rede oscila / Audius indisponível, para a tela nunca ficar vazia.

const sh = (n) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;
const img = (id) => `https://picsum.photos/seed/ytm${id}/400/400`;

// duração aproximada (min:seg) -> segundos reais para a barra de progresso
const sec = (m, s) => m * 60 + s;

export const FALLBACK_TRACKS = [
  { id: "fb-1", title: "Neon Skyline", artist: "Midnight Drive", album: "City Lights", durationSec: sec(6, 12), duration: "6:12", year: 2024, genre: "Electronic", cover: img(1), src: sh(1), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — Neon Skyline ◆\n\nNeon skyline, cidade a brilhar\nLuzes que dançam sem parar\nRuas vazias, coração a pulsar\nCada batida quer te encontrar" },
  { id: "fb-2", title: "Solar Dreams", artist: "Aurora Waves", album: "Golden Hour", durationSec: sec(7, 4), duration: "7:04", year: 2023, genre: "Pop", cover: img(2), src: sh(2), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — Solar Dreams ◆\n\nSol dourado no horizonte\nAquece a alma e o coração\nOndas suaves a fluir, mornas\nEnergia pura na direção" },
  { id: "fb-3", title: "City Runner", artist: "Pulse Theory", album: "Urban Beat", durationSec: sec(5, 8), duration: "5:08", year: 2024, genre: "Hip-Hop/Rap", cover: img(3), src: sh(3), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — City Runner ◆\n\nCorre pela cidade sem olhar pra trás\nCada passo é ritmo, cada olhar é gás\nNenhum obstáculo segura o teu compasso" },
  { id: "fb-4", title: "Deep Focus", artist: "Neon Coast", album: "Synthwave Tides", durationSec: sec(6, 35), duration: "6:35", year: 2022, genre: "Lo-Fi", cover: img(4), src: sh(4), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — Deep Focus ◆\n\nMergulha no silêncio do mar elétrico\nConcentração pura, estado crítico\nNada interfere, tudo flui" },
  { id: "fb-5", title: "Morning Pulse", artist: "Coastline", album: "Sunrise Sessions", durationSec: sec(6, 42), duration: "6:42", year: 2024, genre: "Pop", cover: img(5), src: sh(5), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — Morning Pulse ◆\n\nAmanhece e a pulso dispara\nNova luz na tua janela\nEnergia que não para" },
  { id: "fb-6", title: "Retrograde", artist: "Vector Field", album: "Echoes Tomorrow", durationSec: sec(7, 21), duration: "7:21", year: 2021, genre: "Electronic", cover: img(6), src: sh(6), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — Retrograde ◆\n\nÀ deriva em órbita lenta\nPensamentos que voltam e pensam\nTempo que gira, mente atenta" },
  { id: "fb-7", title: "Electric Heart", artist: "Static Bloom", album: "Voltage", durationSec: sec(5, 55), duration: "5:55", year: 2023, genre: "Rock", cover: img(7), src: sh(7), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — Electric Heart ◆\n\nCoração elétrico a pulsar\nCorrente forte a te queimar\nDescarga pura de adrenalina" },
  { id: "fb-8", title: "Ocean Drive", artist: "Blue Circuit", album: "Tidal", durationSec: sec(6, 3), duration: "6:03", year: 2024, genre: "Lo-Fi", cover: img(8), src: sh(8), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — Ocean Drive ◆\n\nPela costa a conduzir\nVento no rosto, mar a sorrir\nOndas que acalmam, horizonte infinito" },
  { id: "fb-9", title: "Iron Pulse", artist: "Gravity Well", album: "Heavy Orbit", durationSec: sec(5, 30), duration: "5:30", year: 2023, genre: "Rock", cover: img(9), src: sh(9), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — Iron Pulse ◆\n\nPulso de ferro a martelar\nCada repetição, força a gerar\nSem desistir, sem recuar" },
  { id: "fb-10", title: "Lunar Echo", artist: "Orbit Decay", album: "Dark Side", durationSec: sec(7, 15), duration: "7:15", year: 2022, genre: "Electronic", cover: img(10), src: sh(10), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — Lunar Echo ◆\n\nEco lunar na noite escura\nReflexo de luz na tua estrutura\nSilêncio que fala, que sussurra" },
  { id: "fb-11", title: "Velocity", artist: "Afterglow", album: "Turbulence", durationSec: sec(6, 28), duration: "6:28", year: 2024, genre: "Hip-Hop/Rap", cover: img(11), src: sh(11), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — Velocity ◆\n\nVelocidade máxima, sem frear\nQuebra a barreira, faz tremer\nCada segundo é uma vitória" },
  { id: "fb-12", title: "Golden Dust", artist: "Velvet Static", album: "Radiance", durationSec: sec(6, 50), duration: "6:50", year: 2021, genre: "Pop", cover: img(12), src: sh(12), explicit: false, mood: [],
    lyrics: "◆ Letra instrumental — Golden Dust ◆\n\nPoeira dourada a cair do céu\nCobrem o chão que é teu\nbrilho suave que não se apaga" },
];

export const TRACKS = FALLBACK_TRACKS;
