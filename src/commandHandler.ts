import EventEmitter from 'events';
import * as vscode from 'vscode';
import path from 'path';
import SessionManager from './sessionManager';
import StorageManager from './storageManager';
import { 
    Breakpoint, 
    ScriptsMetaData, 
    _debugger, 
    window, 
    commands,
    LabeledItem,
    showWarningMessage,
    showInformationMessage,
    getCurrentTimestamp,
    InvalidReason
} from './utils';

/**
 * Handles commands related to managing breakpoints, scripts, and session operations.
 * Extends EventEmitter for emitting capture events.
 * @class
 */
export default class CommandHandler extends EventEmitter {
    /**
     * Singleton instance of CommandHandler.
     * Ensures only one instance of CommandHandler exists.
     */
    private static _instance: CommandHandler | null = null;

    /**
     * Reference to the SessionManager instance.
     */
    private sessionManager: SessionManager;

    /**
     * Reference to the StorageManager instance.
     */
    private storageManager: StorageManager;

    /**
     * Indicates whether the debugger is paused on a breakpoint.
     */ 
    private pausedOnBreakpoint: boolean;

    /**
     * Private constructor for the Singleton pattern.
     */
    private constructor () {
        super();
        this.sessionManager = SessionManager.instance;
        this.storageManager = StorageManager.instance;
        this.pausedOnBreakpoint = false;
    }

    /**
     * Returns the singleton CommandHandler instance.
     * @returns {CommandHandler} The singleton instance.
     */
    static get instance(): CommandHandler {
        if (!this._instance) {
            this._instance = new CommandHandler();
        }
        return this._instance;
    }

    /**
     * Starts capturing console input during debugging.
     * Emits `captureStarted` if successful.
     * @returns {void}
     */
    startCapture = (): void => {
        const activeSession: vscode.DebugSession = _debugger.activeDebugSession!;
        let err_msg = "";
        if (!activeSession) err_msg = 'No active debug session.';
        else if (!this.pausedOnBreakpoint) err_msg = 'Not paused on a breakpoint.';
        else if (this.sessionManager.isCapturing()) err_msg = 'Already capturing debug console input.';

        if (err_msg) {
            showWarningMessage(err_msg);
            return;
        }
        this.sessionManager.setCapturing(true);
        this.emit('captureStarted');
        commands.executeCommand('workbench.debug.action.focusRepl');
        showInformationMessage('Started capturing debug console input.');
    }

    /**
     * Pauses capturing of console input.
     * @returns {void}
     */
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

    /**
     * Stops capturing and emits `captureStopped`.
     * @returns {void}
     */
    private captureTerminationSignal(): void {
        this.sessionManager.setCapturing(false);
        this.emit('captureStopped');
    }

    /**
     * Discards the currently captured console input.
     * @returns {Promise<void>}
     */
    discardCapture = async (): Promise<void> => {
        if (!this.sessionManager.isCapturing()) {
            showWarningMessage('Not capturing console input.');
            return;
        }
        this.captureTerminationSignal();
        this.sessionManager.clearCapture();
        showInformationMessage('Capture discarded.');
    }

    /**
     * Stops capturing and saves the captured input to a file.
     * Allows auto-save with default file names.
     * @param {boolean} [autoSave=false] Whether to auto-save the captured input.
     * @returns {Promise<void>}
     */
    stopCapture = async (autoSave: boolean = false): Promise<void> => {
        if (!this.sessionManager.capturePaused() && !this.sessionManager.isCapturing()) {
            showWarningMessage('Not capturing console input.');
            return;
        }

        const currentBreakpoint: Breakpoint = this.sessionManager.getCurrentBreakpoint()!;
        if (!this.sessionManager.contentCaptured()) {
            showWarningMessage('Stopped: No console input captured.');
            this.captureTerminationSignal();
            return;
        }

        const defaultFileName: string = `${path.basename(currentBreakpoint.file)}_` +
                        `${currentBreakpoint.line}_` +
                        `${currentBreakpoint.column}_` +
                        `${getCurrentTimestamp()}`;

        let fileName: string | undefined;
        let invalidReason: InvalidReason = InvalidReason.None;

        // Prompt the user for a file name until valid input (optional back-out)
        while (true) {

            if (autoSave) {
                fileName = defaultFileName;
                this.storageManager.persistCaptureContent(
                    currentBreakpoint, 
                    defaultFileName
                );
                break;
            }

            // Show an input box for the user to enter a file name
            fileName = await window.showInputBox({
                prompt: invalidReason === InvalidReason.None ? 'Save console input:' : invalidReason,
                value: defaultFileName,
                placeHolder: defaultFileName
            });

            // If the user cancels, abort the termination
            if (!fileName) {
                showWarningMessage('Capture in progress, termination aborted.');
                return;
            }

            // Validate the file name
            fileName = fileName.trim();

            invalidReason = this.storageManager.persistCaptureContent(
                currentBreakpoint, 
                fileName
            );

            if (invalidReason === InvalidReason.None) {
                break;
            }
        }

        this.captureTerminationSignal();
        this.sessionManager.clearCapture();
        const action = await showInformationMessage(`Stopped capture: ${fileName}`, 'Open File');
        action === 'Open File' && this.storageManager.openScript(fileName);
    }

