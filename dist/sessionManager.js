"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SessionManager {
    constructor() {
        this.addSessionOutput = (messageSeq, expression) => {
            this.sessionOutput[messageSeq] = expression;
        };
        this.getSessionOutput = () => this.sessionOutput;
        this.setCapturing = (capturing) => {
            this.capturing = capturing;
            this.captureIsPaused = false;
        };
        this.capturePaused = () => this.captureIsPaused;
        this.setCapturePaused = (paused) => {
            this.captureIsPaused = paused;
            this.capturing = false;
        };
        this.createBreakpointId = (file, line, column, threadId) => `${file}_${line}_${column}_${threadId}`;
        this.addBreakpoint = (threadId, line, column, file) => {
            const breakpointId = this.createBreakpointId(file, line, column, threadId);
            const existingBreakpoint = this.breakpoints.find((breakpoint) => breakpoint.id === breakpointId);
            if (!existingBreakpoint) {
                this.currentBreakpoint = {
                    id: breakpointId,
                    threadId: threadId,
                    line: line,
                    column: column,
                    file: file,
                    scripts: [],
                    content: {},
                };
                this.breakpoints.push(this.currentBreakpoint);
            }
            else {
                this.currentBreakpoint = existingBreakpoint;
            }
        };
        this.addBreakpointContent = (messageSeq, expression) => {
            if (this.currentBreakpoint) {
                this.currentBreakpoint.content[messageSeq] = expression;
            }
        };
        this.removeBreakpointContent = (messageSeq) => {
            if (this.currentBreakpoint) {
                delete this.currentBreakpoint.content[messageSeq];
                delete this.sessionOutput[messageSeq];
            }
        };
        this.getBreakpoints = () => {
            return this.breakpoints;
        };
        this.isCapturing = () => this.capturing;
        this.clearCapture = () => {
        };
        this.discardCapture = () => {
        };
        this.resetCurrentBeakpointContent = () => {
            if (this.currentBreakpoint) {
                this.currentBreakpoint.content = {};
            }
        };
        this.getCurrentBreakpoint = () => this.currentBreakpoint;
        this.sessionOutput = {};
        this.breakpoints = [];
        this.currentBreakpoint = null;
        this.capturing = false;
        this.captureIsPaused = false;
    }
}
exports.default = SessionManager;
// const breakpointDisposable = vscode.debug.onDidChangeBreakpoints(event => {
//     //use this to handle changes to breakpoints
//     vscode.DebugStackFrame
// });
//# sourceMappingURL=sessionManager.js.map