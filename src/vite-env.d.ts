/// <reference types="vite/client" />

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    __peddiLoadedPixels?: { meta?: string; gads?: string; ga4?: string };
  }
}

export {};
