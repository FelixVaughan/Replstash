const vscode = require('vscode');

class SessionManager {
    constructor() {
        this.sessionOutput = {};
        this.breakpoints = [];
        this.currentBreakpoint = null;
    }

    addSessionOutput(messageSeq, expression) {
        this.sessionOutput[messageSeq] = expression;
    }

    getSessionOutput() {
        return this.sessionOutput;
    }

    createBreakpointId(file, line, column, threadId) {
        return `${file}_${line}_${column}_${threadId}`;
    }

    addBreakpoint(threadId, line, column, file) {
        const existingBreakpoint = this.breakpoints.find(breakpoint => breakpoint.id === threadId);
        if (!existingBreakpoint) {
            this.currentBreakpoint = {
                id: this.createBreakpointId(file, line, column, threadId),
                threadId: threadId,
                line: line,
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

    addBreakpointContent(messageSeq, expression) {
        if (this.currentBreakpoint) {
            this.currentBreakpoint.content[messageSeq] = expression;
        }
    }

    removeBreakpointContent(messageSeq) {
        if (this.currentBreakpoint) {
            delete this.currentBreakpoint.content[messageSeq];
            delete this.sessionOutput[messageSeq];
        }
    }

    getBreakpoints() {
        return this.breakpoints;
    }

    reset() {
        this.sessionOutput = {};
        this.breakpoints = [];
        this.currentBreakpoint = null;
    }

}

const breakpointDisposable = vscode.debug.onDidChangeBreakpoints(event => {
    //use this to handle changes to breakpoints
});

module.exports = SessionManager;
