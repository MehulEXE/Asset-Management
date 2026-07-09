/// <reference types="vite/client" />

declare module '@novnc/novnc' {
  interface RFBEventMap {
    connect: CustomEvent;
    disconnect: CustomEvent<{ clean: boolean }>;
    securityfailure: CustomEvent<{ status: number; reason: string }>;
    credentialsrequired: CustomEvent<{ types: string[] }>;
    desktopname: CustomEvent<{ name: string }>;
    clipboard: CustomEvent<{ text: string }>;
    bell: CustomEvent;
  }

  interface RFBOptions {
    credentials?: Record<string, string>;
    shared?: boolean;
    repeaterID?: string;
    wsProtocols?: string[];
  }

  class RFB extends EventTarget {
    constructor(target: HTMLElement, urlOrChannel: string, options?: RFBOptions);
    disconnect(): void;
    sendCredentials(creds: Record<string, string>): void;
    sendKey(keysym: number, code: string, down: boolean): void;
    clipboardPasteFrom(text: string): void;
    scaleViewport: boolean;
    focusOnClick: boolean;
    viewOnly: boolean;
    addEventListener<K extends keyof RFBEventMap>(type: K, listener: (event: RFBEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  }

  export default RFB;
}
