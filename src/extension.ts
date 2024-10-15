import * as vscode from 'vscode';
import { Disposable, DebugSession } from 'vscode';
import StorageManager from './storageManager';
import SessionManager from './sessionManager';
import DebugAdapterTracker from './debugAdapterTracker';
import CommandHandler from './commandHandler';
import BreakpointsTreeProvider from './breakpointsTreeProvider';
import { _debugger, Breakpoint, Script } from './utils';

/**
 * @param {vscode.ExtensionContext} context
 */
export const activate = (context: vscode.ExtensionContext): void => {
    const sessionManager: SessionManager = new SessionManager();
    const storageManager: StorageManager = new StorageManager(context);
    const commandHandler: CommandHandler = new CommandHandler(sessionManager, storageManager);
    const breakpointsTreeProvider: BreakpointsTreeProvider = new BreakpointsTreeProvider(storageManager);
    const treeView: vscode.TreeView<Breakpoint | Script> = breakpointsTreeProvider.createTreeView(); 

    const debugAdapterTrackerFactory: Disposable = _debugger.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session: DebugSession) {
            console.log(`Tracking Session: ${session.id}`);
            return new DebugAdapterTracker(sessionManager, commandHandler, storageManager); // Pass commandHandler to track capturing state
        }
    });

    const registerCommand = (commandId: string, commandFunction: (...args: any[]) => any) => {
        return vscode.commands.registerCommand(commandId, commandFunction);
    };

    const commands: Disposable[] = [
        registerCommand('slugger.startCapture', commandHandler.startCapture),
        registerCommand('slugger.stopCapture', commandHandler.stopCapture),
        registerCommand('slugger.pauseCapture', commandHandler.pauseCapture),
        registerCommand('slugger.editSavedScript', commandHandler.editSavedScript),
        registerCommand('slugger.deleteSavedScript', commandHandler.deleteSavedScript),
        registerCommand('slugger.loadScripts', commandHandler.activateScripts),
        registerCommand('slugger.toggleElementActive', breakpointsTreeProvider.setElementActivation),
        registerCommand('slugger.purgeBreakpoints', commandHandler.purgeBreakpoints),
        registerCommand('slugger.enableScriptsRunnable', () => commandHandler.setScriptRunnable(true)),
        registerCommand('slugger.disableScriptsRunnable', () => commandHandler.setScriptRunnable(false)),
    ];

    vscode.commands.executeCommand('setContext', 'slugger.scriptsRunnable', false);

    context.subscriptions.push(
        ...commands, 
        debugAdapterTrackerFactory, 
        treeView
    );

};

export const deactivate = (): void => {};
