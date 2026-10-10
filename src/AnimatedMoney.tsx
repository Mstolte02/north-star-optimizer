import { useEffect, useRef, useState } from "react";
import { money } from "./Chart";
export function AnimatedMoney({ value }: { value: number }) {
  const [shown, setShown] = useState(value),
    last = useRef(value);
  useEffect(() => {
    if (
      !window.requestAnimationFrame ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      last.current = value;
      setShown(value);
      return;
    }
    const from = last.current;
    last.current = value;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 280);
      setShown(from + (value - from) * (1 - (1 - t) ** 3));
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  return <>{money(shown)}</>;
}
