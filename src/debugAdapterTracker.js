const vscode = require('vscode');

class DebugAdapterTracker {
    constructor(sessionManager, commandHandler) {
        this.sessionManager = sessionManager;
        this.commandHandler = commandHandler; // Reference to CommandHandler to check capturing state
        this.commandHandler.on('captureStarted', () => {this.sessionManager.setCapturing(true)});
        this.commandHandler.on('captureStopped', () => {this.sessionManager.setCapturing(false)});
    }

    onWillReceiveMessage = async (message) => {
        if (this.sessionManager.isCapturing && message.arguments?.context === 'repl') {
            const expression = message.arguments.expression;
            this.sessionManager.addSessionOutput(message.seq, expression);
            this.sessionManager.addBreakpointContent(message.seq, expression);
        }
    };

    onDidSendMessage = async (message) => {
        if (this.sessionManager.isCapturing && message.type === 'response' && message.command === 'evaluate') {
            if (!message?.success) {
                this.sessionManager.removeBreakpointContent(message.request_seq);
            }
        }

        if (message.type === 'event' && message.event === 'stopped' && message.body.reason === 'breakpoint') {

            const stackTraceResponse = await vscode.debug.activeDebugSession.customRequest('stackTrace', {
                threadId: message.body.threadId,
            });

            if (stackTraceResponse && stackTraceResponse.stackFrames.length > 0) {
                const topFrame = stackTraceResponse.stackFrames[0];
                const source = topFrame.source;
                const line = topFrame.line;
                const column = topFrame.column;
                this.sessionManager.addBreakpoint(message.body.threadId, line, column, source.path);
                this.commandHandler.setPausedOnBreakpoint(true);
            }
        }

        if (message.type === 'event' && message.event === 'continued') {
            this.commandHandler.setPausedOnBreakpoint(false);
            if (this.sessionManager.isCapturing) {
                this.commandHandler.stopCapture(true);
            }
            vscode.window.showInformationMessage('Debugger resumed from breakpoint.');
        }

    };

    onError = (error) => {
        console.error(`Debug Adapter Tracker Error: ${error}`);
    };

    onExit = (code, signal) => {
        console.log(`Debug Adapter exited with code: ${code}, signal: ${signal}`);
    };
}

module.exports = DebugAdapterTracker;