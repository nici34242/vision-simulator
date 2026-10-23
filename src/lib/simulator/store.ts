import { useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  MODEL_PRESETS,
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

/** Persistence key for simulator settings. */
const SETTINGS_KEY = "ai-vision-simulator:settings:v1";

/** Restore persisted settings (tolerant to schema drift across versions). */
function loadPersistedSettings(): SimulatorSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SimulatorSettings>;
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    // Guard against corrupted/absurd values from older versions.
    if (!(merged.modelId in MODEL_PRESETS)) merged.modelId = DEFAULT_SETTINGS.modelId;
    merged.fovRadius = clamp(merged.fovRadius, 0.1, 1);
    merged.confidenceThreshold = clamp(merged.confidenceThreshold, 0.05, 0.9);
    merged.targetFps = clamp(Math.round(merged.targetFps), 5, 60);
    merged.boxThickness = clamp(Math.round(merged.boxThickness), 1, 6);
    merged.fovThickness = clamp(Math.round(merged.fovThickness), 1, 6);
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
}

/** Hook a component to a store. High-frequency stores should be throttled by writers. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export const settingsStore = createStore<SimulatorSettings>(loadPersistedSettings());
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
/** Active video source: none, a live screen capture, or a local video file. */
export const sourceStore = createStore<"none" | "capture" | "file">("none");
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

/** Persist settings on every change (best-effort; private mode may throw). */
settingsStore.subscribe(() => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsStore.get()));
  } catch {
    /* storage unavailable — settings simply won't persist */
  }
});
