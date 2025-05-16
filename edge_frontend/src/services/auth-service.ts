import { createLogger } from '../utils/logger';
import pythonService from './python-service';
import { getApiBase } from '../config/api-config';
// Add this near the top of the file, after imports
import { useAuthStore } from '../store/authStore';

const log = createLogger('auth-service');

export interface User {
  email?: string;
  apiKey?: string;
  name?: string;
  isAuthenticated: boolean;
  lastLoginTime?: number;
}

export interface LoginCredentials {
  email?: string;
  password?: string;
  apiKey?: string;
  apiUrl?: string;
  debug?: boolean;
}

export interface LoginResponse {
  status: string;
  message: string;
}

class AuthService {
  private static instance: AuthService;
  private currentUser: User = { isAuthenticated: false };

  private constructor() {
    // Try to restore user from localStorage
    this.restoreUserFromStorage();

    // Set up listener for authentication events from Python backend
    pythonService.addEventListener('auth_success', (data) => {
      this.handleAuthSuccess(data);
    });

    pythonService.addEventListener('auth_error', (data) => {
      console.log('Auth error:', data)
      this.handleAuthError(data);
    });
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private saveUserToStorage(user: User): void {
    try {
      if (user.isAuthenticated) {
        // Only store what we need to restore the session
        const storageData = {
          apiKey: user.apiKey,
          email: user.email,
          name: user.name,
          lastLoginTime: user.lastLoginTime,
        };
        localStorage.setItem('currentUser', JSON.stringify(storageData));
        log.info('User data saved to storage');
      } else {
        localStorage.removeItem('currentUser');
        log.info('User data removed from storage');
      }
    } catch (error) {
      log.error('Failed to save user to storage:', error);
    }
  }

  private restoreUserFromStorage(): void {
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const userData = JSON.parse(storedUser);

        // Check if we have the required auth data
        if (userData.apiKey) {
          // Check if the session is still valid (e.g., not expired)
          const sessionAge = Date.now() - (userData.lastLoginTime || 0);
          const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

          if (sessionAge < SESSION_MAX_AGE) {
            this.currentUser = {
              ...userData,
              isAuthenticated: true,
            };
            log.info('User session restored from storage');
            
            // Update the auth store
            useAuthStore.setState({ user: { ...this.currentUser } });
          } else {
            // Session expired
            localStorage.removeItem('currentUser');
            log.info('Stored session expired, removed from storage');
          }
        } else {
          // Missing required auth data
          localStorage.removeItem('currentUser');
          log.info('Invalid stored user data, removed from storage');
        }
      }
    } catch (error) {
      log.error('Failed to restore user from storage:', error);
    }
  }

  public getCurrentUser(): User {
    return { ...this.currentUser };
  }

  public isAuthenticated(): boolean {
    return this.currentUser.isAuthenticated;
  }

  private handleAuthSuccess(data: {type: string, payload: { apiKey: string; email?: string; name?: string}}): void {
    const payload = data.payload;
    const updatedUser = {
      apiKey: payload.apiKey,
      email: payload.email,
      name: payload.name,
      isAuthenticated: true,
      lastLoginTime: Date.now(),
    };

    this.currentUser = updatedUser;
    this.saveUserToStorage(updatedUser);
    log.info('User authenticated successfully');

    // Update the auth store
    useAuthStore.setState({ user: { ...updatedUser } });
  }

  private handleAuthError(data: {type: string, payload: { message: string }}): void {
    const payload = data.payload;
    const errorMessage = payload.message || 'Authentication failed without message';
    log.error('Authentication error:', errorMessage);
    // Update the auth store with the error
    useAuthStore.setState({ error: errorMessage });
  }

  // Update these methods to be more accurate about what they do
  public async loginWithCredentials(email: string, password: string, apiUrl?: string, debug?: boolean): Promise<void> {
    await this.loginWithCredentialsInternal({ email, password, apiUrl, debug });
    // The actual user data will be set by handleAuthSuccess when the SSE event arrives
  }

  public async loginWithApiKey(apiKey: string, apiUrl?: string, debug?: boolean): Promise<void> {
    await this.loginWithCredentialsInternal({ apiKey, apiUrl, debug });
    // The actual user data will be set by handleAuthSuccess when the SSE event arrives
  }

  private async loginWithCredentialsInternal(credentials: LoginCredentials): Promise<void> {
    try {
      // Initialize Python service if not already initialized
      await pythonService.initialize();

      // Get API URL from config if not provided
      if (!credentials.apiUrl) {
        credentials.apiUrl = await getApiBase();
      }

      // Call login method on Python service
      const response = await pythonService.login(credentials);
      log.info(`Login request sent: ${response.status} - ${response.message}`);

      // We don't return anything here - the actual auth result will come through events
    } catch (error) {
      log.error('Login request failed:', error);
      throw error;
    }
  }

  // Check if the current session is valid and not expired
  public isSessionValid(): boolean {
    if (!this.currentUser.isAuthenticated || !this.currentUser.lastLoginTime) {
      return false;
    }

    const sessionAge = Date.now() - this.currentUser.lastLoginTime;
    const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

    return sessionAge < SESSION_MAX_AGE;
  }

  public logout(): void {
    // TODO: Implement actual logout logic when needed
    this.currentUser = { isAuthenticated: false };
    this.saveUserToStorage(this.currentUser);
    log.info('User logged out');
    
    // Update the auth store
    useAuthStore.setState({ user: { isAuthenticated: false } });
  }
}

export default AuthService.getInstance();
