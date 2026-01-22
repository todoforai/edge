/**
 * Message Router for TODOforAI Edge
 *
 * Routes incoming WebSocket messages to appropriate handlers
 * based on message type.
 */

import { Message, MessageType, MessageTypes } from './types/protocol';

type MessageHandler<T = unknown> = (payload: T) => void | Promise<void>;
type GenericHandler = MessageHandler<unknown>;

/**
 * Message Router
 *
 * Dispatches messages to registered handlers based on type.
 * Supports multiple handlers per message type.
 */
export class MessageRouter {
  private handlers: Map<string, Set<GenericHandler>> = new Map();
  private defaultHandler: GenericHandler | null = null;

  /**
   * Register a handler for a specific message type
   *
   * @param type - Message type to handle
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  on<T = unknown>(type: MessageType | string, handler: MessageHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    this.handlers.get(type)!.add(handler as GenericHandler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handler as GenericHandler);
        if (handlers.size === 0) {
          this.handlers.delete(type);
        }
      }
    };
  }

  /**
   * Register a handler for multiple message types
   *
   * @param types - Array of message types
   * @param handler - Handler function
   * @returns Unsubscribe function that removes all registrations
   */
  onMany<T = unknown>(types: (MessageType | string)[], handler: MessageHandler<T>): () => void {
    const unsubscribes = types.map(type => this.on(type, handler));

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }

  /**
   * Register a one-time handler that auto-removes after first call
   *
   * @param type - Message type to handle
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  once<T = unknown>(type: MessageType | string, handler: MessageHandler<T>): () => void {
    const wrappedHandler: GenericHandler = (payload) => {
      unsubscribe();
      return (handler as GenericHandler)(payload);
    };

    const unsubscribe = this.on(type, wrappedHandler);
    return unsubscribe;
  }

  /**
   * Set a default handler for unhandled message types
   *
   * @param handler - Default handler function
   */
  setDefaultHandler(handler: GenericHandler | null): void {
    this.defaultHandler = handler;
  }

  /**
   * Route a message to its handlers
   *
   * @param message - Message to route
   */
  async route(message: Message): Promise<void> {
    const handlers = this.handlers.get(message.type);

    if (!handlers || handlers.size === 0) {
      if (this.defaultHandler) {
        try {
          await Promise.resolve(this.defaultHandler(message));
        } catch (error) {
          console.error(`Default handler error for ${message.type}:`, error);
        }
      } else {
        console.warn(`No handler for message type: ${message.type}`);
      }
      return;
    }

    // Run all handlers concurrently
    const promises = Array.from(handlers).map(handler =>
      Promise.resolve(handler(message.payload)).catch(error => {
        console.error(`Handler error for ${message.type}:`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Check if a handler is registered for a message type
   */
  hasHandler(type: string): boolean {
    const handlers = this.handlers.get(type);
    return handlers !== undefined && handlers.size > 0;
  }

  /**
   * Get all registered message types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Remove all handlers for a specific type
   */
  removeAllHandlers(type: string): void {
    this.handlers.delete(type);
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.defaultHandler = null;
  }
}

/**
 * Create a pre-configured message router with common handlers
 */
export function createMessageRouter(): MessageRouter {
  const router = new MessageRouter();

  // Set up default handler for unknown messages
  router.setDefaultHandler((message) => {
    const msg = message as Message;
    console.debug(`Unhandled message type: ${msg.type}`);
  });

  return router;
}

/**
 * Helper to create typed handler registration
 */
export function createTypedRouter() {
  const router = new MessageRouter();

  return {
    router,

    // Typed handler registration methods
    onBlockExecute: (handler: MessageHandler<import('./types/protocol').BlockExecutePayload>) =>
      router.on(MessageTypes.BLOCK_EXECUTE, handler),

    onBlockKeyboard: (handler: MessageHandler<import('./types/protocol').BlockKeyboardPayload>) =>
      router.on(MessageTypes.BLOCK_KEYBOARD, handler),

    onBlockSave: (handler: MessageHandler<import('./types/protocol').BlockSavePayload>) =>
      router.on(MessageTypes.BLOCK_SAVE, handler),

    onFileChunkRequest: (handler: MessageHandler<import('./types/protocol').FileChunkRequestPayload>) =>
      router.onMany([
        MessageTypes.FILE_CHUNK_REQUEST,
        MessageTypes.FRONTEND_FILE_CHUNK_REQUEST
      ], handler),

    onFunctionCallRequest: (handler: MessageHandler<import('./types/protocol').FunctionCallRequestPayload>) =>
      router.onMany([
        MessageTypes.FUNCTION_CALL_REQUEST_AGENT,
        MessageTypes.FUNCTION_CALL_REQUEST_FRONT
      ], handler),

    onDirList: (handler: MessageHandler<import('./types/protocol').DirListPayload>) =>
      router.on(MessageTypes.EDGE_DIR_LIST, handler),

    onCd: (handler: MessageHandler<import('./types/protocol').CdPayload>) =>
      router.on(MessageTypes.EDGE_CD, handler),

    onGetFolders: (handler: MessageHandler<import('./types/protocol').GetFoldersPayload>) =>
      router.on(MessageTypes.GET_FOLDERS, handler),

    onWorkspaceRequest: (handler: MessageHandler<import('./types/protocol').WorkspaceRequestPayload>) =>
      router.on(MessageTypes.CTX_WORKSPACE_REQUEST, handler),

    onConfigUpdate: (handler: MessageHandler<import('./types/protocol').EdgeConfigUpdatePayload>) =>
      router.on(MessageTypes.EDGE_CONFIG_UPDATE, handler),
  };
}
