// src/lib/tauri-api.ts tauri v2
import { createLogger } from '../utils/logger';

const log = createLogger('tauri-api-v2');

// ────────────────────────────────────────────────────────────────
//  1.  Environment-level detector (compile-time, zero cost at run)
// ────────────────────────────────────────────────────────────────

export const isTauri = () => (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);

// ────────────────────────────────────────────────────────────────
//  2.  Safe invoke that loads @tauri-apps/api only when we're in Tauri
// ────────────────────────────────────────────────────────────────
const safeInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T | null> => {
  if (!isTauri()) {
    log.warn(`"${command}" called in browser; returning null`);
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch (err) {
    log.error(`invoke("${command}") failed:`, err);
    return null;
  }
};

// WebSocket sidecar state management
let isWebSocketStarting = false;

// Shared ping payload for health checks
export const PING_PAYLOAD = {
  function: 'ping',
  parameter: 'health_check',
};

// ────────────────────────────────────────────────────────────────
//  3.  Public API (add more commands as your Rust side grows)
// ────────────────────────────────────────────────────────────────
export const tauriApi = {
  openDevTools: () => safeInvoke<void>('open_devtools'),

  // Save window size using the Rust window's dimensions
  saveWindowSize: () => {
    log.info('Saving current window size from Rust side');
    return safeInvoke<void>('save_current_window_size');
  },

  getSavedWindowSize: () => safeInvoke<{ width: number; height: number }>('get_saved_window_size'),

  // Get command-line arguments passed to the Tauri app
  getCliArgs: () => safeInvoke<string[]>('get_cli_args'),

  getCurrentWorkingDirectory: () => safeInvoke<string>('get_current_working_directory'),

  // Get platform information
  getPlatform: async () => {
    try {
      const { platform, arch, version } = await import('@tauri-apps/plugin-os');
      return {
        platform: await platform(),
        arch: await arch(),
        version: await version(),
      };
    } catch (err) {
      log.error('Failed to get platform info:', err);
      return null;
    }
  },

  // Get environment variable using Rust command
  getEnvVar: async (name: string): Promise<string | null> => {
    if (!isTauri()) {
      log.warn(`Environment variable "${name}" requested in browser; returning null`);
      return null;
    }

    try {
      const value = await safeInvoke<string | null>('get_env_var', { name });
      if (value) {
        log.info(`Got environment variable ${name}: ${value}`);
        return value;
      }
      return null;
    } catch (err) {
      log.error(`Failed to get environment variable ${name}:`, err);
      return null;
    }
  },

  // WebSocket sidecar functions
  startWebSocketSidecar: async (): Promise<number | null> => {
    if (!isTauri()) {
      log.warn('WebSocket sidecar can only be started in Tauri');
      return null;
    }

    // If already starting, return the pending promise
    if (isWebSocketStarting) {
      log.info('WebSocket sidecar start already in progress');
      return null;
    }

    isWebSocketStarting = true;

    try {
      log.info('Starting WebSocket sidecar');
      const port = await safeInvoke<number>('start_websocket_sidecar');
      isWebSocketStarting = false;
      return port;
    } catch (error) {
      log.error('Failed to start WebSocket sidecar:', error);
      isWebSocketStarting = false;
      return null;
    }
  },

  getWebSocketPort: async (): Promise<number | null> => {
    if (!isTauri()) {
      log.warn('WebSocket port can only be retrieved in Tauri');
      return null;
    }

    try {
      const port = await safeInvoke<number>('get_websocket_port');
      return port;
    } catch (error) {
      log.error('Failed to get WebSocket port:', error);
      return null;
    }
  }
};

// ────────────────────────────────────────────────────────────────
//  4.  Browser fall-backs (keep UX intact during Storybook / netlify)
// ────────────────────────────────────────────────────────────────

export const browserFallbacks = {
  openDevTools: () => log.info('Cannot programmatically open dev-tools in browser'),
  saveWindowSize: () => log.info('Window-state persistence is Tauri-only'),
  getSavedWindowSize: () => ({ width: 800, height: 600 }),
  getCliArgs: () => {
    log.info('CLI arguments are only available in Tauri');
    return [];
  },
  getCurrentWorkingDirectory: () => '',

  getPlatform: () => {
    const userAgent = navigator.userAgent.toLowerCase();
    let platform = 'unknown';

    if (userAgent.includes('win')) platform = 'windows';
    else if (userAgent.includes('mac')) platform = 'macos';
    else if (userAgent.includes('linux') || userAgent.includes('x11')) platform = 'linux';

    return {
      platform,
      arch: 'unknown',
      version: 'unknown',
    };
  },

  // Environment variable fallback
  getEnvVar: (name: string) => {
    log.info(`Environment variable "${name}" not available in browser`);
    return null;
  },

  // WebSocket sidecar fallbacks
  startWebSocketSidecar: () => {
    log.info('WebSocket sidecar is not available in browser');
    return null;
  },
  
  getWebSocketPort: () => {
    log.info('WebSocket port is not available in browser');
    return null;
  }
};

// Get app version function
export const getAppVersion = async (): Promise<string> => {
  if (isTauri()) {
    try {
      // For Tauri v2
      const { getVersion } = await import('@tauri-apps/api/app');
      return await getVersion();
    } catch (error) {
      log.error('Error getting app version from Tauri:', error);
      return 'Unknown';
    }
  }
  
  // For web or fallback
  return import.meta.env.VITE_APP_VERSION || 'dev';
};

// ────────────────────────────────────────────────────────────────
//  5.  Unified facade that just "does the right thing"
// ────────────────────────────────────────────────────────────────
export const desktopApi = {
  openDevTools: () => (isTauri() ? tauriApi.openDevTools() : browserFallbacks.openDevTools()),

  saveWindowSize: () => (isTauri() ? tauriApi.saveWindowSize() : browserFallbacks.saveWindowSize()),

  getSavedWindowSize: async () =>
    isTauri() ? (await tauriApi.getSavedWindowSize()) ?? browserFallbacks.getSavedWindowSize() : browserFallbacks.getSavedWindowSize(),

  getCliArgs: async () => (isTauri() ? (await tauriApi.getCliArgs()) ?? browserFallbacks.getCliArgs() : browserFallbacks.getCliArgs()),

  getCurrentWorkingDirectory: async () =>
    isTauri()
      ? (await tauriApi.getCurrentWorkingDirectory()) ?? browserFallbacks.getCurrentWorkingDirectory()
      : browserFallbacks.getCurrentWorkingDirectory(),

  getPlatform: async () => (isTauri() ? (await tauriApi.getPlatform()) ?? browserFallbacks.getPlatform() : browserFallbacks.getPlatform()),

  // Get environment variable with fallback
  getEnvVar: async (name: string): Promise<string | null> =>
    isTauri() ? await tauriApi.getEnvVar(name) : browserFallbacks.getEnvVar(name),

  // WebSocket sidecar with fallback
  startWebSocketSidecar: async (): Promise<number | null> =>
    isTauri() ? await tauriApi.startWebSocketSidecar() : browserFallbacks.startWebSocketSidecar(),
    
  getWebSocketPort: async (): Promise<number | null> =>
    isTauri() ? await tauriApi.getWebSocketPort() : browserFallbacks.getWebSocketPort(),
  getAppVersion,
};

// ────────────────────────────────────────────────────────────────
//  6.  Auto-persist size on resize (only when running inside Tauri)
// ────────────────────────────────────────────────────────────────
if (isTauri()) {
  let debounce: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => tauriApi.saveWindowSize(), 400);
  });
}
