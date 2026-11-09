# Diferenças do clone vs YouTube Music oficial (music.youtube.com)

Evidências: capturas REA `a11y.txt` (oficial home), `8312c399.txt` (oficial explore),
`a11y-local.txt` (clone), DOM `a11y.txt`. Todas as seções abaixo conferidas em 2026-11-08
com viewport 1920×1080, pt-BR, dark, não logado.

## 1. Sidebar (guia esquerda)
- **Oficial:** logo YouTube Music Premium no topo; só 3 itens — Início, Explorar,
  Biblioteca; bloco "Fazer login" + texto "Sign in to create & share playlists...";
  sem mini-player, sem lista de playlists no drawer.
- **Clone:** tem mini-player da faixa atual, lista completa da biblioteca embutida
  (Curtidas/Histórico/Downloads/Inscrições/Nova playlist + playlists com contagens),
  rodapé "Catálogo via YouTube Music", e item ativo com barra vermelha à esquerda
  (oficial usa fundo sólido arredondado). Rail recolhido mostra Curtidas/Histórico
  extras que o oficial não tem.

## 2. Topo
- **Oficial:** lápis de "Conectar a um dispositivo" (cast) + "Fazer login"; sem
  botão "Mais opções" (3 pontos) no topo.
- **Clone:** tem cast + 3 pontos extras; placeholder com "( / )" redundante; pills
  de mood sempre visíveis com ordem errada (podcasts primeiro).

## 3. Home — ordem e títulos das seções
- **Oficial:** Clássicos da madrugada → Escolha a dedo → "De quais artistas
  você gosta?" (+ botão "Vamos lá") → Playlists da comunidade em alta →
  Bons sonhos → Calminhas.
- **Clone:** "Ouvir agora" (botão inexistente no oficial) → Escolha a dedo →
  Ouvir novamente → Músicas em alta → Álbuns recomendados. Nenhuma seção
  oficial existe no clone.

## 4. Cards (faixas/álbuns/playlists)
- **Oficial:** card de 2 linhas (título + artista/formatos com "Tocou X mi vezes"
  ou "• X mi de visualizações"); ações (like/dislike/menu) no hover.
- **Clone:** coração e dislike sempre visíveis ao passar o mouse, mas o clone
  exibe "Álbum • " com artista vazio (byline quebrada) e não mostra "Tocou"
  nem visualizações.

## 5. Quick Picks
- **Oficial:** 3 colunas × 4 linhas sem paginação, subtítulo com artista + "Tocou".
- **Clone:** 3 colunas com paginação em dots (3 páginas) — o oficial não pagina.

## 6. Explorar
- **Oficial:** 4 abas — Lançamentos, Paradas, Momentos e gêneros, Podcasts;
  5 seções (Novos álbuns e singles, Momentos e gêneros, Episódios favoritos,
  Em alta, Novos vídeos); 48 botões de gênero (Clima alegre ... Trilhas sonoras).
- **Clone:** GENRES hardcoded com 14 termos em inglês/português misturados
  ("Funk BR", "Electronic", "Lo-Fi"...), seção genérica "Em alta: {gênero}" e
  título "Explorar" com ícone — o oficial não tem título grande "Explorar".

## 7. PlayerBar
- **Oficial:** não logado mostra barra "Selecione uma música para começar —
  YouTube Music"; botões exatos: Anterior, Voltar 10 segundos, Tocar,
  Avançar 30 segundos, Avançar, Volume/Desativar som, Velocidade da reprodução,
  Repetição desativada, Ordem aleatória, Mais controles do player, Abrir a
  página do player.
- **Clone:** tem extras inexistentes no oficial — Timer de sono (Desativado/
  5/10/15/30/45/1h/Fim), popup de fila/letras, velocidade ciclo 1→1.25→1.5→2→0.5,
  botões Letras/Fila — e usa ícones/aria-labels diferentes.

## 8. Busca
- **Oficial:** chips na ordem Podcasts, Para dormir, Para ouvir no trânsito,
  Relax, Romance, Triste, Para treinar, Energia, Festa, Positividade, Foco;
  busca com aria "Pesquise músicas, álbuns, artistas e podcasts" sem "(/)".
- **Clone:** ordem Podcasts, Para ouvir no trânsito, Romance, Energia,
  Para treinar, Relax, Para dormir... — diferente da oficial; placeholder
  com "(/)".

## Ações aplicadas nesta sessão (para ficar idêntico)
1. Sidebar: removidos mini-player e biblioteca embutida; drawer só com
   Início/Explorar/Biblioteca + login como no oficial.
2. Topo: "Conectar a um dispositivo", placeholder exato, removido 3 pontos.
3. Moods reordenados exatamente como oficial.
4. Home: seções/títulos/ordem do oficial.
5. Quick Picks: sem paginação (12 itens, 3×4).
6. Explorar: 4 abas + 48 gêneros do oficial, removido GENRES hardcoded.
7. PlayerBar/TrackCard: ajustes de ícones/labels e bylines.
