import { useEffect, useRef, useState } from "react";

export function useToast(duration = 2800) {
  const [toast, setToast] = useState("");
  const timerRef = useRef(null);

  const show = (msg) => {
    setToast(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(""), duration);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast("");
  };

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  return { toast, show, hide };
}
