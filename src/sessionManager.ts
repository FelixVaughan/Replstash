import { Breakpoint } from './utils';
export default class SessionManager {

    private sessionOutput: Record<string, string> = {};
    private breakpoints: Breakpoint[] = [];
    private currentBreakpoint: Breakpoint | null = null;
    private capturing: boolean = false;
    private captureIsPaused: boolean = false;
    private scriptsRunnable: boolean = false;

    constructor() {}

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
    

    addBreakpoint = (file: string, line: number, column: number, threadId: number): void => {
        const breakpointId: string = this.constructBreakpointId(file, line, column, threadId);
        const existingBreakpoint: Breakpoint | undefined  = this.breakpoints.find((breakpoint) => 
            breakpoint.id === breakpointId
        );
        if (!existingBreakpoint) {
            this.currentBreakpoint = {
                id: breakpointId,
                threadId: threadId,
                line: line,
                active: true,
                column: column,
                file: file,
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

    discardCapture = (): void => {}

    setScriptsRunnable = (runnable: boolean): void => {
        this.scriptsRunnable = runnable;
    }

    scriptsAreRunnable = (): boolean => this.scriptsRunnable;

    resetCurrentBeakpointContent = (): void => {
        if (this.currentBreakpoint) {
            this.currentBreakpoint.content = {};
        }
    }   

    getCurrentBreakpoint = (): Breakpoint | null => this.currentBreakpoint;

}

// const breakpointDisposable = vscode.debug.onDidChangeBreakpoints(event => {
//     //use this to handle changes to breakpoints
//     vscode.DebugStackFrame
// });
