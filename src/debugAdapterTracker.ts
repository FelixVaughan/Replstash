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
class DebugAdapterTracker {

    private sessionManager: SessionManager;
    private commandHandler: CommandHandler;
    private storageManager: StorageManager;

    constructor(
        commandHandler: CommandHandler,
    ) {
        this.sessionManager = SessionManager.instance;
        this.commandHandler = commandHandler;
        this.storageManager = StorageManager.instance;
        this.commandHandler.on('captureStarted', () => {this.sessionManager.setCapturing(true)});
        this.commandHandler.on('captureStopped', () => {this.sessionManager.setCapturing(false)});
    }

    onWillReceiveMessage = async (message: any): Promise<void> => {
        if (this.sessionManager.isCapturing() && message.arguments?.context === 'repl') {
            const expression: string = message.arguments.expression;
            this.sessionManager.addSessionOutput(message.seq, expression);
            this.sessionManager.addBreakpointContent(message.seq, expression);
        }
    };

    onDidSendMessage = async (message: any): Promise<void> => {
        if (this.sessionManager.isCapturing() && message.type === 'response' && message.command === 'evaluate') {
            if (!message?.success) {
                this.sessionManager.removeBreakpointContent(message.request_seq);
            }
        }

        if (message.type === 'event' && message.event === 'stopped' && message.body.reason === 'breakpoint') {
            const activeSession = _debugger?.activeDebugSession;
            if (!activeSession) return;

            const stackTraceResponse: any = await activeSession.customRequest('stackTrace', {
                threadId: message.body.threadId,
            });

            if (stackTraceResponse?.stackFrames.length < 1) return 
            const topFrame: Record<string, any> = stackTraceResponse.stackFrames[0];
            const source: string = topFrame.source.path;
            const line: number = topFrame.line;
            const column: number = topFrame.column;
            const threadId: number = message.body.threadId
            this.sessionManager.addBreakpoint(source, line, column, threadId);
            this.commandHandler.setPausedOnBreakpoint(true);
            if (this.sessionManager.scriptsAreRunnable()) {
                const bId: string = this.sessionManager.constructBreakpointId(source, line, column, threadId);
                const loadedBreakpoints: Breakpoint[] = this.storageManager.loadBreakpoints();
                const existingBreakpoint = loadedBreakpoints.find((b: Breakpoint) => b.id === bId);
                const scripts: Script[] = existingBreakpoint?.scripts || [];
                evaluateScripts(scripts.filter(s => s.active).map(s => s.uri), threadId);
            }
        }

        if (message.type === 'event' && message.event === 'continued') {
            this.commandHandler.setPausedOnBreakpoint(false);
            if (this.sessionManager.isCapturing()) {
                this.commandHandler.stopCapture(true);
            }
            showInformationMessage('Debugger resumed from breakpoint.');
        }

    };

    onError = (error: any) => {
        console.error(`Debug Adapter Tracker Error: ${error}`);
    };

    onExit = (code: number, signal: any) => {
        console.log(`Debug Adapter exited with code: ${code}, signal: ${signal}`);
    };
}

export default DebugAdapterTracker;