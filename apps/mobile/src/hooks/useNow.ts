import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    start();
    const subscription = AppState.addEventListener('change', (state) => {
      stop();
      if (state === 'active') start();
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
