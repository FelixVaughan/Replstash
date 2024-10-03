"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
class DebugAdapterTracker {
    constructor(sessionManager, commandHandler) {
        this.onWillReceiveMessage = (message) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.sessionManager.isCapturing() && ((_a = message.arguments) === null || _a === void 0 ? void 0 : _a.context) === 'repl') {
                const expression = message.arguments.expression;
                this.sessionManager.addSessionOutput(message.seq, expression);
                this.sessionManager.addBreakpointContent(message.seq, expression);
            }
        });
        this.onDidSendMessage = (message) => __awaiter(this, void 0, void 0, function* () {
            if (this.sessionManager.isCapturing() && message.type === 'response' && message.command === 'evaluate') {
                if (!(message === null || message === void 0 ? void 0 : message.success)) {
                    this.sessionManager.removeBreakpointContent(message.request_seq);
                }
            }
            if (message.type === 'event' && message.event === 'stopped' && message.body.reason === 'breakpoint') {
                if (!utils_1._debugger.activeDebugSession)
                    return;
                const stackTraceResponse = yield utils_1._debugger.activeDebugSession.customRequest('stackTrace', {
                    threadId: message.body.threadId,
                });
                if (stackTraceResponse && stackTraceResponse.stackFrames.length > 0) {
                    const topFrame = stackTraceResponse.stackFrames[0];
                    const source = topFrame.source.path;
                    const line = topFrame.line;
                    const column = topFrame.column;
                    this.sessionManager.addBreakpoint(message.body.threadId, line, column, source);
                    this.commandHandler.setPausedOnBreakpoint(true);
                }
            }
            if (message.type === 'event' && message.event === 'continued') {
                this.commandHandler.setPausedOnBreakpoint(false);
                if (this.sessionManager.isCapturing()) {
                    this.commandHandler.stopCapture(true);
                }
                utils_1.window.showInformationMessage('Debugger resumed from breakpoint.');
            }
        });
        this.onError = (error) => {
            console.error(`Debug Adapter Tracker Error: ${error}`);
        };
        this.onExit = (code, signal) => {
            console.log(`Debug Adapter exited with code: ${code}, signal: ${signal}`);
        };
        this.sessionManager = sessionManager;
        this.commandHandler = commandHandler; // Reference to CommandHandler to check capturing state
        this.commandHandler.on('captureStarted', () => { this.sessionManager.setCapturing(true); });
        this.commandHandler.on('captureStopped', () => { this.sessionManager.setCapturing(false); });
    }
}
exports.default = DebugAdapterTracker;
//# sourceMappingURL=debugAdapterTracker.js.map