    /**
     * Selects a script file from available saved scripts using the QuickPick UI.
     * @returns {Promise<string | void>} The selected script file name, or void if canceled.
     */
    private async  selectScript(): Promise<string | void> {
        const scriptsMetaData: ScriptsMetaData[] = this.storageManager.scriptMetaData();
        if (!scriptsMetaData.length) {
            showInformationMessage('No saved breakpoints found.');
            return;
        }

        const selectedScript: LabeledItem | undefined = await window.showQuickPick(
            scriptsMetaData.map((meta) => ({
                label: meta.fileName,
                description: `Created: ${meta.createdAt} | Modified: ${meta.modifiedAt} | Size: ${meta.size} bytes`,
                id: meta.fileName
            })),
            {
                placeHolder: 'Select a saved captured script to edit',
                canPickMany: false
            }
        );

        if (!selectedScript) {
            showInformationMessage('No script selected.');
            return;
        }
        return selectedScript.id;
    }

    /**
     * Clears all captured console input.
     * @returns {Promise<void>}
     */
    clearCapture = async (): Promise<void> => {
        if (!this.sessionManager.isCapturing()) {
            showWarningMessage('Not capturing console input.');
            return;
        }
        this.sessionManager.clearCapture();
        showInformationMessage('Capture cleared.');
    }

    /**
     * Clears the last entered expression from the capture session.
     * @returns {Promise<void>}
     */
    clearLastExpression = async (): Promise<void> => {
        if (!this.sessionManager.isCapturing()) {
            showWarningMessage('Not capturing console input.');
            return;
        }
        if (Object.is(this.sessionManager.clearLastExpression(), null)) {
            showWarningMessage('No expressions to pop.');
            return;
        }
        showInformationMessage('Last expression cleared.');
    }

    /**
     * Prompts the user to select a saved breakpoint.
     * 
     * Displays a list of breakpoints using the quick pick UI. Each breakpoint is listed with its file,
     * line, and column information.
     * 
     * @returns {Promise<Breakpoint | void>} The selected breakpoint or `void` if no selection was made.
     */
    private selectBreakpoint = async (supress: boolean = false): Promise<Breakpoint | void> => {
        // Load all stored breakpoints
        const breakpoints: Breakpoint[] = this.storageManager.loadBreakpoints();

        // If no breakpoints are available, show an informational message
        if (!breakpoints.length) {
            showInformationMessage('No saved breakpoints found.');
            return;
        }

        // Present a quick pick UI for selecting a breakpoint
        const selectedBreakpoint: LabeledItem | undefined = await window.showQuickPick(
            breakpoints.map((bp: Breakpoint) => ({
                label: bp.file,
                description: `Ln:${bp.line}, Col${bp.column}`,
                id: bp.id
            })),
            {
                placeHolder: 'Select a breakpoint to assign scripts',
                canPickMany: false
            }
        );

        // If no selection is made, exit the function
        if (!selectedBreakpoint) {
            !supress && showInformationMessage('No breakpoint selected.');
            return;
        }

        // Find and return the selected breakpoint
        return breakpoints.find((bp: Breakpoint) => bp.id === selectedBreakpoint.id);
    };

    /**
     * Displays a confirmation dialog with a warning message.
     * 
     * This method presents a modal warning dialog with "Yes" and "Cancel" options, allowing the user
     * to confirm or decline an action.
     * 
     * @param {string} message - The warning message to display in the confirmation dialog.
     * @returns {Promise<boolean>} A promise that resolves to `true` if the user confirms, or `false` otherwise.
     */
    private confirmWarning = async (message: string): Promise<boolean> => {
        // Show the modal warning dialog and wait for the user's selection
        const selection = await showWarningMessage(
            message,
            { modal: true }, // Ensures the dialog is presented as a modal
            'Yes' // Option for the user to confirm
        );

        // Return true if the user selects "Yes", false otherwise
        return selection === 'Yes';
    };


    
    /**
     * Opens a selected script in the editor.
     * Allows the user to select a saved script and opens it for viewing or editing.
     * 
     * @returns {Promise<void>} A promise that resolves when the script is opened.
     */
    openScript = async (): Promise<void> => {
        // Prompt the user to select a script
        const selectedScript: string | void = await this.selectScript();
        if (selectedScript) {
            // Open the script in the editor
            this.storageManager.openScript(selectedScript);
        }
    };

