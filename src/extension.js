const vscode = require('vscode');
const StorageManager = require('./storageManager');
const SessionManager = require('./sessionManager');
const DebugAdapterTracker = require('./debugAdapterTracker');
const CommandHandler = require('./commandHandler');

/**
 * @param {vscode.ExtensionContext} context
 */
const activate = (context) => {
    const sessionManager = new SessionManager();
    const storageManager = new StorageManager(context);
    const commandHandler = new CommandHandler(sessionManager, storageManager);

    // Register debug adapter tracker factory
    const debugAdapterTrackerFactory = vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session) {
            return new DebugAdapterTracker(sessionManager, commandHandler); // Pass commandHandler to track capturing state
        }
    });

    // Commands
    const startCaptureCommand = vscode.commands.registerCommand('slugger.startCapture', commandHandler.startCapture);
    const stopCaptureCommand = vscode.commands.registerCommand('slugger.stopCapture', commandHandler.stopCapture);
    const pauseCommand = vscode.commands.registerCommand('slugger.pauseCapture', commandHandler.pauseCapture);
    const editScriptCommand = vscode.commands.registerCommand('slugger.editSavedScript', commandHandler.editSavedScript);
    const deleteScriptCommand = vscode.commands.registerCommand('slugger.deleteSavedScript', commandHandler.deleteSavedScript);
    const activateScriptsCommand = vscode.commands.registerCommand('slugger.activateScripts', commandHandler.activateScripts);


    // Add to subscriptions
    context.subscriptions.push(
        startCaptureCommand,
        stopCaptureCommand,
        pauseCommand,
        editScriptCommand,
        deleteScriptCommand,
        activateScriptsCommand,
        debugAdapterTrackerFactory
    );
};

const deactivate = () => {};

module.exports = {
    activate,
    deactivate,
};
