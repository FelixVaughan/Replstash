const EventEmitter = require('events');
const vscode = require('vscode');
const path = require('path');

class CommandHandler extends EventEmitter {

    constructor(sessionManager, storageManager) {
        super();
        this.sessionManager = sessionManager;
        this.storageManager = storageManager;
        this.pausedOnBreakpoint = false;
    }

    startCapture = () => {
        const activeSession = vscode.debug.activeDebugSession;    
        let err_msg;
        if (!activeSession) err_msg = 'No active debug session.';
        else if (!this.pausedOnBreakpoint) err_msg = 'Not paused on a breakpoint.';
        else if(this.sessionManager.isCapturing) err_msg = 'Already capturing debug console input.';

        if (err_msg) {
            vscode.window.showWarningMessage(err_msg);
            return;
        }

        this.sessionManager.setCapturing(true);
        // this.sessionManager.reset();
        this.emit('captureStarted');  // Emit event when capturing starts
        vscode.window.showInformationMessage('Started capturing debug console input.');
    };

    pauseCapture = () => {

        if (this.sessionManager.captureIsPaused) {
            vscode.window.showWarningMessage('Capture already paused.');
            return;
        }

        if (!this.sessionManager.isCapturing) {
            vscode.window.showWarningMessage('Not capturing console input.');
            return;
        }

        this.sessionManager.setCapturePaused(true);
        vscode.window.showInformationMessage('Paused capturing debug console input.');
    }

    _isValidFilename = (name) => {
        const invalidChars = /[<>:"\/\\|?*\x00-\x1F]/g;
        const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
        if (invalidChars.test(name) || reservedNames.test(name) || name.length > 255)
            return false;
        return true;
    }

    stopCapture = async (autoSave = false) => {
        if (!this.sessionManager.captureIsPaused && !this.sessionManager.isCapturing) {
            vscode.window.showWarningMessage('Not capturing console input.');
            return;
        }

        const captureTerminationSignal = () => {
            this.sessionManager.setCapturing(false);
            this.emit('captureStopped');  // Emit event when capturing stops
        }

        const currentBreakpoint = this.sessionManager.currentBreakpoint;

        if (!Object.keys(currentBreakpoint.content).length) {
            vscode.window.showWarningMessage('Stopped: No console input captured.');
            captureTerminationSignal()
            return;
        }

        const defaultFileName = `${path.basename(currentBreakpoint.file)}_${currentBreakpoint.line}_${currentBreakpoint.column}_${this.storageManager.getCurrentTimestamp()}`;
        let fileName;
        let invalidReason = "";

        while (true) {

            if (autoSave) {
                fileName = defaultFileName;
                break;
            }

            // Show input box to get the file name from the user
            fileName = await vscode.window.showInputBox({
                prompt: invalidReason || 'Save console input:',
                value: defaultFileName,
                placeHolder: defaultFileName
            });

            // If the user presses Escape or enters nothing, exit the loop and return
            if (!fileName) {
                vscode.window.showWarningMessage('Capture in progress, termination aborted.');
                return;
            }

            fileName = fileName.trim();

            // Check if the file already exists
            if (this.storageManager.fileExists(fileName)) {
                invalidReason = `File already exists: ${fileName}`;
                continue;
            }

            // Check if the filename is valid
            if (!this._isValidFilename(fileName)) {
                invalidReason = 'Invalid file name.';
                continue;
            }

            // If the filename is valid and does not exist, break out of the loop
            break;
    }


        // Stop capturing and save the breakpoint with the specified file name 
        captureTerminationSignal()
        this.storageManager.saveBreakpoint(currentBreakpoint, fileName);
        this.sessionManager.resetCurrentBeakpointContent();
        vscode.window.showInformationMessage(`Stopped capture: ${fileName}`);
    
    };

    _selectScript = async () => {
        const scriptsMetaData = this.storageManager.breakpointFilesMetaData(); // This should return an array of script paths
        if (!scriptsMetaData.length) {
            vscode.window.showInformationMessage('No saved breakpoints found.');
            return;
        }

        const selectedScript = await vscode.window.showQuickPick(
            scriptsMetaData.map((meta) => ({
                label: meta.fileName,
                description: `Created: ${meta.createdAt} | Modified: ${meta.modifiedAt} | Size: ${meta.size} bytes`
            })),
            {
                placeHolder: 'Select a saved breakpoint script to edit',
                canPickMany: false
            }
        );

        // If no script was selected (user canceled the QuickPick)
        if (!selectedScript) {
            vscode.window.showInformationMessage('No script selected.');
            return;
        }
        return selectedScript.label;

    }

    editSavedScript = async () => {
        const selectedScript = await this._selectScript();
        if (selectedScript) {
            this.storageManager.openBreakpointFile(selectedScript);
        }
    };

    deleteSavedScript = async () => {
        const selectedScript = await this._selectScript();
        if (selectedScript) {
            this.storageManager.deleteBreakpointFile(selectedScript);
        }
    }

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