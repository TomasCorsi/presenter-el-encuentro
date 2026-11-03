import { useEffect, useState } from "react";

export const STAGE_CLOCK_PLACEHOLDER = "--:--:--";

export function formatStageClock(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export interface StageClockOptions {
  now?: () => Date;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

const systemNow = () => new Date();

/** Reloj local de Stage. Nunca forma parte del protocolo Output. */
export function useStageClock({
  now = systemNow,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}: StageClockOptions = {}): string {
  const [clock, setClock] = useState(STAGE_CLOCK_PLACEHOLDER);

  useEffect(() => {
    const update = () => setClock(formatStageClock(now()));
    update();
    const timer = setIntervalFn(update, 1000);
    return () => clearIntervalFn(timer);
  }, [clearIntervalFn, now, setIntervalFn]);

  return clock;
}
