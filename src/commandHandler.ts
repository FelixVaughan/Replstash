import EventEmitter from 'events';
import * as vscode from 'vscode';
import path from 'path';
import SessionManager from './sessionManager';
import StorageManager from './storageManager';

class CommandHandler extends EventEmitter {

    private sessionManager: SessionManager;
    private storageManager: StorageManager;
    private pausedOnBreakpoint: boolean;

    constructor (sessionManager: SessionManager, storageManager: StorageManager) {
        super();
        this.sessionManager = sessionManager;
        this.storageManager = storageManager;
        this.pausedOnBreakpoint = false;
    }

    startCapture = (): void => {
        const activeSession: vscode.DebugSession = vscode.debug.activeDebugSession!;  //!: Non-null assertion operator  
        let err_msg: string = "";
        if (!activeSession) err_msg = 'No active debug session.';
        else if (!this.pausedOnBreakpoint) err_msg = 'Not paused on a breakpoint.';
        else if(this.sessionManager.isCapturing()) err_msg = 'Already capturing debug console input.';

        if (err_msg) {
            vscode.window.showWarningMessage(err_msg);
            return;
        }

        this.sessionManager.setCapturing(true);
        this.emit('captureStarted');  // Emit event when capturing starts
        vscode.window.showInformationMessage('Started capturing debug console input.');
    };

    pauseCapture = (): void => {

        if (this.sessionManager.capturePaused()) {
            vscode.window.showWarningMessage('Capture already paused.');
            return;
        }

        if (!this.sessionManager.isCapturing()) {
            vscode.window.showWarningMessage('Not capturing console input.');
            return;
        }

        this.sessionManager.setCapturePaused(true);
        vscode.window.showInformationMessage('Paused capturing debug console input.');
    }

    _isValidFilename = (name: string): boolean => {
        const invalidChars: RegExp = /[<>:"\/\\|?*\x00-\x1F]/g;
        const reservedNames: RegExp = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
        if (invalidChars.test(name) || reservedNames.test(name) || name.length > 255)
            return false;
        return true;
    }

    stopCapture = async (autoSave: boolean = false): Promise<void> => {
        if (!this.sessionManager.capturePaused() && !this.sessionManager.isCapturing()) {
            vscode.window.showWarningMessage('Not capturing console input.');
            return;
        }

        const captureTerminationSignal = (): void => {
            this.sessionManager.setCapturing(false);
            this.emit('captureStopped');  // Emit event when capturing stops
        }

        const currentBreakpoint = this.sessionManager.getCurrentBreakpoint()!;

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

    _selectScript = async (): Promise<string | void> => {
        const scriptsMetaData = this.storageManager.breakpointFilesMetaData(); // This should return an array of script paths
        if (!scriptsMetaData.length) {
            vscode.window.showInformationMessage('No saved breakpoints found.');
            return;
        }

        interface LabeledItem {
            label: any;
            description: string;
        }

        const selectedScript: LabeledItem | undefined = await vscode.window.showQuickPick(
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

    editSavedScript = async (): Promise<void> => {
        const selectedScript = await this._selectScript();
        if (selectedScript) {
            this.storageManager.openBreakpointFile(selectedScript);
        }
    };

    deleteSavedScript = async (): Promise<void> => {
        const selectedScript = await this._selectScript();
        if (selectedScript) {
            this.storageManager.deleteBreakpointFile(selectedScript);
        }
    }

    activateScripts = (): void => {
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
    setPausedOnBreakpoint = (paused: boolean): void => {
        this.pausedOnBreakpoint = paused;
    }
}

export default CommandHandler;