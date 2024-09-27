import * as vscode from 'vscode';
import { Disposable, DebugSession } from 'vscode';
import StorageManager from './storageManager';
import SessionManager from './sessionManager';
import DebugAdapterTracker from './debugAdapterTracker';
import CommandHandler from './commandHandler';

/**
 * @param {vscode.ExtensionContext} context
 */
export const activate = (context: vscode.ExtensionContext) => {
    const sessionManager: SessionManager = new SessionManager();
    const storageManager: StorageManager = new StorageManager(context);
    const commandHandler: CommandHandler = new CommandHandler(sessionManager, storageManager);

    // Register debug adapter tracker factory
    const debugAdapterTrackerFactory = vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session: DebugSession) {
            console.log(`Tracking Session: ${session.id}`);
            return new DebugAdapterTracker(sessionManager, commandHandler); // Pass commandHandler to track capturing state
        }
    });

    // Commands
    const startCaptureCommand: Disposable = vscode.commands.registerCommand('slugger.startCapture', commandHandler.startCapture);
    const stopCaptureCommand: Disposable = vscode.commands.registerCommand('slugger.stopCapture', commandHandler.stopCapture);
    const pauseCommand: Disposable = vscode.commands.registerCommand('slugger.pauseCapture', commandHandler.pauseCapture);
    const editScriptCommand: Disposable = vscode.commands.registerCommand('slugger.editSavedScript', commandHandler.editSavedScript);
    const deleteScriptCommand: Disposable = vscode.commands.registerCommand('slugger.deleteSavedScript', commandHandler.deleteSavedScript);
    const activateScriptsCommand: Disposable = vscode.commands.registerCommand('slugger.activateScripts', commandHandler.activateScripts);


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

export const deactivate = () => {};
