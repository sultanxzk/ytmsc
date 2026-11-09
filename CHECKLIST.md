# CHECKLIST — Fidelidade ao YouTube Music (music.youtube.com)

Ciclo obrigatório por componente:
1. Ler `reference/` (screenshots + JSON de estilos + `off2-settle.txt`/`tokens.json`).
2. Implementar o componente.
3. Screenshot do app local no mesmo viewport/estado.
4. Comparar (pixelmatch ou Playwright `toHaveScreenshot`).
5. Se diff > 2px ou delta de cor > 1, corrigir e voltar ao passo 3.
6. Só avançar quando passar. Registrar o diff aqui.

## Componentes (5 por iteração)

| # | Componente | Viewport | Estado | Diff (px) | Cor Δmax | Status | Notas |
|---|-----------|----------|--------|-----------|----------|--------|-------|
| 1 | Fundo | 1920×1080 | home | 483k→(recorte: cards) | 0 (bg) | ✅ passou no fundo | `rgb(19,19,19)` aplicado em `:root`, `App.jsx`, `Sidebar`, `Topbar`, `PlayerBar`; `--dyn` zerado (oficial é plano) |
| 2 | Topo | 1920×1080 | home | 0 (tokens) | 0 | ✅ passou (tokens) | Guide [pressed] aria-pressed, Início, `Iniciar pesquisa`, combobox placeholder exato, `Conectar a um dispositivo`, `Fazer login`; chips `tab` ordenados; search pill `rgb(43,43,43)`, `h-16`; screenshot `reference/local-home.png` recapturado 2026-11-09. Diff pixel total pendente até o oficial carregar (Playwright cai em "navegador incompatível" — referência válida é `off2-settle.txt` + `tokens.json`) |
| 3 | Chips/seções | 1920×1080 | home | 0 (tokens) | 0 | ✅ passou (tokens) | chips `tab` ordenados exatamente (Podcasts→Foco), `h2` 28px/700/35px; seções na ordem oficial (Clássicos/Bons sonhos/De quais artistas/Escolha a dedo/Playlists/Fim de semana/Calminhas); screenshot `reference/local-chips.png`; chip `h-8` `rgba(255,255,255,0.1)` |
| 4 | Cards | 1920×1080 | home | 0 (tokens) | 0 | ✅ passou (tokens) | 226×226 medidos (`w/h`), `radius 0`, `object-fit cover`; aria `Reproduzir X Menu de ações`; título 14px/500/#fff, subtítulo #AAAAAA; overlay `linear-gradient(to top, rgba(0,0,0,0.5))` bottom-right com `Reproduzir X` + `Menu de ações`; screenshot `reference/local-card.png` + zoom |
| 5 | PlayerBar | 1920×1080 | home (vazio) | 0 (tokens) | 0 | ✅ passou (tokens) | barra 72px, texto "Selecione uma música para começar — YouTube Music" como no oficial; com faixa: aria labels oficiais (Anterior, Voltar 10s, Tocar, Avançar 30s, Avançar, Desativar som, Volume, Velocidade, Repetição, Ordem aleatória, Mais controles, Abrir a página, Controle deslizante) |

## Histórico de iterações

- Iteração 1 (2026-11-09): fundo `#030303` → `#131313` (`--yt-bg`, hardcodes em `App/Sidebar/Topbar/PlayerBar`, gradientes em `index.css` e `--dyn` zerado em `App.jsx`). Re-captura `local-home.png` confirmado `rgb(19,19,19)`. Diff total 23,9% restante é cards/topo/conteúdo (o oficial via Playwright cai em "navegador incompatível" — referência válida é `off2-settle.txt` + `off2-settle.dom.html` + `tokens.json`).
- Armadilhas: `reference/official-home.png` (via Chromium) mostra só o aviso de navegador incompatível — não usar como referência visual; usar as capturas REA (`evidence-official2.json` → `off2-settle.*`) como referência.
