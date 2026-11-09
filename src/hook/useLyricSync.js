import { useMemo, useRef, useEffect, useState } from "react";

/**
 * Sincroniza letra linha a linha com o tempo atual.
 * Suporta:
 *  - LRC simples: [mm:ss] texto ou [00:00.00] texto
 *  - Texto puro: distribui as linhas uniformemente pela duração
 */
export function parseLyrics(lyrics, duration) {
  if (!lyrics) return [];
  const lines = String(lyrics).split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  if (!lines.length) return [];

  const hasTimestamps = lines.some((l) => /^\[\d{1,2}:\d{2}(\.\d{1,2})?\]/.test(l));
  if (hasTimestamps) {
    return lines
      .map((line) => {
        const m = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]\s*(.*)$/);
        if (!m) return null;
        const [, mm, ss, frac, text] = m;
        const time = Number(mm) * 60 + Number(ss) + (frac ? Number(frac.padEnd(2, "0")) / 100 : 0);
        return { time, text: text || "" };
      })
      .filter(Boolean)
      .sort((a, b) => a.time - b.time);
  }

  // distribuição uniforme
  const dur = Number(duration) || 0;
  if (dur <= 0) return lines.map((text, i) => ({ time: i * 3, text }));
  const step = dur / lines.length;
  return lines.map((text, i) => ({ time: i * step, text }));
}

export function useLyricSync(lyrics, currentTime, duration) {
  const parsed = useMemo(() => parseLyrics(lyrics, duration), [lyrics, duration]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const lastIdxRef = useRef(-1);

  useEffect(() => {
    if (!parsed.length) { setActiveIdx(-1); return; }
    const t = currentTime || 0;
    let idx = -1;
    for (let i = parsed.length - 1; i >= 0; i--) {
      if (t >= parsed[i].time) { idx = i; break; }
    }
    if (idx !== lastIdxRef.current) {
      lastIdxRef.current = idx;
      setActiveIdx(idx);
    }
  }, [currentTime, parsed]);

  return { parsed, activeIdx };
}
