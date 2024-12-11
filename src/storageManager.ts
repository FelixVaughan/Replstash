import * as vscode from 'vscode';
import fs from 'fs';
import path from 'path';
import { Breakpoint, ScriptsMetaData } from './utils';
import {
    window,
    Script,
    refreshTree,
    showInformationMessage,
    getCurrentTimestamp,
    showErrorMessage,
    InvalidReason,
} from './utils';

/**
 * Represents metadata for a file.
 * @typedef {Object} FileMetadata
 * @property {number} size - The size of the file in bytes.
 * @property {Date} birthtime - The creation time of the file.
 * @property {Date} mtime - The last modification time of the file.
 */
type FileMetadata = {
    size: number;
    birthtime: Date;
    mtime: Date;
};

/**
 * Manages the storage of breakpoints, scripts, and session data.
 * Provides methods for saving, retrieving, and organizing data within the extension.
 * @class
 */
export default class StorageManager {
    /** Path to the storage directory for the extension. */
    private storagePath: string = "";

    /** VSCode extension context for managing workspace state. */
    private context: vscode.ExtensionContext | null = null;

    /** Array of all loaded breakpoints. */
    private loadedBreakpoints: Breakpoint[] = [];

    /** Singleton instance of StorageManager. */
    private static _instance: StorageManager | null = null;

    /** Private constructor to enforce the Singleton pattern. */
    private constructor() {}

    /**
     * Retrieves the singleton instance of StorageManager.
     * If no instance exists, a new one is created.
     * @returns {StorageManager} The singleton instance.
     */
    static get instance(): StorageManager {
        if (!this._instance) {
            this._instance = new StorageManager();
        }
        return this._instance;
    }

