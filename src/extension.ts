import * as vscode from 'vscode';
import { Disposable, DebugSession } from 'vscode';
import StorageManager from './storageManager';
import DebugAdapterTracker from './debugAdapterTracker';
import CommandHandler from './commandHandler';
import BreakpointsTreeProvider from './breakpointsTreeProvider';
import { _debugger, commands } from './utils';


//TODO: -> Disappear error messages faster
/**
 * 
    * @param {vscode.ExtensionContext} context
 */
export const activate = (context: vscode.ExtensionContext): void => {
    StorageManager.setContext(context);
    const commandHandler: CommandHandler = CommandHandler.instance;
    const breakpointsTreeProvider: BreakpointsTreeProvider = BreakpointsTreeProvider.instance;
    const treeView = breakpointsTreeProvider.createTreeView();

    const debugAdapterTrackerFactory: Disposable = _debugger.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session: DebugSession) {
            console.log(`Tracking Session: ${session.id}`);
            return new DebugAdapterTracker(commandHandler); // Pass commandHandler to track capturing state
        }
    });

    const registerCommand = (commandId: string, commandFunction: (...args: any[]) => any) => {
        return commands.registerCommand(commandId, commandFunction);
    };

    const disposableCommands: Disposable[] = [
        //command palette commands
        registerCommand('slugger.startCapture', commandHandler.startCapture),
        registerCommand('slugger.stopCapture', commandHandler.stopCapture),
        registerCommand('slugger.pauseCapture', commandHandler.pauseCapture),
        registerCommand('slugger.editSavedScript', commandHandler.openScript),
        registerCommand('slugger.deleteSavedScript', commandHandler.deleteSavedScript),
        registerCommand('slugger.loadScripts', commandHandler.activateScripts),
        registerCommand('slugger.purgeBreakpoints', commandHandler.purgeBreakpoints),
        registerCommand('slugger.enableScriptsRunnable', () => commandHandler.setScriptRunnable(true)),
        registerCommand('slugger.disableScriptsRunnable', () => commandHandler.setScriptRunnable(false)),
        registerCommand('slugger.assignScriptsToBreakpoint', commandHandler.assignScriptsToBreakpoint),
        registerCommand('slugger.deleteBreakpoint', commandHandler.deleteBreakpoint),
        registerCommand('slugger.clearCapture', commandHandler.clearCapture),
        registerCommand('slugger.clearLastExp', commandHandler.clearLastExpression),
        registerCommand('slugger.discardCapture', commandHandler.discardCapture),
        //tree view commands
        registerCommand('slugger.toggleElementActive', breakpointsTreeProvider.setElementActivation),
        registerCommand('slugger.deactivateSelected', breakpointsTreeProvider.deactivateSelectedItems),
        registerCommand('slugger.activateSelected', breakpointsTreeProvider.activateSelectedItems),
        registerCommand('slugger.copyScripts', breakpointsTreeProvider.copyScripts),
        registerCommand('slugger.pasteScripts', breakpointsTreeProvider.pasteScripts),
        registerCommand('slugger.openScripts', breakpointsTreeProvider.openScripts),
        registerCommand('slugger.runScripts', breakpointsTreeProvider.runScripts),
        registerCommand('slugger.removeBreakpointScripts', breakpointsTreeProvider.removeBreakpointScripts),
        registerCommand('slugger.runAllBreakpointScripts', breakpointsTreeProvider.runAllBreakpointScripts),
    ];

    commands.executeCommand('setContext', 'slugger.scriptsRunnable', false);

    context.subscriptions.push(
        ...disposableCommands, 
        debugAdapterTrackerFactory, 
        treeView
    );

};

export const deactivate = (): void => {};
