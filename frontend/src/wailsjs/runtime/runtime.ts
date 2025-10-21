// Wails Runtime Bindings Stub
// This file provides type-safe wrappers for Wails runtime functions

declare global {
    interface Window {
        runtime?: {
            EventsOn: (eventName: string, callback: (...args: any[]) => void) => () => void;
            EventsEmit: (eventName: string, ...args: any[]) => void;
            Quit: () => void;
            WindowMinimise: () => void;
            WindowToggleMaximise: () => void;
        };
    }
}

export function EventsOn(eventName: string, callback: (...args: any[]) => void): () => void {
    if (window.runtime?.EventsOn) {
        return window.runtime.EventsOn(eventName, callback);
    }
    return () => {};
}

export function EventsEmit(eventName: string, ...args: any[]): void {
    window.runtime?.EventsEmit(eventName, ...args);
}

export function Quit(): void {
    window.runtime?.Quit();
}

export function WindowMinimise(): void {
    window.runtime?.WindowMinimise();
}

export function WindowToggleMaximise(): void {
    window.runtime?.WindowToggleMaximise();
}

