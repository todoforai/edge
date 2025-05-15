import { desktopApi } from '../lib/tauri-api';
import { createLogger } from '../utils/logger';

const log = createLogger('api-config');

const is_prod_env = process.env.NODE_ENV === 'production';
export const DEFAULT_API_BASE = is_prod_env ? 'api.todofor.ai' : 'localhost:4000';
let apiHostOverride: string | null = null;

// Get API host from environment variables
export async function getApiBase(): Promise<string> {
  try {
    if (apiHostOverride) {
      return apiHostOverride;
    }
    apiHostOverride = await desktopApi.getEnvVar('TODOFORAI_HOST');
    if (apiHostOverride) {
      log.info('Using API host from environment variable:', apiHostOverride);
      return apiHostOverride;
    }
  } catch (error) {
    log.warn('Failed to read TODOFORAI_HOST environment variable:', error);
  }
  
  return DEFAULT_API_BASE;
}

export async function getApiBaseUrl(): Promise<string> {
  const apiBase = await getApiBase();
  const is_no_https = apiBase.includes('localhost') || apiBase.includes('127.0.0.1');
  return `${is_no_https ? 'http' : 'https'}://${apiBase}/token/v1`;
}