    /**
     * Deletes a saved script selected by the user.
     * Prompts the user to select a script and removes it from storage.
     * Displays an informational message upon successful deletion.
     * @returns {Promise<void>}
     */
    deleteSavedScript = async (): Promise<void> => {
        const selectedScript: string | void = await this.selectScript();
        if (selectedScript) {
            this.storageManager.deleteScript(selectedScript);
            showInformationMessage(`Deleted: ${selectedScript}`);
        }
    };

    /**
     * Deletes a breakpoint selected by the user.
     * Prompts the user to select a breakpoint and removes it from storage.
     * Displays an informational message upon successful deletion.
     * @returns {Promise<void>}
     */
    deleteBreakpoint = async (): Promise<void> => {
        const selectedBreakpoint: Breakpoint | void = await this.selectBreakpoint(true);
        if (selectedBreakpoint) {
            this.storageManager.removeBreakpoint(selectedBreakpoint);
            showInformationMessage(`Deleted: ${selectedBreakpoint.file}`);
        }
    };

    /**
     * Renames a saved script selected by the user.
     * Prompts the user to select a script and enter a new name for it.
     * @param {string | void} [selectedScript] - The script to rename, or `void` to prompt the user.
     * @returns {Promise<void>}
     */
    renameSavedScript = async (selectedScript: string | void): Promise<void> => {
        selectedScript = selectedScript || await this.selectScript();
        if (!selectedScript) return;

        const newFileName: string | void = await window.showInputBox({
            prompt: 'Enter a new name for the script',
            value: selectedScript,
            placeHolder: selectedScript
        });

        if (!newFileName) return;
        this.storageManager.renameScript(selectedScript, newFileName);
    };

    /**
     * Sets whether the debugger is currently paused on a breakpoint.
     * @param {boolean} stopped - True if the debugger is paused, otherwise false.
     */
    setStoppedOnBreakpoint = (stopped: boolean): void => {
        this.pausedOnBreakpoint = stopped;
    };

    /**
     * Purges all saved breakpoints after user confirmation.
     * Displays a warning message to confirm the action before proceeding.
     * @returns {Promise<void>}
     */
    purgeBreakpoints = async (): Promise<void> => {
        const proceed: boolean = await this.confirmWarning(
            "Are you sure you want to purge all breakpoints?"
        );
        proceed && this.storageManager.purgeBreakpoints();
    };

    /**
     * Purges all saved scripts after user confirmation.
     * Displays a warning message to confirm the action before proceeding.
     * @returns {Promise<void>}
     */
    purgeScripts = async (): Promise<void> => {
        const proceed: boolean = await this.confirmWarning(
            "Are you sure you want to purge all scripts?"
        );
        proceed && this.storageManager.purgeScripts();
    };

    /**
     * Sets whether scripts are runnable.
     * Updates the session state and notifies the user.
     * @param {boolean} runnable - True to make scripts runnable, otherwise false.
     * @returns {Promise<void>}
     */
    setAutomaticRuns = async (runnable: boolean): Promise<void> => {
        if (this.sessionManager.scriptsAreRunnable() === runnable) {
            showWarningMessage(
                `Automatic runs are already ${runnable ? 'enabled' : 'disabled'}.
            `);
            return;
        }
        this.sessionManager.setScriptsRunnable(runnable);
        if(runnable){
            showInformationMessage('Replstash will now automatically run.');
            return;
        }
        showInformationMessage('Automatic Replstash runs disabled.');
    };

    /**
     * Print the current capture content to the debug console.
     * @returns {Promise<void>}
     */
    outputCapture = async (): Promise<void> => {
        if (!this.sessionManager.isCapturing()) {
            showWarningMessage('Not capturing console input.');
            return;
        }
        const breakpoint: Breakpoint | null = this.sessionManager.getCurrentBreakpoint()!;
        const content: Record<string, string> = breakpoint.content;
        const output = Object.values(content).join('\n');
        _debugger.activeDebugConsole?.appendLine(output);
    }

    toggleCapture = async (): Promise<void> => {
        if (this.sessionManager.isCapturing()) {
            await this.stopCapture();
        } else {
            this.startCapture();
        }
    }

    toggleAutoRun = async (): Promise<void> => {
        this.setAutomaticRuns(
            !this.sessionManager.scriptsAreRunnable()
        );
    }

}
