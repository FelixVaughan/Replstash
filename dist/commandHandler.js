"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const vscode = __importStar(require("vscode"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
class CommandHandler extends events_1.default {
    sessionManager;
    storageManager;
    pausedOnBreakpoint;
    constructor(sessionManager, storageManager) {
        super();
        this.sessionManager = sessionManager;
        this.storageManager = storageManager;
        this.pausedOnBreakpoint = false;
    }
    startCapture = () => {
        const activeSession = utils_1._debugger.activeDebugSession; //!: Non-null assertion operator  
        let err_msg = "";
        if (!activeSession)
            err_msg = 'No active debug session.';
        else if (!this.pausedOnBreakpoint)
            err_msg = 'Not paused on a breakpoint.';
        else if (this.sessionManager.isCapturing())
            err_msg = 'Already capturing debug console input.';
        if (err_msg) {
            utils_1.window.showWarningMessage(err_msg);
            return;
        }
        this.sessionManager.setCapturing(true);
        this.emit('captureStarted'); // Emit event when capturing starts
        utils_1.commands.executeCommand('workbench.debug.action.toggleRepl');
        utils_1.window.showInformationMessage('Started capturing debug console input.');
    };
    pauseCapture = () => {
        if (this.sessionManager.capturePaused()) {
            utils_1.window.showWarningMessage('Capture already paused.');
            return;
        }
        if (!this.sessionManager.isCapturing()) {
            utils_1.window.showWarningMessage('Not capturing console input.');
            return;
        }
        this.sessionManager.setCapturePaused(true);
        utils_1.window.showInformationMessage('Paused capturing debug console input.');
    };
    _isValidFilename = (name) => {
        const invalidChars = /[<>:"\/\\|?*\x00-\x1F]/g;
        const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
        if (invalidChars.test(name) || reservedNames.test(name) || name.length > 255)
            return false;
        return true;
    };
    stopCapture = async (autoSave = false) => {
        if (!this.sessionManager.capturePaused() && !this.sessionManager.isCapturing()) {
            utils_1.window.showWarningMessage('Not capturing console input.');
            return;
        }
        const captureTerminationSignal = () => {
            this.sessionManager.setCapturing(false);
            this.emit('captureStopped'); // Emit event when capturing stops
        };
        const currentBreakpoint = this.sessionManager.getCurrentBreakpoint();
        if (!Object.keys(currentBreakpoint.content).length) {
            utils_1.window.showWarningMessage('Stopped: No console input captured.');
            captureTerminationSignal();
            return;
        }
        const defaultFileName = `${path_1.default.basename(currentBreakpoint.file)}_` +
            `${currentBreakpoint.line}_` +
            `${currentBreakpoint.column}_` +
            `${this.storageManager.getCurrentTimestamp()}`;
        let fileName;
        let invalidReason = "";
        while (true) {
            if (autoSave) {
                fileName = defaultFileName;
                break;
            }
            // Show input box to get the file name from the user
            fileName = await utils_1.window.showInputBox({
                prompt: invalidReason || 'Save console input:',
                value: defaultFileName,
                placeHolder: defaultFileName
            });
            // If the user presses Escape or enters nothing, exit the loop and return
            if (!fileName) {
                utils_1.window.showWarningMessage('Capture in progress, termination aborted.');
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
        captureTerminationSignal();
        this.storageManager.saveBreakpoint(currentBreakpoint, fileName);
        this.sessionManager.resetCurrentBeakpointContent();
        utils_1.window.showInformationMessage(`Stopped capture: ${fileName}`);
    };
    _selectScript = async () => {
        const scriptsMetaData = this.storageManager.breakpointFilesMetaData(); // This should return an array of script paths
        if (!scriptsMetaData.length) {
            utils_1.window.showInformationMessage('No saved breakpoints found.');
            return;
        }
        const selectedScript = await utils_1.window.showQuickPick(scriptsMetaData.map((meta) => ({
            label: meta.fileName,
            description: `Created: ${meta.createdAt} | Modified: ${meta.modifiedAt} | Size: ${meta.size} bytes`
        })), {
            placeHolder: 'Select a saved breakpoint script to edit',
            canPickMany: false
        });
        // If no script was selected (user canceled the QuickPick)
        if (!selectedScript) {
            utils_1.window.showInformationMessage('No script selected.');
            return;
        }
        return selectedScript.label;
    };
    _selectBreakpoint = async () => {
        const breakpoints = this.storageManager.loadBreakpoints();
        if (!breakpoints.length) {
            utils_1.window.showInformationMessage('No saved breakpoints found.');
            return;
        }
        const selectedBreakpoint = await utils_1.window.showQuickPick(breakpoints.map((bp) => ({
            label: bp.id,
            description: `File: ${bp.file} | Line: ${bp.line} | Column: ${bp.column}`
        })), {
            placeHolder: 'Select a breakpoint to assign scripts',
            canPickMany: false
        });
        if (!selectedBreakpoint) {
            utils_1.window.showInformationMessage('No breakpoint selected.');
            return;
        }
        return breakpoints.find((bp) => bp.id === selectedBreakpoint.label);
    };
    _confirmWarning = async (message) => {
        const selection = await vscode.window.showWarningMessage(message, { modal: true }, "Yes");
        return selection == "Yes";
    };
    editSavedScript = async () => {
        const selectedScript = await this._selectScript();
        if (selectedScript) {
            this.storageManager.openBreakpointScript(selectedScript);
        }
    };
    deleteSavedScript = async () => {
        const selectedScript = await this._selectScript();
        if (selectedScript) {
            this.storageManager.deleteBreakpointSript(selectedScript);
            utils_1.window.showInformationMessage(`Deleted: ${selectedScript}`);
        }
    };
    activateScripts = () => {
        const breakpoints = this.storageManager.loadBreakpoints();
        breakpoints.forEach((bp) => {
            bp.active;
        });
    };
    setPausedOnBreakpoint = (paused) => {
        this.pausedOnBreakpoint = paused;
    };
    // Methods using the reusable function
    purgeBreakpoints = async () => {
        const proceed = await this._confirmWarning("Are you sure you want to purge all breakpoints?");
        proceed && this.storageManager.purgeBreakpoints();
    };
    purgeScripts = async () => {
        const proceed = await this._confirmWarning("Are you sure you want to purge all scripts?");
        proceed && this.storageManager.purgeScripts();
    };
    purgeAll = async () => {
        const proceed = await this._confirmWarning("Are you sure you want to purge all data (breakpoints and scripts)?");
        proceed && this.storageManager.purgeAll();
    };
    setScriptRunnable = async (runnable) => {
        this.sessionManager.setScriptsRunnable(runnable);
        utils_1.commands.executeCommand('setContext', 'slugger.scriptsRunnable', runnable);
        utils_1.window.showInformationMessage(`Slugs are now ${runnable ? 'runnable' : 'not runnable'}.`);
    };
    assignScriptsToBreakpoint = async () => {
        const selected = await this._selectScript();
        if (!selected)
            return;
        const selectedBreakpoint = await this._selectBreakpoint();
        if (!selectedBreakpoint)
            return;
        this.storageManager.assignScriptsToBreakpoint(selectedBreakpoint, [selected]);
    };
}
exports.default = CommandHandler;
//# sourceMappingURL=commandHandler.js.map