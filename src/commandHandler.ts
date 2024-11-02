import EventEmitter from 'events';
import * as vscode from 'vscode';
import path from 'path';
import SessionManager from './sessionManager';
import StorageManager from './storageManager';
import { 
    Breakpoint, 
    BreakpointMetaData, 
    _debugger, 
    window, 
    commands,
    LabeledItem,
    showWarningMessage,
    showInformationMessage
} from './utils';

//TODO: discard capture
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
        const activeSession: vscode.DebugSession = _debugger.activeDebugSession!;  //!: Non-null assertion operator  
        let err_msg: string = "";
        if (!activeSession) err_msg = 'No active debug session.';
        else if (!this.pausedOnBreakpoint) err_msg = 'Not paused on a breakpoint.';
        else if(this.sessionManager.isCapturing()) err_msg = 'Already capturing debug console input.';

        if (err_msg) {
            showWarningMessage(err_msg);
            return;
        }
        this.sessionManager.setCapturing(true);
        this.emit('captureStarted');  // Emit event when capturing starts
        commands.executeCommand('workbench.debug.action.focusRepl');
        showInformationMessage('Started capturing debug console input.');
    };

    pauseCapture = (): void => {

        if (this.sessionManager.capturePaused()) {
            showWarningMessage('Capture already paused.');
            return;
        }

        if (!this.sessionManager.isCapturing()) {
            showWarningMessage('Not capturing console input.');
            return;
        }

        this.sessionManager.setCapturePaused(true);
        showInformationMessage('Paused capturing debug console input.');
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
            showWarningMessage('Not capturing console input.');
            return;
        }

        const captureTerminationSignal = (): void => {
            this.sessionManager.setCapturing(false);
            this.emit('captureStopped');  // Emit event when capturing stops
        }

        const currentBreakpoint: Breakpoint = this.sessionManager.getCurrentBreakpoint()!;

        if (!Object.keys(currentBreakpoint.content).length) {
            showWarningMessage('Stopped: No console input captured.');
            captureTerminationSignal()
            return;
        }

        const defaultFileName: string = `${path.basename(currentBreakpoint.file)}_` +
                        `${currentBreakpoint.line}_` +
                        `${currentBreakpoint.column}_` +
                        `${this.storageManager.getCurrentTimestamp()}`;

        let fileName: string | undefined;
        let invalidReason: string = "";

        while (true) {
            if (autoSave) {
                fileName = defaultFileName;
                break;
            }

            // Show input box to get the file name from the user
            fileName = await window.showInputBox({
                prompt: invalidReason || 'Save console input:',
                value: defaultFileName,
                placeHolder: defaultFileName
            });

            // If the user presses Escape or enters nothing, exit the loop and return
            if (!fileName) {
                showWarningMessage('Capture in progress, termination aborted.');
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
        showInformationMessage(`Stopped capture: ${fileName}`);
    
    };

    _selectScript = async (): Promise<string | void> => {
        const scriptsMetaData: BreakpointMetaData[] = this.storageManager.breakpointFilesMetaData(); // This should return an array of script paths
        if (!scriptsMetaData.length) {
            showInformationMessage('No saved breakpoints found.');
            return;
        }

        const selectedScript: LabeledItem | undefined = await window.showQuickPick(
            scriptsMetaData.map((meta: BreakpointMetaData) => ({
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
            showInformationMessage('No script selected.');
            return;
        }
        return selectedScript.label;

    }

    clearCapture = async (): Promise<void> => {
        if (!this.sessionManager.isCapturing()) {
            showWarningMessage('Not capturing console input.');
            return;
        }
        this.sessionManager.clearCapture();
        showInformationMessage('Capture cleared.');
    }

    clearLastExpression = async (): Promise<void> => {
        if (!this.sessionManager.isCapturing()) {
            showWarningMessage('Not capturing console input.');
            return;
        }
        if (Object.is(this.sessionManager.clearLastExpression(), null)) {
            showWarningMessage('No expression entered.');
            return;
        }
        showInformationMessage('Last expression cleared.');
    }

    _selectBreakpoint = async (): Promise<Breakpoint | void> => {
        const breakpoints: Breakpoint[] = this.storageManager.loadBreakpoints();
        if (!breakpoints.length) {
            showInformationMessage('No saved breakpoints found.');
            return;
        }

        const selectedBreakpoint: LabeledItem | undefined = await window.showQuickPick(
            breakpoints.map((bp: Breakpoint) => ({
                label: bp.id,
                description: `File: ${bp.file} | Line: ${bp.line} | Column: ${bp.column}`
            })),
            {
                placeHolder: 'Select a breakpoint to assign scripts',
                canPickMany: false
            }
        );

        if (!selectedBreakpoint) {
            showInformationMessage('No breakpoint selected.');
            return;
        }
        return breakpoints.find((bp: Breakpoint) => bp.id === selectedBreakpoint.label);
    }


    private _confirmWarning = async (message: string): Promise<boolean> => {
        const selection = await showWarningMessage(
            message,
            { modal: true },
            "Yes"
        );
    
        return selection == "Yes"
    }

    openScript = async (): Promise<void> => {
        const selectedScript: string | void = await this._selectScript();
        if (selectedScript) {
            this.storageManager.openScript(selectedScript);
        }
    };

    deleteSavedScript = async (): Promise<void> => {
        const selectedScript: string | void = await this._selectScript();
        if (selectedScript) {
            this.storageManager.deleteScript(selectedScript);
            showInformationMessage(`Deleted: ${selectedScript}`);
        }
    }

    deleteBreakpoint = async (): Promise<void> => {
        const selectedBreakpoint: Breakpoint | void = await this._selectBreakpoint();
        if (selectedBreakpoint) {
            this.storageManager.removeBreakpoint(selectedBreakpoint);
            showInformationMessage(`Deleted: ${selectedBreakpoint.file}`);
        }
    }

    activateScripts = (): void => {
        const breakpoints: Breakpoint[] = this.storageManager.loadBreakpoints();
            breakpoints.forEach((bp: Breakpoint) => {
                bp.active
            });
    };

    setPausedOnBreakpoint = (paused: boolean): void => {
        this.pausedOnBreakpoint = paused;
    };

    // Methods using the reusable function
    purgeBreakpoints = async (): Promise<void> => {
        const proceed: boolean = await this._confirmWarning("Are you sure you want to purge all breakpoints?")
        proceed && this.storageManager.purgeBreakpoints();
    }

    purgeScripts = async (): Promise<void> => {
        const proceed: boolean = await this._confirmWarning("Are you sure you want to purge all scripts?")
        proceed && this.storageManager.purgeScripts();
    }

    purgeAll = async (): Promise<void> => {
        const proceed: boolean = await this._confirmWarning("Are you sure you want to purge all data (breakpoints and scripts)?")
        proceed && this.storageManager.purgeAll();
    }

    setScriptRunnable = async (runnable: boolean): Promise<void> => {
        this.sessionManager.setScriptsRunnable(runnable);
        commands.executeCommand('setContext', 'slugger.scriptsRunnable', runnable);
        showInformationMessage(`Slugs are now ${runnable ? 'runnable' : 'not runnable'}.`);
    }

    assignScriptsToBreakpoint = async (): Promise<void> => {
        const selected: string | void = await this._selectScript();
        if (!selected) return;
        const selectedBreakpoint: Breakpoint | void = await this._selectBreakpoint();
        if (!selectedBreakpoint) return;
        this.storageManager.assignScriptsToBreakpoint(selectedBreakpoint, [selected]);
    }
        

} 

export default CommandHandler;