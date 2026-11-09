# YouTube Music Clone (frontend + backend serverless)

Clone completo e funcional do frontend do YouTube Music Web — React + Vite + Tailwind CSS v4 + Lucide React,
com integração real ao catálogo do YouTube Music via `youtubei.js` (InnerTube, cliente `WEB_REMIX`) e
reprodução completa via **YouTube IFrame Player API** (músicas inteiras, sem corte de 30s).

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço exibido (geralmente http://localhost:5173). O middleware de desenvolvimento em
`vite.config.js` monta as mesmas rotas de `/api` no servidor Vite, então **não precisa de provedor
de backend separado**.

## Deploy na Vercel

```bash
npm run build
git push
# na Vercel: framework Vite, build `npm run build`, output `dist`
```

As funções serverless em `/api` são detectadas automaticamente pela Vercel.

## Rotas da API (serverless)

- `GET /api/home` — Início do YouTube Music via `Innertube` (cliente `WEB_REMIX`):
  Quick picks, playlists em alta e álbuns recomendados. Retorna `{ sections, tracks, albums, again, quick, trending }`.
- `GET /api/search?q=TERMO` — Busca via `innertube.music.search(q, { type: "song" })`.
  Retorna `{ tracks: [{ videoId, title, artist, album, cover (hqdefault), durationSec, duration }] }`.
- `GET /api/lyrics?id=VIDEO_ID` — Letra via `innertube.music.getLyrics(id)` com fallback na
  API pública `lrclib.net`. Retorna `{ lyrics, source }`.
- `GET /api/album?id=BROWSE_ID` — Faixas de um álbum/playlist (`innertube.music.getAlbum(id)`).

Todos os handlers em `/api` compartilham o cliente InnerTube cacheado (`/api/_lib/innertube.js`).

## Reprodução completa (YouTube IFrame Player API)

- A tag `<audio>` foi substituída pelo **player oficial do YouTube** oculto (`YT.Player` com controles ocultos).
- Ao clicar em qualquer música, o `videoId` é carregado no player; todos os controles da barra inferior
  (play/pause, próxima/anterior, barra de progresso clicável com tempo real via polling de 500ms, volume/mudo,
  shuffle/repeat, fila e letras) são conectados ao `YT.Player`.
- Vídeos que não podem ser incorporados (erro 101/150) exibem um aviso na interface em vez de falhar em silêncio.

## Build

```bash
npm run build
```

Compila sem erros para `dist/`.
