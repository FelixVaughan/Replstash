import { _debugger, Breakpoint, refreshTree } from './utils';
import StorageManager from './storageManager';

/**
 * Manages debugging sessions, breakpoints, and captured session output.
 * @class
 */
export default class SessionManager {
    
    /**
     * Singleton instance of SessionManager.
     * Ensures that only one instance of SessionManager is created and reused throughout the application.
     */
    private static _instance: SessionManager | null = null;

    /**
     * Stores session output messages, mapping message sequences to expressions.
     */
    private sessionOutput: Record<string, string> = {};

    /**
     * Stores all breakpoints managed by this session.
     */
    private breakpoints: Breakpoint[] = [];

    /**
     * The currently active breakpoint, if any.
     */
    private currentBreakpoint: Breakpoint | null = null;

     /**
     * Indicates if the session is currently capturing.
     */
    private capturing: boolean = false;

    /**
     * Indicates if capturing is paused.
     */
    private captureIsPaused: boolean = false;

    /**
     * Indicates if scripts are runnable.
     */
    private scriptsRunnable: boolean = false;

    /**
     * Reference to the storage manager for handling breakpoints.
     */
    private storageManager: StorageManager = StorageManager.instance;

    /**
     * Private constructor to ensure Singleton pattern.
     * Initializes event listeners for breakpoint changes.
     */
    private constructor() {
        _debugger.onDidChangeBreakpoints(({removed, changed}) => {

            // Handle removed breakpoints
            removed.forEach((brkt: any) => {
                const bId = brkt.id;
                this.storageManager.unlinkBreakpoint(bId);
            });

            // Handle changed breakpoints
            changed.forEach((brkt: any) => {
                const bId = brkt.id;
                const breakpoints: Breakpoint[] = this.storageManager.loadBreakpoints();
                const point: Breakpoint | undefined = breakpoints.find((b) => b.id === bId);
                if (point){
                    this.storageManager.changeBreakpointActivation(point, false);
                    this.storageManager.changeBreakpointLocation(point, brkt.location)
                }
            });

            // Refresh the UI tree to reflect changes
            refreshTree();
        });
    }

    /**
     * Returns the singleton instance of SessionManager.
     * @returns {SessionManager} The singleton instance.
     */
    static get instance(): SessionManager {
        if (!this._instance) {
            this._instance = new SessionManager();
        }
        return this._instance;
    }

    /**
     * Adds session output mapped by the message sequence.
     * @param {string} messageSeq - The sequence identifier of the message.
     * @param {string} expression - The output expression to store.
     */
    addSessionOutput(messageSeq: string, expression: string): void {
        this.sessionOutput[messageSeq] = expression;
    }

    /**
     * Retrieves all session output.
     * @returns {object} The session output.
     */
    getSessionOutput(): object {
        return this.sessionOutput;
    }

    /**
     * Sets the capturing state and resets the paused state.
     * @param {boolean} capturing - The capturing state to set.
     */
    setCapturing(capturing: boolean): void {
        this.capturing = capturing;
        this.captureIsPaused = false;
    }

    /**
     * Checks if capturing is currently paused.
     * @returns {boolean} True if capturing is paused, otherwise false.
     */
    capturePaused(): boolean {
        return this.captureIsPaused;
    }

    /**
     * Pauses capturing and sets the capturing state to false.
     * @param {boolean} paused - The paused state to set.
     */
    setCapturePaused(paused: boolean): void {
        this.captureIsPaused = paused;
        this.capturing = false;
    }

    /**
     * Adds a new breakpoint or sets the current one if it already exists.
     * @param {string} file - The file where the breakpoint is set.
     * @param {number} line - The line number of the breakpoint.
     * @param {number} column - The column number of the breakpoint.
     * @param {number} threadId - The thread ID associated with the breakpoint.
     * @param {string} bId - The unique ID of the breakpoint.
     */
    addBreakpoint(file: string, line: number, column: number, threadId: number, bId: string): void {
        const existing = this.breakpoints.find((b) => b.id === bId);
        if (!existing) {
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
            this.currentBreakpoint = existing;
        }
    }

    /**
     * Adds content to the current breakpoint.
     * @param {string} messageSeq - The sequence identifier of the message.
     * @param {string} expression - The content expression to add.
     */
    addBreakpointContent(messageSeq: string, expression: string): void {
        if (this.currentBreakpoint) {
            this.currentBreakpoint.content[messageSeq] = expression;
        }
    }

    /**
     * Removes content from the current breakpoint and session output.
     * @param {string} messageSeq - The sequence identifier of the message to remove.
     */
    removeBreakpointContent(messageSeq: string): void {
        if (this.currentBreakpoint) {
            delete this.currentBreakpoint.content[messageSeq];
            delete this.sessionOutput[messageSeq];
        }
    }

    /**
     * Checks if the session is currently capturing.
     * @returns {boolean} True if capturing, otherwise false.
     */
    isCapturing(): boolean {
        return this.capturing;
    }

    /**
     * Checks if there is any content captured for the current breakpoint.
     * @returns {boolean} True if content is captured, otherwise false.
     */
    contentCaptured(): boolean {
        return Boolean(Object.keys(this.currentBreakpoint?.content || []).length);
    }

    /**
     * Clears the captured content of the current breakpoint.
     */
    clearCapture(): void {
        if (this.contentCaptured()) {
            this.currentBreakpoint!.content = {};
        }
    }

    /**
     * Clears the last expression from the current breakpoint's content.
     * @returns {string | null} The cleared expression or null if no content was found.
     */
    clearLastExpression(): string | null {
        if (!this.contentCaptured()) return null;
        const content: Record<string, string> = this.currentBreakpoint!.content;
        const lastKey: string = Object.keys(content).pop()!;
        const result: string = content[lastKey];
        delete content[lastKey];
        return result;
    }

    /**
     * Sets whether scripts are runnable.
     * @param {boolean} runnable - The runnable state to set.
     */
    setScriptsRunnable(runnable: boolean): void {
        this.scriptsRunnable = runnable;
    }

    /**
     * Checks if scripts are runnable.
     * @returns {boolean} True if scripts are runnable, otherwise false.
     */
    scriptsAreRunnable(): boolean {
        return this.scriptsRunnable;
    }

    /**
     * Retrieves the current breakpoint.
     * @returns {Breakpoint | null} The current breakpoint or null.
     */
    getCurrentBreakpoint(): Breakpoint | null {
        return this.currentBreakpoint;
    }
}