    /**
     * Sets the storage context for the extension and initializes the directories.
     * @param {vscode.ExtensionContext} context - The VSCode extension context.
     */
    static setContext(context: vscode.ExtensionContext): void {
        const instance: StorageManager = this.instance;
        instance.storagePath = context?.storageUri?.fsPath || "";
        instance.context = context;

        if (!instance.storagePath) return;

        // Ensure the storage directory exists
        if (!fs.existsSync(instance.storagePath)) {
            fs.mkdirSync(instance.storagePath, { recursive: true });
        }

        // Subdirectories to create
        const subdirs: string[] = ['session', 'scripts'];

        subdirs.forEach((dir) => {
            const fullPath = path.join(instance.storagePath, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });

        instance.loadBreakpoints();
    }

    /**
     * Saves the provided content to a file at the specified path.
     * @param {string} fullPath - The full file path where the content will be saved.
     * @param {string} content - The content to save in the file.
     */
    private saveToFile(fullPath: string, content: string): void {
        fs.writeFileSync(fullPath, content);
    }

    /**
     * Validates a filename against reserved names and invalid characters.
     * 
     * @param name - The filename to validate.
     * @returns {boolean} True if the filename is valid, false otherwise.
     */
    isValidFilename (name: string): boolean {
        const invalidChars: RegExp = /[<>:"\/\\|?*\x00-\x1F]/g;
        const reservedNames: RegExp = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
        return !invalidChars.test(name) && !reservedNames.test(name) && name.length <= 255;
    };

    /**
     * Saves a breakpoint and its content to a file.
     * @param {Breakpoint} bp - The breakpoint to save.
     * @param {string} fileName - The name of the file to save the breakpoint content in.
     */
    persistCaptureContent(
        bp: Breakpoint, 
        fileName: string, 
        content: string | null = null
    ): InvalidReason {

        if (!this.isValidFilename(fileName)) {
            return InvalidReason.InvalidFileName;
        }
        if (this.fileExists(fileName)) {
            return InvalidReason.FileExists;
        }

        content = content || Object.values(bp.content).join('\n');
        const fullPath = path.join(this.storagePath, 'scripts', fileName);
        this.saveToFile(fullPath, content);
        this.upsertBreakpointScripts(bp, fullPath);
        return InvalidReason.None;
    }

    /**
     * Updates the breakpoints stored in the extension workspace state.
     * @param {Breakpoint[]} breakpoints - The list of updated breakpoints.
     */
    private updateBreakpoints(breakpoints: Breakpoint[]): void {
        this.context?.workspaceState.update('breakpoints', breakpoints);
        this.loadBreakpoints();
        refreshTree();
    }

    /**
     * Adds or updates scripts for a given breakpoint.
     * @param {Breakpoint} bp - The breakpoint to update.
     * @param {string} fullPath - The full file path of the script.
     */
    private upsertBreakpointScripts(bp: Breakpoint, fullPath: string): void {
        const loadedBreakpoints = this.loadBreakpoints();
        const existingBreakpoint = loadedBreakpoints.find((b) => b.id === bp.id);
        const script = { uri: fullPath, bId: bp.id, error: false};
        if (existingBreakpoint) {
            existingBreakpoint.scripts.push({...script, active: true });
            existingBreakpoint.modifiedAt = getCurrentTimestamp();
        } else {
            bp.scripts.push({...script, active: false });
            bp.createdAt = getCurrentTimestamp();
            loadedBreakpoints.push(bp);
        }
        this.updateBreakpoints(loadedBreakpoints);
    }

    /**
     * Loads all breakpoints from the workspace state.
     * @returns {Breakpoint[]} The list of loaded breakpoints.
     */
    loadBreakpoints(): Breakpoint[] {
        this.loadedBreakpoints = this.context?.workspaceState.get('breakpoints', []) || [];
        return this.loadedBreakpoints;
    }

    /**
     * Checks if a file exists in the session or scripts directory.
     * @param {string} filename - The name of the file to check.
     * @returns {boolean} True if the file exists, otherwise false.
     */
    fileExists(filename: string): boolean {
        const paths = ['session', 'scripts'].map((dir) =>
            path.join(this.storagePath, dir, filename)
        );
        return fs.existsSync(paths[0]) || fs.existsSync(paths[1]);
    }

    /**
     * Retrieves metadata for all scripts in the scripts directory.
     * @returns {ScriptsMetaData[]} The metadata for each script.
     */
    scriptMetaData(): ScriptsMetaData[] {
        const _formatDate = (date: Date): string =>
            date.toLocaleString('en-US', { timeZoneName: 'short' });

        const scriptsPath: string = path.join(this.storagePath, 'scripts');
        return fs.readdirSync(scriptsPath).map((file: string) => {
            const fullPath: string = path.join(scriptsPath, file);
            const { size, birthtime: _createdAt, mtime: _modifiedAt }: FileMetadata = fs.statSync(fullPath);
            const [createdAt, modifiedAt]: [string, string] = [_createdAt, _modifiedAt].map(_formatDate) as [string, string];
            return { fileName: file, fullPath, size, createdAt, modifiedAt };
        });
    }

    /**
     * Opens a script file in the VSCode editor.
     * @param {string} fileName - The name of the script file to open.
     */
    openScript(fileName: string): void {
        const fullPath = path.join(this.storagePath, 'scripts', fileName);
        vscode.workspace.openTextDocument(fullPath).then((document) => {
            window.showTextDocument(document);
        });
    }

    /**
     * Deletes a script file and removes its references from breakpoints.
     * @param {string} fileName - The name of the file to delete.
     */
    deleteScript(fileName: string): void {
        const fullPath: string = path.join(this.storagePath, 'scripts', fileName);
        fs.unlinkSync(fullPath);

        const loadedBreakpoints: Breakpoint[] = this.loadBreakpoints();
        const updatedBreakpoints = loadedBreakpoints.filter((bp) => {
            bp.scripts = bp.scripts.filter((s) => s.uri !== fullPath);
            return bp.scripts.length > 0;
        });
        this.updateBreakpoints(updatedBreakpoints);
    }

    /**
     * Renames a script file and updates its references in breakpoints.
     * @param {string} oldFilename - The current file name.
     * @param {string} newFilename - The new file name.
     */
    renameScript(oldFilename: string, newFilename: string): void {
        const [oldUri, newUri] = [oldFilename, newFilename].map((filename) =>
            path.join(this.storagePath, 'scripts', filename)
        );
        if (!this.isValidFilename(newFilename)) {
            showErrorMessage(`Invalid filename: ${newFilename}`);
            return;
        }
        if (fs.existsSync(newUri)) {
            showErrorMessage(`File already exists: ${newUri}`);
            return;
        }

        try {
            fs.renameSync(oldUri, newUri);
            const updatedBreakpoints = this.loadBreakpoints().map((bp) => {
                bp.scripts.forEach((s) => {
                    if (s.uri === oldUri) s.uri = newUri;
                });
                return bp;
            });
            this.updateBreakpoints(updatedBreakpoints);
            showInformationMessage(`Renamed: ${newFilename}`);
        } catch (err) {
            showErrorMessage(`Error renaming file: ${oldFilename} -> ${newFilename}`);
        }
    }

    /**
     * Removes a script from a specific breakpoint.
     * Updates the breakpoint's script list and persists the changes.
     * @param {Breakpoint} breakpoint - The breakpoint to update.
     * @param {string} uri - The URI of the script to remove.
     */
    removeBreakpointScript(breakpoint: Breakpoint, uri: string): void {
        const loadedBreakpoints: Breakpoint[] = this.loadBreakpoints();
        const updatedBreakpoints: Breakpoint[] = loadedBreakpoints.map((bp) => {
            if (bp.id === breakpoint.id) {
                bp.scripts = bp.scripts.filter((s: Script) => s.uri !== uri);
            }
            return bp;
        });
        this.deleteScript(path.basename(uri));
        this.updateBreakpoints(updatedBreakpoints);
    }

    /**
     * Removes a specific breakpoint entirely.
     * @param {Breakpoint} breakpoint - The breakpoint to remove.
     */
    removeBreakpoint(breakpoint: Breakpoint): void {
        const loadedBreakpoints: Breakpoint[] = this.loadBreakpoints();
        const updatedBreakpoints: Breakpoint[] = loadedBreakpoints.filter(
            (bp) => bp.id !== breakpoint.id
        );
        this.updateBreakpoints(updatedBreakpoints);
    }

    /**
     * Unlinks a breakpoint by setting its `linked` property to false.
     * @param {string} bId - The ID of the breakpoint to unlink.
     */
    unlinkBreakpoint(bId: string): void {
        const loadedBreakpoints: Breakpoint[] = this.loadBreakpoints();
        this.updateBreakpoints(
            loadedBreakpoints.map((bp) => {
                if (bp.id === bId) bp.linked = false;
                return bp;
            })
        );
    }

    /**
     * Removes all stored breakpoints.
     * Clears the list of breakpoints in the workspace state.
     */
    purgeBreakpoints(): void {
        this.updateBreakpoints([]);
    }

    /**
     * Deletes all scripts from the storage directory and clears their references in breakpoints.
     */
    purgeScripts(): void {
        const scriptsPath = path.join(this.storagePath, 'scripts');
        fs.readdirSync(scriptsPath).forEach((file) => {
            fs.unlinkSync(path.join(scriptsPath, file));
        });
        const loadedBreakpoints: Breakpoint[] = this.loadBreakpoints();
        loadedBreakpoints.forEach(bp => bp.scripts = []);
        this.updateBreakpoints(loadedBreakpoints);
    }

    /**
     * Updates (persists) the loaded breakpoint.
     */
    updateLoadedBreakpoints(): void {
        if (!this.loadedBreakpoints.length) return;
        this.updateBreakpoints(this.loadedBreakpoints);
    }

    /**
     * Removes all breakpoints and scripts from storage.
     * Calls `purgeBreakpoints` and `purgeScripts` to clear both types of data.
     */
    purgeAll(): void {
        this.purgeBreakpoints();
        this.purgeScripts();
    }

    /**
     * Changes the activation state of a script within a specific breakpoint.
     * @param {Breakpoint} breakpoint - The breakpoint containing the script.
     * @param {Script} script - The script to update.
     * @param {boolean} active - The new activation state.
     */
    changeScriptActivation(breakpoint: Breakpoint, script: Script, active: boolean): void {
        const loaded: Breakpoint[] = this.loadBreakpoints();
        breakpoint.scripts.forEach((s) => {
            if (s.uri === script.uri) {
                s.active = active;
            }
        });
        this.updateBreakpoints(
            loaded.map((bp) => (bp.id === breakpoint.id ? breakpoint : bp))
        );
    }

    /**
     * Changes the activation state of a breakpoint.
     * The state is only active if the breakpoint is also linked.
     * @param {Breakpoint} breakpoint - The breakpoint to update.
     * @param {boolean} active - The new activation state.
     */
    changeBreakpointActivation(breakpoint: Breakpoint, active: boolean): void {
        const loaded: Breakpoint[] = this.loadBreakpoints();
        breakpoint.active = breakpoint.linked && active;
        this.updateBreakpoints(
            loaded.map((bp) => (bp.id === breakpoint.id ? breakpoint : bp))
        );
    }

    /**
     * Updates the location of a breakpoint.
     * Modifies the file, line, and column properties based on the new location.
     * @param {Breakpoint} breakpoint - The breakpoint to update.
     * @param {any} location - The new location details.
     */
    changeBreakpointLocation(breakpoint: Breakpoint, location: any): void {
        const loaded: Breakpoint[] = this.loadBreakpoints();
        this.updateBreakpoints(
            loaded.map((bp) => {
                if (bp.id === breakpoint.id) {
                    breakpoint.file = location.uri.fsPath;
                    breakpoint.line = location.range.start.line;
                    breakpoint.column = location.range.start.character;
                }
                return bp;
            })
        );
        console.log(breakpoint, location);
    }

    /**
     * Retrieves the content of a script file.
     * @param {string} uri - The URI of the script to read.
     * @returns {string | null} The content of the script, or null if the file doesn't exist.
     */
    getScriptContent(uri: string): string | null {
        if (fs.existsSync(uri)) {
            return fs.readFileSync(uri, 'utf8');
        }
        return null;
    }

    /**
     * Copy scripts to a specific breakpoint.
     * Filters out scripts that are already assigned and updates the breakpoint's script list.
     * @param {Breakpoint} breakpoint - The breakpoint to update.
     * @param {string[]} scripts - The URIs of the scripts to assign.
     */
    assignScriptsToBreakpoint(breakpoint: Breakpoint, scripts: string[]): void {
        const loaded: Breakpoint[] = this.loadBreakpoints();
        const updatedBreakpoints: Breakpoint[] = loaded.map((bp) => {
            if (bp.id === breakpoint.id) {
                const newScripts = scripts.filter((uri) => {
                    return !bp.scripts.some((s: Script) => s.uri === uri);
                });
                
                /**
                 * For each new script, copy the content to a new file 
                 * and add the new file to the breakpoint
                 */
                newScripts.forEach((uri) => {
                    const content: string | null = this.getScriptContent(uri);
                    if (content) {
                        const newFileName = `${path.basename(uri)} - copy - ${getCurrentTimestamp()}`;
                        this.persistCaptureContent(breakpoint, newFileName, content);
                    }
                });


            }
            return bp;
        });
        this.updateBreakpoints(updatedBreakpoints);
    }

}
