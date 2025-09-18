#!/usr/bin/env node

import { createArgparseApplyConfig } from './arg-parser.js';
import { validateApiKey, AuthenticationError } from './auth.js';
import { createLogger } from './logger.js';

const log = createLogger('main');

/**
 * Main entry point
 */
async function main() {
    try {
        // Parse arguments and get configuration
        const config = await createArgparseApplyConfig();
        
        log.info('Configuration:', config.toString());
        
        // Test authentication
        if (config.apiKey) {
            log.info('Validating API key...');
            const validation = await validateApiKey(config.apiKey, config.apiUrl);
            
            if (validation.valid) {
                log.info('✅ API key is valid');
            } else {
                log.error('❌ API key validation failed:', validation.error);
                process.exit(1);
            }
        } else {
            log.error('❌ No API key provided. Please provide --api-key');
            process.exit(1);
        }
        
        log.info('🚀 Authentication successful! Ready to start edge services...');
        
        // TODO: Start WebSocket server and other services here
        
    } catch (error) {
        log.error('Fatal error:', error.message);
        if (config?.debug) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    log.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Start the application
main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});