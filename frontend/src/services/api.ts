export type EditorTheme =
    | "default"
    | "3024-day"
    | "3024-night"
    | "ambiance"
    | "ambiance-mobile"
    | "base16-dark"
    | "base16-light"
    | "blackboard"
    | "cobalt"
    | "eclipse"
    | "elegant"
    | "erlang-dark"
    | "lesser-dark"
    | "mbo"
    | "mdn-like"
    | "midnight"
    | "monokai"
    | "neat"
    | "neo"
    | "night"
    | "paraiso-dark"
    | "paraiso-light"
    | "pastel-on-dark"
    | "rubyblue"
    | "solarized"
    | "the-matrix"
    | "tomorrow-night-eighties"
    | "twilight"
    | "vibrant-ink"
    | "xq-dark"
    | "xq-light";

export type PreviewTheme = "default" | "dark";

export interface DirectoryEntry {
    name: string;
    path: string;
    isDir: boolean;
    hasChildren?: boolean;
    children?: DirectoryEntry[];
}

export interface Settings {
    theme: "default" | "dark";
    editorTheme: EditorTheme;
    previewTheme: PreviewTheme;
    autoSave: boolean;
    fontSize: number;
    wordWrap: boolean;
    lastFile: string;
}

declare global {
    interface Window {
        go?: Record<
            string,
            Record<string, Record<string, (...args: unknown[]) => Promise<any>>>
        >;
    }
}

export const DEFAULT_SETTINGS: Settings = {
    theme: "dark",
    editorTheme: "monokai",
    previewTheme: "default",
    autoSave: true,
    fontSize: 16,
    wordWrap: true,
    lastFile: "",
};

export const SAVE_CANCELLED_ERROR = "save cancelled";

function bindings() {
    const pkg = window.go?.app;
    if (!pkg) return null;
    const mod = pkg.App;
    if (!mod) return null;
    return mod as Record<string, (...args: unknown[]) => Promise<any>>;
}

export async function loadSettings(): Promise<Settings> {
    const backend = bindings();
    if (!backend?.LoadSettings) {
        return { ...DEFAULT_SETTINGS };
    }

    try {
        const result = await backend.LoadSettings();
        return { ...DEFAULT_SETTINGS, ...result } as Settings;
    } catch (error) {
        console.warn("loadSettings failed", error);
        return { ...DEFAULT_SETTINGS };
    }
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
    const backend = bindings();
    if (!backend?.SaveSettings) {
        return;
    }

    const merged: Settings = { ...DEFAULT_SETTINGS, ...settings } as Settings;
    try {
        await backend.SaveSettings(merged);
    } catch (error) {
        console.warn("saveSettings failed", error);
    }
}

export async function setActiveFile(path: string | null): Promise<void> {
    const backend = bindings();
    if (!backend?.SetActiveFile) {
        return;
    }

    try {
        await backend.SetActiveFile(path ?? "");
    } catch (error) {
        console.warn("SetActiveFile failed", error);
    }
}

export async function loadDirectoryEntries(
    path: string,
): Promise<DirectoryEntry[]> {
    const backend = bindings();
    if (!backend?.LoadDirectoryEntries) {
        return [];
    }

    try {
        const result = await backend.LoadDirectoryEntries(path);
        if (!Array.isArray(result)) {
            return [];
        }
        return result as DirectoryEntry[];
    } catch (error) {
        console.warn("LoadDirectoryEntries failed", error);
        return [];
    }
}

export async function openFileDialog(): Promise<void> {
    const backend = bindings();
    if (!backend?.OpenFileDialog) {
        return;
    }

    try {
        await backend.OpenFileDialog();
    } catch (error) {
        console.warn("OpenFileDialog failed", error);
    }
}

export async function openFolderDialog(): Promise<void> {
    const backend = bindings();
    if (!backend?.OpenFolderDialog) {
        return;
    }

    try {
        await backend.OpenFolderDialog();
    } catch (error) {
        console.warn("OpenFolderDialog failed", error);
    }
}

export async function showAboutDialog(): Promise<void> {
    const backend = bindings();
    if (!backend?.ShowAbout) {
        return;
    }

    try {
        await backend.ShowAbout();
    } catch (error) {
        console.warn("ShowAbout failed", error);
    }
}

export async function saveDocument(
    content: string,
    forceDialog = false,
): Promise<string> {
    const backend = bindings();
    if (!backend?.SaveDocument) {
        throw new Error("SaveDocument binding unavailable");
    }

    const result = await backend.SaveDocument(content, forceDialog);
    return (result ?? "") as string;
}

export async function loadDocument(path: string): Promise<string> {
    const backend = bindings();
    if (!backend?.LoadFile) {
        throw new Error("LoadFile binding unavailable");
    }

    const result = await backend.LoadFile(path);
    return (result ?? "") as string;
}

export async function createFile(path: string): Promise<boolean> {
    const backend = bindings();
    if (!backend?.CreateFile) {
        throw new Error("CreateFile binding unavailable");
    }

    try {
        const result = await backend.CreateFile(path);
        return result === true;
    } catch (error) {
        console.warn("CreateFile failed", error);
        return false;
    }
}

export async function backendLog(level: string, message: string): Promise<void> {
    const backend = bindings();
    if (!backend?.Log) {
        // Silently ignore if binding not available
        return;
    }
    try {
        await backend.Log(level, message);
    } catch {
        // ignore
    }
}

export async function createDirectory(path: string): Promise<boolean> {
    const backend = bindings();
    if (!backend?.CreateDirectory) {
        throw new Error("CreateDirectory binding unavailable");
    }

    try {
        const result = await backend.CreateDirectory(path);
        return result === true;
    } catch (error) {
        console.warn("CreateDirectory failed", error);
        return false;
    }
}

export async function deleteFile(path: string): Promise<boolean> {
    const backend = bindings();
    if (!backend?.DeleteFile) {
        throw new Error("DeleteFile binding unavailable");
    }

    try {
        const result = await backend.DeleteFile(path);
        return result === true;
    } catch (error) {
        console.warn("DeleteFile failed", error);
        return false;
    }
}

export async function renameFile(oldPath: string, newPath: string): Promise<boolean> {
    const backend = bindings();
    if (!backend?.RenameFile) {
        throw new Error("RenameFile binding unavailable");
    }

    try {
        const result = await backend.RenameFile(oldPath, newPath);
        return result === true;
    } catch (error) {
        console.warn("RenameFile failed", error);
        return false;
    }
}
