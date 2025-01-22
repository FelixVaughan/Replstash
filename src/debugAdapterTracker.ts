import SessionManager from './sessionManager';
import CommandHandler from './commandHandler';
import StorageManager from './storageManager';
import {
    _debugger, 
    Breakpoint, 
    showInformationMessage, 
    Script,
    evaluateScripts,
} from './utils';
import * as vscode from 'vscode';

/**
 * Manages interaction with the debug adapter, including tracking messages and events.
 * Handles integration with session management, breakpoint management, and script evaluation.
 * @class DebugAdapterTracker
 */
export default class DebugAdapterTracker {

    /**
     * Manages the related state of the current debugging session.
     */
    private  sessionManager: SessionManager;

    /**
     * Handles commands and user interactions.
     */
    private commandHandler: CommandHandler;

    /**
     * Manages storage and persistence of breakpoints and scripts.
     */
    private storageManager: StorageManager;

    /**
     * Initializes a new instance of DebugAdapterTracker.
     * Sets up event listeners for command handling.
     * @param {CommandHandler} commandHandler - The command handler instance.
     */
    constructor(commandHandler: CommandHandler) {
        this.sessionManager = SessionManager.instance;
        this.storageManager = StorageManager.instance;
        this.commandHandler = commandHandler;

        // Listen for capture events
        this.commandHandler.on('captureStarted', () => {
            this.sessionManager.setCapturing(true);
        });
        this.commandHandler.on('captureStopped', () => {
            this.sessionManager.setCapturing(false);
        });
    }

    /**
     * Handles incoming messages from the debug adapter.
     * Processes REPL expressions during captures.
     * @param {any} message - The message received from the debug adapter.
     * @returns {Promise<void>}
     */
    onWillReceiveMessage = async (message: any): Promise<void> => {
        if (this.sessionManager.isCapturing() && message.arguments?.context === 'repl') {
            const expression: string = message.arguments.expression;
            this.sessionManager.addSessionOutput(message.seq, expression);
            this.sessionManager.addBreakpointContent(message.seq, expression);
        }
    };

    /**
     * Handles messages sent by the debug adapter.
     * Processes responses, breakpoint stops, and continuation events.
     * @param {any} message - The message sent by the debug adapter.
     * @returns {Promise<void>}
     */
    onDidSendMessage = async (message: any): Promise<void> => {
        // Handle failed evaluations
        if (this.sessionManager.isCapturing() && message.type === 'response' && message.command === 'evaluate') {
            if (!message?.success) {
                this.sessionManager.removeBreakpointContent(message.request_seq);
            }
        }

        // Handle breakpoint stops
        if (
            message.type === 'event' && 
            message.event === 'stopped' && 
            ['breakpoint', 'break'].includes(message.body.reason)
        ) {
            const activeSession = _debugger?.activeDebugSession;5
            if (!activeSession) return;

            const stackTraceResponse: any = await activeSession.customRequest('stackTrace', {
                threadId: message.body.threadId,
            });

            // Get the top frame of the stack and its location metadata
            if (stackTraceResponse?.stackFrames.length < 1) return;
            const topFrame: Record<string, any> = stackTraceResponse.stackFrames[0];
            const source: string = topFrame.source.path;
            const line: number = topFrame.line;
            const column: number = topFrame.column;
            const threadId: number = message.body.threadId;

            //Get the vscode breakpoint currently hit using the location metadata
            const vscodeBreakpoint = _debugger.breakpoints.find((bp) => {
                if (bp instanceof vscode.SourceBreakpoint) {
                    return (
                        bp.location.uri.fsPath === source
                        && bp.location.range.start.line + 1 === line 
                        // && bp.location.range.start.character + 1 === column 
                    );
                    // NOTE: Above commment for compatability with bash debugger
                }
                return false;
            });

            // Add the breakpoint to the session manager
            const bId: string = vscodeBreakpoint!.id;
            this.sessionManager.addBreakpoint(source, line, column, threadId, bId);
            this.commandHandler.setStoppedOnBreakpoint(true);

            if (this.sessionManager.scriptsAreRunnable()) {
                
                /**
                 * Find the possibly existing breakpoint in the storage manager,
                 * run its active scripts
                 */
                const loadedBreakpoints: Breakpoint[] = this.storageManager.loadBreakpoints();
                const existingBreakpoint = loadedBreakpoints.find((b: Breakpoint) => b.id === bId);
                if (existingBreakpoint){
                    const scripts: Script[] = existingBreakpoint?.scripts || [];
                    await evaluateScripts(
                        scripts.filter(s => s.active), threadId
                    );
                }

            }
        }

        // Handle continued execution
        if (message.type === 'event' && message.event === 'continued') {
            this.commandHandler.setStoppedOnBreakpoint(false);
            if (this.sessionManager.isCapturing() || this.sessionManager.capturePaused()) {
                this.commandHandler.stopCapture(true);
            }
            showInformationMessage('Debugger resumed from breakpoint.');
        }
    };

    /**
     * Handles errors encountered by the debug adapter.
     * Logs the error to the console.
     * @param {any} error - The error encountered.
     */
    onError = (error: any): void => {
        console.error(`Debug Adapter Tracker Error: ${error}`);
    };

    /**
     * Handles the debug adapter's exit event.
     * Logs the exit code and signal.
     * @param {number} code - The exit code of the debug adapter.
     * @param {any} signal - The signal received by the debug adapter.
     */
    onExit = (code: number, signal: any): void => {
        console.log(`Debug Adapter exited with code: ${code}, signal: ${signal}`);
    };
}
