import SessionManager from './sessionManager';
import CommandHandler from './commandHandler';
import {_debugger, window} from './utils';
class DebugAdapterTracker {

    private sessionManager: SessionManager;
    private commandHandler: CommandHandler;

    constructor(sessionManager: SessionManager, commandHandler: CommandHandler) {
        this.sessionManager = sessionManager;
        this.commandHandler = commandHandler; // Reference to CommandHandler to check capturing state
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

            if (!_debugger.activeDebugSession) return;

            const stackTraceResponse: any = await _debugger.activeDebugSession.customRequest('stackTrace', {
                threadId: message.body.threadId,
            });

            if (stackTraceResponse && stackTraceResponse.stackFrames.length > 0) {
                const topFrame: Record<string, any> = stackTraceResponse.stackFrames[0];
                const source: string = topFrame.source.path;
                const line: number = topFrame.line;
                const column: number = topFrame.column;
                this.sessionManager.addBreakpoint(message.body.threadId, line, column, source);
                this.commandHandler.setPausedOnBreakpoint(true);
            }
        }

        if (message.type === 'event' && message.event === 'continued') {
            this.commandHandler.setPausedOnBreakpoint(false);
            if (this.sessionManager.isCapturing()) {
                this.commandHandler.stopCapture(true);
            }
            window.showInformationMessage('Debugger resumed from breakpoint.');
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