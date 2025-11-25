/// <reference types="vite/client" />

declare global {
  interface NavigatorUAData {
    platform: string;
  }

  interface Navigator {
    userAgentData?: NavigatorUAData;
  }
}

export {};
