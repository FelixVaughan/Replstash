import * as vscode from 'vscode';
import { Disposable, DebugSession } from 'vscode';
import StorageManager from './storageManager';
import DebugAdapterTracker from './debugAdapterTracker';
import CommandHandler from './commandHandler';
import BreakpointsTreeProvider from './breakpointsTreeProvider';
import { _debugger, commands } from './utils';

/**
 * Activates the VS Code extension, setting up commands, tree views, and debug trackers.
 * 
 * @param context - The extension context provided by VS Code during activation.
 */
export const activate = (context: vscode.ExtensionContext): void => {
    // Initialize the storage manager with the extension context
    StorageManager.setContext(context);

    // Singleton instances of command and tree providers
    const commandHandler: CommandHandler = CommandHandler.instance;
    const breakpointsTreeProvider: BreakpointsTreeProvider = BreakpointsTreeProvider.instance;

    // Create the tree view for breakpoints
    const treeView = breakpointsTreeProvider.createTreeView();

    /**
     * Registers a debug adapter tracker factory to monitor debug sessions.
     */
    const debugAdapterTrackerFactory: Disposable = _debugger.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session: DebugSession) {
            console.log(`Tracking Session: ${session.id}`);
            return new DebugAdapterTracker(commandHandler); // Pass commandHandler to track capturing state
        }
    });

    /**
     * Helper function to register a command in VS Code.
     * 
     * @param commandId - The unique identifier for the command.
     * @param commandFunction - The function to execute when the command is invoked.
     * @returns A disposable representing the registered command.
     */
    const registerCommand = (commandId: string, commandFunction: (...args: any[]) => any) => {
        return commands.registerCommand(commandId, commandFunction);
    };

    // List of commands registered in the extension
    const disposableCommands: Disposable[] = [
        // Command palette commands
        registerCommand('slugger.startCapture', commandHandler.startCapture),
        registerCommand('slugger.stopCapture', commandHandler.stopCapture),
        registerCommand('slugger.pauseCapture', commandHandler.pauseCapture),
        registerCommand('slugger.editSavedScript', commandHandler.openScript),
        registerCommand('slugger.deleteSavedScript', commandHandler.deleteSavedScript),
        registerCommand('slugger.purgeBreakpoints', commandHandler.purgeBreakpoints),
        registerCommand('slugger.enableScriptsRunnable', () => commandHandler.setScriptRunnable(true)),
        registerCommand('slugger.disableScriptsRunnable', () => commandHandler.setScriptRunnable(false)),
        registerCommand('slugger.assignScriptsToBreakpoint', commandHandler.assignScriptsToBreakpoint),
        registerCommand('slugger.deleteBreakpoint', commandHandler.deleteBreakpoint),
        registerCommand('slugger.clearCapture', commandHandler.clearCapture),
        registerCommand('slugger.clearLastExp', commandHandler.clearLastExpression),
        registerCommand('slugger.discardCapture', commandHandler.discardCapture),
        registerCommand('slugger.renameSavedScript', commandHandler.renameSavedScript),
        registerCommand('slugger.purgeScripts', commandHandler.purgeScripts),
        // Tree view commands
        registerCommand('slugger.toggleElementActive', breakpointsTreeProvider.setElementActivation),
        registerCommand('slugger.deactivateSelected', breakpointsTreeProvider.deactivateSelectedItems),
        registerCommand('slugger.activateSelected', breakpointsTreeProvider.activateSelectedItems),
        registerCommand('slugger.copyScripts', breakpointsTreeProvider.copyScripts),
        registerCommand('slugger.pasteScripts', breakpointsTreeProvider.pasteScripts),
        registerCommand('slugger.openScripts', breakpointsTreeProvider.openScripts),
        registerCommand('slugger.runScripts', breakpointsTreeProvider.runScripts),
        registerCommand('slugger.removeBreakpointScripts', breakpointsTreeProvider.removeSelectedItems),
        registerCommand('slugger.runAllBreakpointScripts', breakpointsTreeProvider.runAllBreakpointScripts),
        registerCommand('slugger.treeRenameSavedScript', breakpointsTreeProvider.renameSavedScript),
        registerCommand('slugger.toggleTreeViewMode', breakpointsTreeProvider.toggleFlattenedView),
    ];

    // Set the initial context for scripts' runnability
    commands.executeCommand('setContext', 'slugger.scriptsRunnable', false);

    // Add disposables and other subscriptions to the extension's lifecycle
    context.subscriptions.push(
        ...disposableCommands,
        debugAdapterTrackerFactory,
        treeView
    );
};

/**
 * Deactivates the extension. This function is called when the extension is unloaded.
 */
export const deactivate = (): void => {};


//TODO: -> Minor test - 30 mins
//TODO: Clean up package.json 2 hrs
//TODO: Change save-debug tp save-repl - 1 hr
//TODO: Publisher name - 1 hr
//TODO: Create logo - 30 mins
//TODO: Long: Test and find issues - 2 hrs


/**
 * TEST ISSUES:
 * 1. Line description in treeview for breakpoint not always accurate
 */