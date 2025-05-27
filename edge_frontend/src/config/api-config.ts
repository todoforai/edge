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

// Utility function to convert API base to full URL with protocol
export function getApiUrlWithProtocol(apiBase: string): string {
  // If already has protocol, return as is
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    return apiBase;
  }
  
  // Determine protocol based on host
  const isLocalhost = apiBase.includes('localhost') || apiBase.includes('127.0.0.1');
  const protocol = isLocalhost ? 'http' : 'https';
  return `${protocol}://${apiBase}`;
}

export async function getApiBaseUrl(): Promise<string> {
  const apiBase = await getApiBase();
  const fullUrl = getApiUrlWithProtocol(apiBase);
  return `${fullUrl}/token/v1`;
}
