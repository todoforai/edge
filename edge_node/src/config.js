import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file from current directory
dotenv.config();

// Default configuration values
const DEFAULT_API_URL = "https://api.todofor.ai";

/**
 * Get environment variable, checking both TODOFORAI_ and TODO4AI_ prefixes
 */
function getEnvVar(name) {
    return process.env[`TODOFORAI_${name}`] || process.env[`TODO4AI_${name}`] || "";
}

/**
 * Convert HTTP URL to WebSocket URL
 */
export function getWsUrl(apiUrl = DEFAULT_API_URL) {
    let url = apiUrl;
    if (url.startsWith("https://")) {
        return url.replace("https://", "wss://") + "/ws/v1/edge";
    } else if (url.startsWith("http://")) {
        return url.replace("http://", "ws://") + "/ws/v1/edge";
    } else if (url.startsWith("localhost")) {
        return "ws://" + url + "/ws/v1/edge";
    } else {
        // Default to secure WebSocket for unknown formats
        return `wss://${url}/ws/v1/edge`;
    }
}

/**
 * Normalize API URL to ensure consistent format
 */
export function normalizeApiUrl(url) {
    if (!url) return DEFAULT_API_URL;
    
    // Remove trailing slash
    url = url.replace(/\/$/, '');
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        // Default to https for production URLs
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
            url = 'http://' + url;
        } else {
            url = 'https://' + url;
        }
    }
    
    return url;
}

/**
 * Configuration class for TODOforAI Edge
 */
export class Config {
    constructor() {
        // Core settings with environment variable fallbacks
        this.apiUrl = getEnvVar("API_URL") || DEFAULT_API_URL;
        this.debug = getEnvVar("DEBUG").toLowerCase() === "true" || getEnvVar("DEBUG") === "1";
        this.logLevel = "INFO";
        this.addWorkspacePath = null;
        
        // Authentication settings
        this.apiKey = getEnvVar("API_KEY");
    }

    toString() {
        const apiKeyDisplay = this.apiKey ? `${this.apiKey.slice(0, 8)}...` : "None";
        
        return `Config(apiUrl='${this.apiUrl}', ` +
               `apiKey='${apiKeyDisplay}', ` +
               `debug=${this.debug}, logLevel='${this.logLevel}', ` +
               `addWorkspacePath=${this.addWorkspacePath})`;
    }

    /**
     * Update configuration from parsed arguments
     */
    updateFromArgs(args) {
        if (args.debug) {
            this.debug = args.debug;
            this.logLevel = this.debug ? "DEBUG" : "INFO";
        }
        
        this.apiUrl = args.apiUrl || this.apiUrl;
        this.apiKey = args.apiKey || this.apiKey;
        
        // Store the add_workspace_path from args, resolving to absolute path
        if (args.addWorkspacePath) {
            const path = require('path');
            const os = require('os');
            this.addWorkspacePath = path.resolve(args.addWorkspacePath.replace('~', os.homedir()));
        }
    }

    /**
     * Apply overrides from a dict (e.g., credentials)
     */
    applyOverrides(overrides) {
        if (!overrides) return;
        
        // Apply the credentials as provided
        if ("apiKey" in overrides) {
            this.apiKey = overrides.apiKey || "";
        }
        
        // Handle other fields
        if ("apiUrl" in overrides) {
            this.apiUrl = overrides.apiUrl ? normalizeApiUrl(overrides.apiUrl) : this.apiUrl;
        }
        if ("debug" in overrides) {
            this.debug = Boolean(overrides.debug);
            this.logLevel = this.debug ? "DEBUG" : "INFO";
        }
        if ("addWorkspacePath" in overrides) {
            const path = require('path');
            const os = require('os');
            this.addWorkspacePath = path.resolve(overrides.addWorkspacePath.replace('~', os.homedir()));
        }
    }

    /**
     * Check if this config has the same credentials as another config or edge
     */
    hasSameCredentials(credentials) {
        if (!credentials) return false;
        
        // Check if API key matches
        if (this.apiKey && credentials.apiKey && this.apiKey === credentials.apiKey) {
            return true;
        }
        
        return false;
    }
}

/**
 * Factory function to create a new config instance
 */
export function defaultConfig() {
    return new Config();
}