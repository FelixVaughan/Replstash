const vscode = require('vscode');
const StorageManager = require('./storageManager');
const SessionManager = require('./sessionManager');
const DebugAdapterTracker = require('./debugAdapterTracker');

/**
 * @param {vscode.ExtensionContext} context
 */
const activate = (context) => {
    const sessionManager = new SessionManager();
    const storageManager = new StorageManager(context);
    const debugAdapterTrackerFactory = vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session) {
            return new DebugAdapterTracker(sessionManager, storageManager);
        }
    });

    // Start and end debug session listeners
    const startDebugSessionDisposable = vscode.debug.onDidStartDebugSession(session => {
        vscode.window.showInformationMessage(`Debug session started: ${session.name}`);
        vscode.debug.activeDebugConsole.appendLine(`Debug session started: ${session.name}`);
    });

    const endDebugSessionDisposable = vscode.debug.onDidTerminateDebugSession(session => {
        vscode.window.showInformationMessage(`Debug session ended: ${session.name}`);
        storageManager.saveBreakpoints(sessionManager.getBreakpoints());
        storageManager.saveSessionOutput(sessionManager.getSessionOutput(), session.id);
        sessionManager.reset();
    });

    // Register disposables
    context.subscriptions.push(
        startDebugSessionDisposable,
        endDebugSessionDisposable,
        debugAdapterTrackerFactory
    );
};

const deactivate = () => {};

module.exports = {
    activate,
    deactivate,
};