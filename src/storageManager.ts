import * as vscode from 'vscode';
import fs from 'fs';
import path  from 'path';
import { Breakpoint, ScriptsMetaData, isValidFilename } from './utils';
import {
    window, 
    Script, 
    refreshTree, 
    showInformationMessage,
    getCurrentTimestamp,
    showErrorMessage,
} from './utils';

type FileMetadata = {
    size: number;
    birthtime: Date;
    mtime: Date;
};

export default class StorageManager {

    private storagePath: string = "";
    private context: vscode.ExtensionContext | null = null;
    private loadedBreakpoints: Breakpoint[] = [];
    private static _instance: StorageManager | null = null;

    private constructor() {}

    static get instance(): StorageManager {
        if (!this._instance) { 
            return this._instance = new StorageManager();
        }
        return this._instance;
    }

    static setContext = (context: vscode.ExtensionContext): void => {
        const instance: StorageManager = this.instance;
        instance.storagePath = context?.storageUri?.fsPath || "";
        instance.context = context;
        
        // Ensure the base directory exists
        if (!instance.storagePath) {
            return;
        }

        if (!fs.existsSync(instance.storagePath)) {
            fs.mkdirSync(instance.storagePath, { recursive: true });
        }

        // Subdirectories to create
        const subdirs: string[] = ['session', 'scripts'];

        subdirs.forEach((dir: string) => {
            const fullPath: string = path.join(instance.storagePath, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
        instance.loadBreakpoints();
    }


    // Save the contents to a file
    saveToFile = (fullPath: string, content: string): void => {
        fs.writeFileSync(fullPath, content);
    }

    // Read contents from a file
    readFromFile = (filename: string): string | null => {
        const filePath: string = path.join(this.storagePath, filename);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
        } else {
            showErrorMessage(`File not found: ${filePath}`);
            return null;
        }
    }

    //save breakpoint
    saveBreakpoint = (bp: Breakpoint, fileName: string): void => {
        const content: string = Object.values(bp.content).join('\n');
        const fullPath: string = path.join(this.storagePath, 'scripts', fileName);
        this.saveToFile(fullPath, content);
        this.upsertBreakpointScripts(bp, fullPath);
    }

    updateBreakpoints = (breakpoints: Breakpoint[]) => {
        this.context?.workspaceState.update('breakpoints', breakpoints);
        this.loadBreakpoints(); //refresh
        refreshTree();
    }

    // Update record
    upsertBreakpointScripts = (bp: Breakpoint, fullPath: string): void => {
        const loadedBreakpoints: Breakpoint[] = this.loadBreakpoints();
        const existingBreakpoint: Breakpoint | undefined = loadedBreakpoints.find((b: Breakpoint) => b.id === bp.id);
        if (existingBreakpoint) {
            existingBreakpoint.scripts.push({ uri: fullPath, active: false });
            existingBreakpoint.modifiedAt = getCurrentTimestamp();
        } else {
            bp.scripts.push({ uri: fullPath, active: true });
            bp.createdAt = getCurrentTimestamp();
            loadedBreakpoints.push(bp);
        }
        this.updateBreakpoints(loadedBreakpoints);
    }

    // Load all breakpoints
    loadBreakpoints = (): Breakpoint[] => {
        this.loadedBreakpoints = this.context?.workspaceState.get('breakpoints', []) || [];
        return this.loadedBreakpoints;
    }

    getLoadedBreakpoints = (): Breakpoint[] => {
        return this.loadedBreakpoints;
    }

    // Save session output
    saveSessionOutput = (sessionOutput: string, sessionId: string): void => {
        const content: string = Object.values(sessionOutput).join('\n');
        const sessionFilename: string = `${sessionId}_${getCurrentTimestamp()}`;
        const fullPath: string = path.join(this.storagePath, 'session', sessionFilename);
        this.saveToFile(fullPath, content);
    }

    fileExists = (filename: string): boolean => {
        const paths: [string, string] = ['session', 'scripts'].map(
            (dir: string): string => {
                return path.join(this.storagePath, dir, filename);
            }
        ) as [string, string];
    
        const [sessionPath, breakpointsPath] = paths;
        
        return fs.existsSync(sessionPath) || fs.existsSync(breakpointsPath);
    }
    

    scriptMetaData(): ScriptsMetaData[] {
        const _formatDate = (date: Date): string => {
            return date.toLocaleString('en-US', {
                timeZoneName: 'short',
            });
        }

        const scriptsPath: string = path.join(this.storagePath, 'scripts');
        return fs.readdirSync(scriptsPath).map((file: string) => {
            const fullPath: string = path.join(scriptsPath, file);
            const { size, birthtime: _createdAt, mtime: _modifiedAt }: FileMetadata = fs.statSync(fullPath);
            const [createdAt, modifiedAt]: [string, string] = [_createdAt, _modifiedAt].map(_formatDate) as [string, string];
            return { fileName: file, fullPath, size, createdAt, modifiedAt };
        });
    }
    
    openScript(fileName: string) {
        const fullPath: string = path.join(this.storagePath, 'scripts', fileName);
        vscode.workspace.openTextDocument(fullPath).then((document: vscode.TextDocument) => {
            window.showTextDocument(document);
        });
    }

    deleteScript(fileName: string) {
        const fullPath: string = path.join(this.storagePath, 'scripts', fileName);
        fs.unlinkSync(fullPath);

        const loadedBreakpoints: Breakpoint[] = this.loadBreakpoints();
        const updatedBreakpoints: Breakpoint[] = loadedBreakpoints.filter(bp => {
            const updatedScripts: Script[] = bp.scripts.filter((s: Script) => s.uri !== fullPath);
            bp.scripts = updatedScripts;
            return bp.scripts.length > 0; // Remove if no scripts are left
        });
        this.updateBreakpoints(updatedBreakpoints);
    }

    renameScript = (oldFilename: string, newFilename: string): void => {
        const [oldUri, newUri] = [oldFilename, newFilename].map(filename =>
            path.join(this.storagePath, 'scripts', filename)
        );

        if (!isValidFilename(newFilename)) {
            showErrorMessage(`Invalid filename: ${newFilename}`);
            return;
        }
        if (fs.existsSync(newUri)) {
            showErrorMessage(`File already exists: ${newUri}`);
            return;
        }

        try {
            fs.renameSync(oldUri, newUri);
            this.updateBreakpoints(this.loadBreakpoints().map((bp: Breakpoint) => {
                bp.scripts.forEach((script) => {
                    if (script.uri === oldUri) {
                        script.uri = newUri;
                    }
                });
                return bp;
            }));
        } catch(err) {
            showErrorMessage(`Error renaming file: ${oldFilename} -> ${newFilename}`);
        }
        showInformationMessage(`Renamed: ${newFilename}`);
    }

    removeBreakpointScript = (breakpoint: Breakpoint, uri: string): void => {
        const loadedBreakpoints: Breakpoint[] = this.loadBreakpoints();
        const updatedBreakpoints: Breakpoint[] = loadedBreakpoints.map((bp: Breakpoint) => {
            if (bp.id === breakpoint.id) {
                bp.scripts = bp.scripts.filter((s: Script) => s.uri !== uri);
            }
            return bp;
        });
        this.updateBreakpoints(updatedBreakpoints);
    }

    removeBreakpoint = (breakpoint: Breakpoint): void => { 
        const loadedBreakpoints: Breakpoint[] = this.loadBreakpoints();
        const updatedBreakpoints: Breakpoint[] = loadedBreakpoints.filter((bp: Breakpoint) => bp.id !== breakpoint.id);
        this.updateBreakpoints(updatedBreakpoints);
    }

    unlinkBreakpoint = (bId: string): void => {
        const loadedBreakpoints: Breakpoint[] = this.loadBreakpoints();
        this.updateBreakpoints(loadedBreakpoints.map((bp: Breakpoint) => {
            if (bp.id === bId) {
                bp.linked = false;
            }
            return bp;
        }));
    }


    purgeBreakpoints = (): void => {
        this.updateBreakpoints([]);
    }

    purgeScripts = (): void => {
        const breakpointsPath: string = path.join(this.storagePath, 'scripts');
        fs.readdirSync(breakpointsPath).forEach((file: string) => {
            fs.unlinkSync(path.join(breakpointsPath, file));
        });
        const loadedBreakpoints: Breakpoint[] = this.loadBreakpoints();
        loadedBreakpoints.forEach((bp: Breakpoint) => {bp.scripts = []});
        this.updateBreakpoints(loadedBreakpoints);
    }

    purgeAll = (): void => {
        this.purgeBreakpoints();
        this.purgeScripts();
    }

    
    changeScriptActivation = (breakpoint: Breakpoint, script: Script, active: boolean) => {
        const loaded: Breakpoint[] = this.loadBreakpoints();
        breakpoint.scripts.forEach((s: Script) => {
            if (s.uri === script.uri) {
                s.active = active;
            }
        });
        this.updateBreakpoints(loaded.map((bp: Breakpoint) => bp.id === breakpoint.id ? breakpoint : bp));
    }

    changeBreakpointActivation = (breakpoint: Breakpoint, active: boolean) => {
        const loaded: Breakpoint[] = this.loadBreakpoints();
        breakpoint.active = breakpoint.linked && active;
        this.updateBreakpoints(loaded.map((bp: Breakpoint) => bp.id === breakpoint.id ? breakpoint : bp));
    }

    changeBreakpointLocation = (breakpoint: Breakpoint, location: any): void => {

        //@ts-ignore
        const loaded: Breakpoint[] = this.loadBreakpoints();
        this.updateBreakpoints(loaded.map((bp: Breakpoint) => {
            if (bp.id === breakpoint.id) {
                breakpoint.file = location.uri.fsPath;
                breakpoint.line = location.range.start.line;
                breakpoint.column = location.range.start.character;

            }
            return bp;
        }));
        console.log(breakpoint, location);

    }

    getScriptContent = (uri: string): string | null => {
        if (fs.existsSync(uri)) {
            return fs.readFileSync(uri, 'utf8');
        }
        return null;
    }

    assignScriptsToBreakpoint = (breakpoint: Breakpoint, scripts: string[]): void => {
        const loaded: Breakpoint[] = this.loadBreakpoints();
        const updatedBreakpoints: Breakpoint[] = loaded.map((bp: Breakpoint) => {
            if (bp.id === breakpoint.id) {
                const newScripts : string[] = scripts.filter((uri: string) => {
                    return !bp.scripts.some((s: Script) => s.uri === uri)
                });
                bp.scripts.push(...newScripts.map((uri: string) => ({ uri, active: false })));
            }
            return bp;
        });
        this.updateBreakpoints(updatedBreakpoints);
    }

}