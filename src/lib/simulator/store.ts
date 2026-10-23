import { useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  type CaptureStatus,
  type EngineStatus,
  type LogEntry,
  type ModelState,
  type SimulatorSettings,
} from "./types";

export interface Store<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      value =
        typeof next === "function" ? (next as (prev: T) => T)(value) : next;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Hook a component to a store. High-frequency stores should be throttled by writers. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export const settingsStore = createStore<SimulatorSettings>(DEFAULT_SETTINGS);
export const statusStore = createStore<EngineStatus>({
  processingFps: 0,
  inferenceMs: 0,
  frameMs: 0,
  detections: 0,
  tracks: 0,
  backend: "—",
  adaptive: false,
});
export const captureStore = createStore<CaptureStatus>("idle");
export const modelStore = createStore<ModelState>("unloaded");
export const modelMessageStore = createStore<string>("");
export const logStore = createStore<LogEntry[]>([]);

let nextLogId = 1;

export function pushLog(
  kind: LogEntry["kind"],
  message: string,
  opts: { cap?: number } = {},
) {
  const time = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  logStore.set((logs) => {
    const next = [{ id: nextLogId++, time, kind, message }, ...logs];
    return next.slice(0, opts.cap ?? 80);
  });
}

export function resetSettings() {
  settingsStore.set(DEFAULT_SETTINGS);
}
