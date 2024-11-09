import { _debugger, Breakpoint } from './utils';
import StorageManager from './storageManager';
export default class SessionManager {

    private static _instance: SessionManager | null = null;
    private sessionOutput: Record<string, string> = {};
    private breakpoints: Breakpoint[] = [];
    private currentBreakpoint: Breakpoint | null = null;
    private capturing: boolean = false;
    private captureIsPaused: boolean = false;
    private scriptsRunnable: boolean = false;
    private storageManager: StorageManager = StorageManager.instance; 

    private constructor() {
        //why does this run for every breakpoint with the same list of breakpoints?
        //How can we make activateable only if actual breakpoint is active 
        _debugger.onDidChangeBreakpoints((event: object) => {
            //@ts-ignore
            const removed = event.removed;
            removed.forEach((breakpoint: any) => {
                const bId = breakpoint.id;
                this.storageManager.unlinkBreakpoint(bId);
            });
        });        
    }

    static get instance(): SessionManager {
        if (!this._instance) { 
            return this._instance = new SessionManager();
        }
        return this._instance;
    }

    addSessionOutput = (messageSeq: string, expression: string): void => {
        this.sessionOutput[messageSeq] = expression;
    }

    getSessionOutput = (): object => this.sessionOutput;


    setCapturing = (capturing: boolean): void => {
        this.capturing = capturing;
        this.captureIsPaused = false;
    }

    capturePaused = (): boolean => this.captureIsPaused;

    setCapturePaused = (paused: boolean): void => {
        this.captureIsPaused = paused
        this.capturing = false;
    }

    constructBreakpointId = (
        file: string, 
        line: number, 
        column: number, 
        threadId: number
    ): string => `${file}_${line}_${column}_${threadId}`;
    

    addBreakpoint = (
        file: string, 
        line: number, 
        column: number, threadId: number,
        bId: string
    ): void => {
        const existingBreakpoint = this.breakpoints.find((b) => b.id === bId);
        if (!existingBreakpoint) {
            this.currentBreakpoint = {
                id: bId,
                threadId: threadId,
                line: line,
                active: true,
                column: column,
                file: file,
                linked: true,
                scripts: [],
                content: {},
            };
            this.breakpoints.push(this.currentBreakpoint);
        } else {
            this.currentBreakpoint = existingBreakpoint;
        }
    }

    addBreakpointContent = (messageSeq: string, expression: string): void => {
        if (this.currentBreakpoint) {
            this.currentBreakpoint.content[messageSeq] = expression;
        }
    }

    removeBreakpointContent = (messageSeq: string): void => {
        if (this.currentBreakpoint) {
            delete this.currentBreakpoint.content[messageSeq];
            delete this.sessionOutput[messageSeq];
        }
    }

    getBreakpoints = (): Breakpoint[] => {
        return this.breakpoints;
    }

    isCapturing = (): boolean => this.capturing;


    
    contentCaptured = (): boolean => {
        return Boolean(Object.keys(this.currentBreakpoint?.content || []).length);
    }
    
    clearCapture = (): void => {
        if(this.contentCaptured()) {
            this.currentBreakpoint!.content = {};
        }
    }

    clearLastExpression = (): string | null => {
        if (!this.contentCaptured()) return null;
        const content: Record<string, string> = this.currentBreakpoint!.content;
        const lastKey: string = Object.keys(content).pop()!;
        const result: string = content[lastKey];
        delete content[lastKey];
        return result;
    }

    setScriptsRunnable = (runnable: boolean): void => {
        this.scriptsRunnable = runnable;
    }

    scriptsAreRunnable = (): boolean => this.scriptsRunnable;

    getCurrentBreakpoint = (): Breakpoint | null => this.currentBreakpoint;

}