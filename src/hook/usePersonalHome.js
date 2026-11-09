import { useEffect, useState } from "react";

/** Destaque personalizado da Home baseado em hora do dia + histórico local. */
export function usePersonalHome({ home, liked }) {
  const [insight, setInsight] = useState(null);

  useEffect(() => {
    const h = new Date().getHours();
    const period = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    const tracks = home.trending || home.tracks || home.quick || [];
    const top = tracks[0];
    setInsight({
      period,
      message:
        h >= 22 || h < 5
          ? "Modo noturno: relaxe com algo tranquilo"
          : h >= 17
            ? "Hora de desacelerar — curta um som agora"
            : h >= 7
              ? "Energia alta? Toca uma faixa para aquecer"
              : "Comece o dia com música boa",
      top,
      liked: (liked || []).length,
    });
  }, [home, liked]);

  return insight;
}
