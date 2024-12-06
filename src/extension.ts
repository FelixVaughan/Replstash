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
        registerCommand('replStash.startCapture', commandHandler.startCapture),
        registerCommand('replStash.stopCapture', commandHandler.stopCapture),
        registerCommand('replStash.pauseCapture', commandHandler.pauseCapture),
        registerCommand('replStash.editSavedScript', commandHandler.openScript),
        registerCommand('replStash.deleteSavedScript', commandHandler.deleteSavedScript),
        registerCommand('replStash.purgeBreakpoints', commandHandler.purgeBreakpoints),
        registerCommand('replStash.enableScriptsRunnable', () => commandHandler.setScriptRunnable(true)),
        registerCommand('replStash.disableScriptsRunnable', () => commandHandler.setScriptRunnable(false)),
        registerCommand('replStash.deleteBreakpoint', commandHandler.deleteBreakpoint),
        registerCommand('replStash.clearCapture', commandHandler.clearCapture),
        registerCommand('replStash.clearLastExp', commandHandler.clearLastExpression),
        registerCommand('replStash.discardCapture', commandHandler.discardCapture),
        registerCommand('replStash.renameSavedScript', commandHandler.renameSavedScript),
        registerCommand('replStash.purgeScripts', commandHandler.purgeScripts),
        // Tree view commands
        registerCommand('replStash.toggleElementActive', breakpointsTreeProvider.setElementActivation),
        registerCommand('replStash.deactivateSelected', breakpointsTreeProvider.deactivateSelectedItems),
        registerCommand('replStash.activateSelected', breakpointsTreeProvider.activateSelectedItems),
        registerCommand('replStash.copyScripts', breakpointsTreeProvider.copyScripts),
        registerCommand('replStash.pasteScripts', breakpointsTreeProvider.pasteScripts),
        registerCommand('replStash.openScripts', breakpointsTreeProvider.openScripts),
        registerCommand('replStash.runScripts', breakpointsTreeProvider.runScripts),
        registerCommand('replStash.removeBreakpointScripts', breakpointsTreeProvider.removeSelectedItems),
        registerCommand('replStash.runAllBreakpointScripts', breakpointsTreeProvider.runAllBreakpointScripts),
        registerCommand('replStash.treeRenameSavedScript', breakpointsTreeProvider.renameSavedScript),
        registerCommand('replStash.toggleTreeViewMode', breakpointsTreeProvider.toggleFlattenedView),
    ];

    // Set the initial context for scripts' runnability
    commands.executeCommand('setContext', 'replStash.scriptsRunnable', false);

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


//TODO: -> Clean up package.json 2 hrs
    //delete unused dependencies and commands
    //Setup and test command shortcuts
//TODO: Logo and publisher name - 1.5 hr
//TODO: Long: Test and find issues - 2 hrs


/**
 * TEST ISSUES:
 * - Ln description in treeview for breakpoint not always accurate
 * - Add capture state in bottom bar
 * - Empty scripts sometimes not removed
 * - When flattened view, entries should be sorted by name and description
 * - Breakpoints should turn purple when running
 * - start pause and stop capture should be available by right click in the debug console
 */