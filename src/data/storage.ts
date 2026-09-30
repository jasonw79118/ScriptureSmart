import { useState } from 'react';
interface Snapshot<T> {
  value: T;
  error: string;
  unreadable: boolean;
}
export function useLocalStore<T>(
  key: string,
  initial: T,
  validate?: (value: unknown) => value is T,
) {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { value: initial, error: '', unreadable: false };
      const parsed: unknown = JSON.parse(raw);
      if (validate && !validate(parsed)) throw new Error('Invalid saved data');
      return { value: parsed as T, error: '', unreadable: false };
    } catch {
      return {
        value: initial,
        error:
          'Saved browser data could not be read. Existing storage will be preserved. Export your work before closing this page.',
        unreadable: true,
      };
    }
  });
  function save(next: T) {
    if (snapshot.unreadable) {
      setSnapshot({ ...snapshot, value: next });
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setSnapshot({ value: next, error: '', unreadable: false });
    } catch {
      setSnapshot({
        value: next,
        error:
          'Browser storage is unavailable or full. Export your work before closing this page.',
        unreadable: false,
      });
    }
  }
  return [snapshot.value, save, snapshot.error] as const;
}
