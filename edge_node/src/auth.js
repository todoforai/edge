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
 * Authenticate with email and password to get API key
 */
export async function authenticateAndGetApiKey(email, password, apiUrl) {
    if (!email || !password) {
        throw new AuthenticationError("Email and password are required for authentication");
    }
    
    try {
        // Step 1: Login to get Bearer token
        const loginUrl = `${apiUrl}/token/v1/auth/login`;
        log.info(`🔐 Authenticating with email: ${email} on ${apiUrl}...`);
        
        const loginResponse = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password
            }),
            timeout: 30000
        });
        
        if (!loginResponse.ok) {
            const errorText = await loginResponse.text();
            const registrationMsg = "Please register or check your account at https://todofor.ai";
            throw new AuthenticationError(`Login failed: ${errorText}\n${registrationMsg}`);
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.token;
        
        if (!token) {
            throw new AuthenticationError("Server returned no authentication token");
        }
        
        // Step 2: Get or create API key using the Bearer token
        const headers = { "Authorization": `Bearer ${token}` };
        const apiKeyName = "todoforai-edge";
        
        // Try to get existing API key
        const getKeyUrl = `${apiUrl}/token/v1/users/apikeys/${apiKeyName}`;
        log.info("🔑 Retrieving API key...");
        
        const getKeyResponse = await fetch(getKeyUrl, {
            method: 'GET',
            headers: headers,
            timeout: 30000
        });
        
        if (getKeyResponse.status === 404) {
            // Create new API key
            const createKeyUrl = `${apiUrl}/token/v1/users/apikeys`;
            log.info("📝 Creating new API key...");
            
            const createKeyResponse = await fetch(createKeyUrl, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: apiKeyName }),
                timeout: 30000
            });
            
            if (!createKeyResponse.ok) {
                const errorText = await createKeyResponse.text();
                throw new AuthenticationError(`Failed to create API key: ${errorText}`);
            }
            
            const createData = await createKeyResponse.json();
            const apiKey = createData.id;
            
            if (!apiKey) {
                throw new AuthenticationError(`Server returned invalid API key response: ${JSON.stringify(createData)}`);
            }
            
            log.info("✅ Created new API key");
            return apiKey;
            
        } else if (getKeyResponse.ok) {
            // Use existing API key
            const getData = await getKeyResponse.json();
            const apiKey = getData.id;
            
            if (!apiKey) {
                throw new AuthenticationError(`Server returned invalid API key response: ${JSON.stringify(getData)}`);
            }
            
            log.info("✅ Retrieved existing API key");
            return apiKey;
            
        } else {
            const errorText = await getKeyResponse.text();
            throw new AuthenticationError(`Failed to get API key: ${errorText}`);
        }
        
    } catch (error) {
        if (error instanceof AuthenticationError) {
            throw error;
        }
        
        // Handle network errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new AuthenticationError(`Cannot connect to authentication server: ${error.message}`);
        }
        
        throw new AuthenticationError(`Authentication failed: ${error.message}`);
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
        const validateUrl = `${apiUrl}/token/v1/users/apikeys/validate`;
        
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