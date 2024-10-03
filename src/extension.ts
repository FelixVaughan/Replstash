import * as vscode from 'vscode';
import { Disposable, DebugSession } from 'vscode';
import StorageManager from './storageManager';
import SessionManager from './sessionManager';
import DebugAdapterTracker from './debugAdapterTracker';
import CommandHandler from './commandHandler';
import { _debugger } from './utils';

/**
 * @param {vscode.ExtensionContext} context
 */
export const activate = (context: vscode.ExtensionContext): void => {
    const sessionManager: SessionManager = new SessionManager();
    const storageManager: StorageManager = new StorageManager(context);
    const commandHandler: CommandHandler = new CommandHandler(sessionManager, storageManager);

    // Register debug adapter tracker factory
    const debugAdapterTrackerFactory: Disposable = _debugger.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session: DebugSession) {
            console.log(`Tracking Session: ${session.id}`);
            return new DebugAdapterTracker(sessionManager, commandHandler); // Pass commandHandler to track capturing state
        }
    });

    // Command registration helper
    const registerCommand = (commandId: string, commandFunction: (...args: any[]) => any) => {
        return vscode.commands.registerCommand(commandId, commandFunction);
    };

    // Register all commands with a helper function
    const commands: Disposable[] = [
        registerCommand('slugger.startCapture', commandHandler.startCapture),
        registerCommand('slugger.stopCapture', commandHandler.stopCapture),
        registerCommand('slugger.pauseCapture', commandHandler.pauseCapture),
        registerCommand('slugger.editSavedScript', commandHandler.editSavedScript),
        registerCommand('slugger.deleteSavedScript', commandHandler.deleteSavedScript),
        registerCommand('slugger.activateScripts', commandHandler.activateScripts)
    ];

    // Add all disposables (commands and tracker) to the subscriptions
    context.subscriptions.push(...commands, debugAdapterTrackerFactory);

};

export const deactivate = (): void => {};
