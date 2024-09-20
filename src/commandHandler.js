const EventEmitter = require('events');
const vscode = require('vscode');

class CommandHandler extends EventEmitter {

    constructor(sessionManager, storageManager) {
        super();
        this.sessionManager = sessionManager;
        this.storageManager = storageManager;
        this.isCapturing = false;
        this.pausedOnBreakpoint = false;
    }

    startCapture = () => {
        let err_msg;
        const activeSession = vscode.debug.activeDebugSession;    

        if (!activeSession) 
            err_msg = 'No active debug session.';
        else if (!this.pausedOnBreakpoint) 
            err_msg = 'Not paused on a breakpoint.';
        else if(this.isCapturing) 
            err_msg = 'Already capturing debug console input.';

        if (err_msg) {
            vscode.window.showWarningMessage(err_msg);
            return;
        }

        this.isCapturing = true;
        this.sessionManager.reset();
        this.emit('captureStarted');  // Emit event when capturing starts
        vscode.window.showInformationMessage('Started capturing debug console input.');
    };

    stopCapture = () => {
        if (this.isCapturing) {
            this.isCapturing = false;
            this.emit('captureStopped');  // Emit event when capturing stops
            const breakpoints = this.sessionManager.getBreakpoints();
            const sessionOutput = this.sessionManager.getSessionOutput();
            this.storageManager.saveBreakpoints(breakpoints);
            this.storageManager.saveSessionOutput(sessionOutput);
            vscode.window.showInformationMessage('Stopped capturing and saved session output.');
            this.sessionManager.reset();
            return;
        }
        vscode.window.showWarningMessage('Not capturing debug console input.');
    };

    activateScripts = () => {
        const breakpoints = this.storageManager.loadBreakpoints();
        if (breakpoints.length > 0) {
            vscode.window.showInformationMessage(`Loaded ${breakpoints.length} breakpoints.`);
            breakpoints.forEach(breakpoint => {
                // Do something to activate the scripts, such as re-injecting into session or debugging environment
                vscode.window.showInformationMessage(`Activating breakpoint in file: ${breakpoint.file} at line: ${breakpoint.line}`);
            });
        } else {
            vscode.window.showInformationMessage('No breakpoints to activate.');
        }
    };
    setPausedOnBreakpoint = (value) => {
        this.pausedOnBreakpoint = value;
    }
}

module.exports = CommandHandler;