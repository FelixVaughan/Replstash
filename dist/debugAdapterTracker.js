"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
class DebugAdapterTracker {
    sessionManager;
    commandHandler;
    storageManager;
    constructor(sessionManager, commandHandler, storageManager) {
        this.sessionManager = sessionManager;
        this.commandHandler = commandHandler;
        this.storageManager = storageManager;
        this.commandHandler.on('captureStarted', () => { this.sessionManager.setCapturing(true); });
        this.commandHandler.on('captureStopped', () => { this.sessionManager.setCapturing(false); });
    }
    _evaluateBreakpointScripts = async (breakpointId, frameId, session) => {
        const loadedBreakpoints = this.storageManager.loadBreakpoints();
        const existingBreakpoint = loadedBreakpoints.find((breakpoint) => breakpoint.id === breakpointId);
        existingBreakpoint?.scripts.forEach(async (script) => {
            if (!script.active)
                return;
            const scriptContent = this.storageManager.getScriptContent(script.uri);
            if (scriptContent) {
                const response = await session.customRequest('evaluate', {
                    expression: scriptContent,
                    context: 'repl',
                    frameId: frameId,
                });
                if (response.success)
                    utils_1.window.showInformationMessage(`Script: ${script.uri} evaluated successfully.`);
            }
        });
    };
    onWillReceiveMessage = async (message) => {
        if (this.sessionManager.isCapturing() && message.arguments?.context === 'repl') {
            const expression = message.arguments.expression;
            this.sessionManager.addSessionOutput(message.seq, expression);
            this.sessionManager.addBreakpointContent(message.seq, expression);
        }
    };
    onDidSendMessage = async (message) => {
        if (this.sessionManager.isCapturing() && message.type === 'response' && message.command === 'evaluate') {
            if (!message?.success) {
                this.sessionManager.removeBreakpointContent(message.request_seq);
            }
        }
        if (message.type === 'event' && message.event === 'stopped' && message.body.reason === 'breakpoint') {
            const activeSession = utils_1._debugger?.activeDebugSession;
            if (!activeSession)
                return;
            const stackTraceResponse = await activeSession.customRequest('stackTrace', {
                threadId: message.body.threadId,
            });
            if (stackTraceResponse?.stackFrames.length < 1)
                return;
            const topFrame = stackTraceResponse.stackFrames[0];
            const source = topFrame.source.path;
            const line = topFrame.line;
            const column = topFrame.column;
            const threadId = message.body.threadId;
            this.sessionManager.addBreakpoint(source, line, column, threadId);
            this.commandHandler.setPausedOnBreakpoint(true);
            if (this.sessionManager.scriptsAreRunnable()) {
                const breakpointId = this.sessionManager.constructBreakpointId(source, line, column, threadId);
                this._evaluateBreakpointScripts(breakpointId, topFrame.id, activeSession);
            }
        }
        if (message.type === 'event' && message.event === 'continued') {
            this.commandHandler.setPausedOnBreakpoint(false);
            if (this.sessionManager.isCapturing()) {
                this.commandHandler.stopCapture(true);
            }
            utils_1.window.showInformationMessage('Debugger resumed from breakpoint.');
        }
    };
    onError = (error) => {
        console.error(`Debug Adapter Tracker Error: ${error}`);
    };
    onExit = (code, signal) => {
        console.log(`Debug Adapter exited with code: ${code}, signal: ${signal}`);
    };
}
exports.default = DebugAdapterTracker;
//# sourceMappingURL=debugAdapterTracker.js.map