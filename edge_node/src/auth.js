import fetch from 'node-fetch';
import { createLogger } from './logger.js';

const log = createLogger('auth');

/**
 * Authentication error class
 */
export class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

/**
 * Validate API key by making a test request
 */
export async function validateApiKey(apiKey, apiUrl) {
    if (!apiKey) {
        return { valid: false, error: "No API key provided" };
    }
    
    try {
        const validateUrl = `${apiUrl}/api/v1/apikey/validate`;
        
        const response = await fetch(validateUrl, {
            method: 'GET',
            headers: {
                'x-api-key': apiKey
            },
            timeout: 10000 // 10 second timeout
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.valid) {
                log.info("API key validation successful");
                return { valid: true };
            } else {
                return { valid: false, error: data.error || "API key is invalid" };
            }
        } else {
            return { valid: false, error: `Validation request failed with status ${response.status}` };
        }
        
    } catch (error) {
        log.error(`API key validation failed: ${error.message}`);
        return { valid: false, error: error.message };
    }
}