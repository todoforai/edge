import { create } from 'zustand';

// Export the interface
export interface WSMessage {
  type: string;
  payload: any;
  timestamp?: number;
}

interface WSMessageState {
  messages: WSMessage[];
  isVisible: boolean;
  addMessage: (message: WSMessage) => void;
  clearMessages: () => void;
  toggleVisibility: () => void;
}

export const useWSMessageStore = create<WSMessageState>((set) => ({
  messages: [],
  isVisible: true,

  addMessage: (message: WSMessage) =>
    set((state) => {
      // Unwrap ws_message type messages
      let processedMessage = message;

      if (message.type === 'ws_message' && message.payload && typeof message.payload === 'object') {
        // Unwrap the nested message
        processedMessage = {
          type: 'ws::' + (message.payload.type || 'unknown'),
          payload: message.payload.payload,
          timestamp: message.timestamp,
        };
      } else {
        // Add timestamp if not present
        processedMessage = {
          ...message,
          timestamp: message.timestamp,
        };
      }

      return {
        messages: [processedMessage, ...state.messages], // Keep only the last 100 messages
      };
    }),

  clearMessages: () => set({ messages: [] }),

  toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
}));
