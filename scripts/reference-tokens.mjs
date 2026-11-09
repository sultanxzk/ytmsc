import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF_DIR = path.join(__dirname, '..', 'reference');
const OUT = path.join(REF_DIR, 'tokens.json');

// tokens extraídos da captura oficial (a11y + DOM, sem screenshot que cai no "navegador incompatível")
// - fundo rgb(19,19,19) já aplicado
// - chips/h2/cards: ver off2-settle.txt (nav Guide/Início/search/Conectar a um dispositivo/Fazer login; tab order; heading order; cards 226)
const tokens = {
  colors: { bg: 'rgb(19,19,19)', text: 'rgb(255,255,255)', muted: 'rgb(170,170,170)', red: 'rgb(255,0,51)' },
  topbar: { search: 'Pesquise músicas, álbuns, artistas e podcasts', cast: 'Conectar a um dispositivo', login: 'Fazer login', guide: 'Guide' },
  chips: ['Podcasts', 'Para dormir', 'Para ouvir no trânsito', 'Relax', 'Romance', 'Triste', 'Para treinar', 'Energia', 'Festa', 'Positividade', 'Foco'],
  sections: ['Clássicos da madrugada', 'Bons sonhos', 'De quais artistas você gosta?', 'Escolha a dedo', 'Playlists da comunidade em alta', 'Perfeitas para o fim de semana', 'Calminhas'],
  card: { size: 226, overlay: 'MUSIC_ITEM_THUMBNAIL_OVERLAY_CONTENT_POSITION_BOTTOM_RIGHT' },
  player: ['Anterior', 'Voltar 10 segundos', 'Tocar', 'Avançar 30 segundos', 'Avançar', 'Desativar som', 'Volume', 'Velocidade da reprodução', 'Repetição desativada', 'Ordem aleatória', 'Mais controles do player', 'Abrir a página do player', 'Controle deslizante de busca'],
};

fs.mkdirSync(REF_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(tokens, null, 2));
console.log('tokens do oficial em', OUT);
