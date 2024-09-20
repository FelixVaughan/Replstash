// const vscode = require('vscode');
// const StorageManager = require('./storageManager');
// const SessionManager = require('./sessionManager');
// const DebugAdapterTracker = require('./debugAdapterTracker');
// const CommandHandler = require('./commandHandler');



// /**
//  * @param {vscode.ExtensionContext} context
//  */
// const activate = (context) => {
//     const sessionManager = new SessionManager();
//     const storageManager = new StorageManager(context);

//     const debugAdapterTrackerFactory = vscode.debug.registerDebugAdapterTrackerFactory('*', {
//         createDebugAdapterTracker(session) {
//             return new DebugAdapterTracker(sessionManager, storageManager);
//         }
//     });

//     // Start and end debug session listeners
//     const startDebugSessionDisposable = vscode.debug.onDidStartDebugSession(session => {
//         vscode.window.showInformationMessage(`Debug session started: ${session.name}`);
//         vscode.debug.activeDebugConsole.appendLine(`Debug session started: ${session.name}`);
//     });

//     const endDebugSessionDisposable = vscode.debug.onDidTerminateDebugSession(session => {
//         vscode.window.showInformationMessage(`Debug session ended: ${session.name}`);
//         storageManager.saveBreakpoints(sessionManager.getBreakpoints());
//         storageManager.saveSessionOutput(sessionManager.getSessionOutput(), session.id);
//         sessionManager.reset();
//     });

//     // Register disposables
//     context.subscriptions.push(
//         startDebugSessionDisposable,
//         endDebugSessionDisposable,
//         debugAdapterTrackerFactory
//     );
// };

// const deactivate = () => {};

// module.exports = {
//     activate,
//     deactivate,
// };


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

    // Command: Start capturing
    const startCaptureCommand = vscode.commands.registerCommand('slugger.startCapture', () => {
        commandHandler.startCapture();
    });

    // Command: Stop capturing and save
    const stopCaptureCommand = vscode.commands.registerCommand('slugger.stopCapture', () => {
        commandHandler.stopCapture();
    });

    // Command: Activate saved scripts (breakpoints)
    const activateScriptsCommand = vscode.commands.registerCommand('slugger.activateScripts', () => {
        commandHandler.activateScripts();
    });

    // Add to subscriptions
    context.subscriptions.push(
        startCaptureCommand,
        stopCaptureCommand,
        activateScriptsCommand,
        debugAdapterTrackerFactory
    );
};

const deactivate = () => {};

module.exports = {
    activate,
    deactivate,
};
