// src/renderer/src/hooks/useBarcodeScanner.ts
import { useEffect, useRef } from 'react';

export function useBarcodeScanner(onScan: (code: string) => void): void {
  const bufferRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);

  useEffect((): (() => void) => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Enter') {
        const code = bufferRef.current.trim();
        bufferRef.current = '';

        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }

        if (code.length > 0) {
          onScan(code);
        }

        return;
      }

      if (event.key.length === 1) {
        bufferRef.current += event.key;
      }

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout((): void => {
        bufferRef.current = '';
        timerRef.current = null;
      }, 100);
    };

    window.addEventListener('keydown', onKeyDown);

    return (): void => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onScan]);
}