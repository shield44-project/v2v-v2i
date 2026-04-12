export {};

declare global {
  interface Window {
    [key: string]: any;
    __v2xBridgeReady?: boolean;
  }
}
