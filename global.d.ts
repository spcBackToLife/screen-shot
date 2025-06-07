declare global {
    interface Window {
        electronAPI: {
            send: (channel: string, data?: any) => void;
            receive: (channel: string, func: (...args: any[]) => void) => void;
        };
    }
}

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// This line is needed to make it a module.
export {};

declare global {
    interface Window {
        selectorAPI?: {
            send: (channel: string, data?: any) => void;
            receive: (channel: string, func: (...args: any[]) => void) => void;
        }
    }
}
