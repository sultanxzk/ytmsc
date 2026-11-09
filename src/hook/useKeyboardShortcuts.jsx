import { useEffect } from "react";

/**
 * Atalhos globais do player (sem interferir em inputs/textareas).
 * - Espaço: tocar/pausar
 * - → / ←: avançar/voltar 10s
 * - ↑ / ↓: volume
 * - m: mudo
 * - f: expandir/recolher player
 * - l: letras
 * - q: fila
 */
export function useKeyboardShortcuts(player) {
  useEffect(() => {
    if (!player) return;
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === " ") {
        e.preventDefault();
        player.togglePlay?.();
      } else if (k === "arrowright") {
        e.preventDefault();
        player.seek?.(Math.min((player.duration || 0), (player.currentTime || 0) + 10));
      } else if (k === "arrowleft") {
        e.preventDefault();
        player.seek?.(Math.max(0, (player.currentTime || 0) - 10));
      } else if (k === "arrowup") {
        e.preventDefault();
        player.setVolume?.(Math.min(1, (player.volume ?? 0.85) + 0.1));
      } else if (k === "arrowdown") {
        e.preventDefault();
        player.setVolume?.(Math.max(0, (player.volume ?? 0.85) - 0.1));
      } else if (k === "m") {
        player.setMuted?.(!(player.muted || player.volume === 0));
      } else if (k === "f") {
        player.setExpanded?.(!player.expanded);
      } else if (k === "l") {
        player.setShowLyrics?.(!player.showLyrics);
        player.setShowQueue?.(false);
      } else if (k === "q") {
        player.setShowQueue?.(!player.showQueue);
        player.setShowLyrics?.(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player]);
}
