"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SessionManager {
    sessionOutput;
    breakpoints;
    currentBreakpoint;
    capturing;
    captureIsPaused;
    constructor() {
        this.sessionOutput = {};
        this.breakpoints = [];
        this.currentBreakpoint = null;
        this.capturing = false;
        this.captureIsPaused = false;
    }
    addSessionOutput = (messageSeq, expression) => {
        this.sessionOutput[messageSeq] = expression;
    };
    getSessionOutput = () => this.sessionOutput;
    setCapturing = (capturing) => {
        this.capturing = capturing;
        this.captureIsPaused = false;
    };
    capturePaused = () => this.captureIsPaused;
    setCapturePaused = (paused) => {
        this.captureIsPaused = paused;
        this.capturing = false;
    };
    createBreakpointId = (file, line, column, threadId) => `${file}_${line}_${column}_${threadId}`;
    addBreakpoint = (threadId, line, column, file) => {
        const breakpointId = this.createBreakpointId(file, line, column, threadId);
        const existingBreakpoint = this.breakpoints.find((breakpoint) => breakpoint.id === breakpointId);
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
        }
        else {
            this.currentBreakpoint = existingBreakpoint;
        }
    };
    addBreakpointContent = (messageSeq, expression) => {
        if (this.currentBreakpoint) {
            this.currentBreakpoint.content[messageSeq] = expression;
        }
    };
    removeBreakpointContent = (messageSeq) => {
        if (this.currentBreakpoint) {
            delete this.currentBreakpoint.content[messageSeq];
            delete this.sessionOutput[messageSeq];
        }
    };
    getBreakpoints = () => {
        return this.breakpoints;
    };
    isCapturing = () => this.capturing;
    clearCapture = () => {
    };
    discardCapture = () => {
    };
    resetCurrentBeakpointContent = () => {
        if (this.currentBreakpoint) {
            this.currentBreakpoint.content = {};
        }
    };
    getCurrentBreakpoint = () => this.currentBreakpoint;
}
exports.default = SessionManager;
// const breakpointDisposable = vscode.debug.onDidChangeBreakpoints(event => {
//     //use this to handle changes to breakpoints
//     vscode.DebugStackFrame
// });
//# sourceMappingURL=sessionManager.js.map