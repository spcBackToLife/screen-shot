declare global {
    interface Window {
        electronAPI: {
            send: (channel: string, data?: any) => void;
            receive: (channel: string, func: (...args: any[]) => void) => void;
        };
    }
}

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
