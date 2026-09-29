import { useSyncExternalStore } from "react";
import { api } from "../lib/tauri";
import type {
  AppSettings,
  BackendDiagnostics,
  HardwareRecommendation,
  HistoryStats,
  LocalModelInfo,
  ProcessingState,
  SettingsPatch,
  UpdateInfo,
} from "../types";

export interface AppState {
  settings: AppSettings | null;
  processingState: ProcessingState;
  processingError: string | null;
  liveTranscript: { text: string; delta?: string; is_partial: boolean } | null;
  stats: HistoryStats | null;
  models: LocalModelInfo[];
  hardwareRecommendation: HardwareRecommendation | null;
  backendStatus: BackendDiagnostics | null;
  activeDownloads: Record<
    string,
    {
      model_id: string;
      downloaded_bytes: number;
      total_bytes: number;
      percentage: number;
    }
  >;
  toastMessage: string | null;
  availableUpdate: UpdateInfo | null;
  isInitialized: boolean;
}

const initialState: AppState = {
  settings: null,
  processingState: "Idle",
  processingError: null,
  liveTranscript: null,
  stats: null,
  models: [],
  hardwareRecommendation: null,
  backendStatus: null,
  activeDownloads: {},
  toastMessage: null,
  availableUpdate: null,
  isInitialized: false,
};

let currentState: AppState = { ...initialState };
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function updateState(partial: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) {
  const next = typeof partial === "function" ? partial(currentState) : partial;
  currentState = { ...currentState, ...next };
  emitChange();
}

export const resolveEffectiveTheme = (themePreference?: string): "dark" | "light" => {
  if (themePreference === "system") {
    return typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return themePreference === "dark" ? "dark" : "light";
};

export const applyThemeToDom = (themePreference?: string) => {
  if (typeof document !== "undefined") {
    const effective = resolveEffectiveTheme(themePreference);
    document.documentElement.setAttribute("data-theme", effective);
    try {
      localStorage.setItem("forge_theme", effective);
      if (themePreference) {
        localStorage.setItem("forge_theme_pref", themePreference);
      }
    } catch (_) {}
  }
};

let eventUnsubscribers: (() => void)[] = [];
let isListening = false;
let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const appStore = {
  getState: (): AppState => currentState,

  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  init: async () => {
    if (currentState.isInitialized) return;

    // Load initial settings
    try {
      const [settings, procState, stats, models, rec, diag] = await Promise.allSettled([
        api.getSettings(),
        api.getProcessingState(),
        api.getHistoryStats(),
        api.listModels(),
        api.getHardwareRecommendation(),
        api.getBackendStatus(),
      ]);

      const updates: Partial<AppState> = { isInitialized: true };

      if (settings.status === "fulfilled") {
        updates.settings = settings.value;
        applyThemeToDom(settings.value.theme);
      }
      if (procState.status === "fulfilled") {
        updates.processingState = procState.value;
      }
      if (stats.status === "fulfilled") {
        updates.stats = stats.value;
      }
      if (models.status === "fulfilled") {
        updates.models = models.value;
      }
      if (rec.status === "fulfilled") {
        updates.hardwareRecommendation = rec.value;
      }
      if (diag.status === "fulfilled") {
        updates.backendStatus = diag.value;
      }

      updateState(updates);
    } catch (err) {
      console.error("[appStore] Initialization error:", err);
      updateState({ isInitialized: true });
    }

    // Set up Tauri event listeners once
    if (!isListening && typeof window !== "undefined") {
      isListening = true;

      const unlistenState = api.onStateChange(({ state, error }) => {
        updateState({
          processingState: state,
          processingError: error ?? null,
        });
      });

      const unlistenTranscript = api.onLiveTranscript((payload) => {
        updateState({ liveTranscript: payload });
      });

      const unlistenDownload = api.onModelDownloadProgress((payload) => {
        updateState((prev) => ({
          activeDownloads: {
            ...prev.activeDownloads,
            [payload.model_id]: payload,
          },
        }));
      });

      const unlistenToast = api.onToast((msg) => {
        appStore.showToast(msg);
      });

      const unlistenUpdate = api.onUpdateAvailable((info) => {
        if (info.has_update) {
          updateState({ availableUpdate: info });
        }
      });

      eventUnsubscribers = [
        () => unlistenState.then((fn) => fn()),
        () => unlistenTranscript.then((fn) => fn()),
        () => unlistenDownload.then((fn) => fn()),
        () => unlistenToast.then((fn) => fn()),
        () => unlistenUpdate.then((fn) => fn()),
      ];
    }
  },

  destroy: () => {
    for (const unsub of eventUnsubscribers) {
      unsub();
    }
    eventUnsubscribers = [];
    isListening = false;
  },

  showToast: (message: string, durationMs = 3000) => {
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
    }
    updateState({ toastMessage: message });
    toastTimeoutId = setTimeout(() => {
      updateState({ toastMessage: null });
      toastTimeoutId = null;
    }, durationMs);
  },

  dismissToast: () => {
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
      toastTimeoutId = null;
    }
    updateState({ toastMessage: null });
  },

  patchSettings: async (patch: SettingsPatch): Promise<AppSettings | null> => {
    // 1. Optimistic local update
    if (currentState.settings) {
      const optimistic: AppSettings = {
        ...currentState.settings,
        ...patch,
      } as AppSettings;
      updateState({ settings: optimistic });
      if (patch.theme) {
        applyThemeToDom(patch.theme);
      }
    }

    // 2. Perform backend patch
    try {
      const updated = await api.patchSettings(patch);
      updateState({ settings: updated });
      return updated;
    } catch (err) {
      console.error("[appStore] patchSettings error:", err);
      // Re-fetch clean settings from backend to rollback
      try {
        const fresh = await api.getSettings();
        updateState({ settings: fresh });
      } catch {}
      throw err;
    }
  },

  updateSettings: async (settings: AppSettings): Promise<void> => {
    // 1. Optimistic update
    updateState({ settings });
    applyThemeToDom(settings.theme);

    // 2. Persist to backend
    try {
      await api.updateSettings(settings);
    } catch (err) {
      console.error("[appStore] updateSettings error:", err);
      try {
        const fresh = await api.getSettings();
        updateState({ settings: fresh });
      } catch {}
      throw err;
    }
  },

  refreshStats: async (since?: string): Promise<HistoryStats | null> => {
    try {
      const stats = await api.getHistoryStats(since);
      updateState({ stats });
      return stats;
    } catch (err) {
      console.error("[appStore] refreshStats error:", err);
      return null;
    }
  },

  refreshModels: async (): Promise<void> => {
    try {
      const [models, rec, diag] = await Promise.allSettled([
        api.listModels(),
        api.getHardwareRecommendation(),
        api.getBackendStatus(),
      ]);

      const updates: Partial<AppState> = {};
      if (models.status === "fulfilled") updates.models = models.value;
      if (rec.status === "fulfilled") updates.hardwareRecommendation = rec.value;
      if (diag.status === "fulfilled") updates.backendStatus = diag.value;

      updateState(updates);
    } catch (err) {
      console.error("[appStore] refreshModels error:", err);
    }
  },

  clearActiveDownload: (modelId: string) => {
    updateState((prev) => {
      const copy = { ...prev.activeDownloads };
      delete copy[modelId];
      return { activeDownloads: copy };
    });
  },
};

export function useAppStore<T = AppState>(selector?: (state: AppState) => T): T {
  const getSnapshot = () => (selector ? selector(currentState) : (currentState as unknown as T));
  return useSyncExternalStore(appStore.subscribe, getSnapshot, getSnapshot);
}
