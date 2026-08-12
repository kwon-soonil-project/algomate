"use client";

import { useCallback, useEffect, useState } from "react";

export function useDraft<T>(key: string, fallback: T) {
  const fallbackJson = JSON.stringify(fallback);
  const [value, setValue] = useState<T>(fallback);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      setValue(stored ? JSON.parse(stored) as T : JSON.parse(fallbackJson) as T);
    } catch {
      setValue(JSON.parse(fallbackJson) as T);
    }
    setLoadedKey(key);
  }, [fallbackJson, key]);

  useEffect(() => {
    if (loadedKey !== key) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, loadedKey, value]);

  const clearDraft = useCallback(() => {
    window.localStorage.removeItem(key);
    setValue(JSON.parse(fallbackJson) as T);
  }, [fallbackJson, key]);

  return [value, setValue, clearDraft] as const;
}
