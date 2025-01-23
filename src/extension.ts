import * as vscode from 'vscode';
import { Disposable, DebugSession } from 'vscode';
import StorageManager from './storageManager';
import DebugAdapterTracker from './debugAdapterTracker';
import CommandHandler from './commandHandler';
import BreakpointsTreeProvider from './breakpointsTreeProvider';
import ReplResultsTreeProvider from './replResultsTreeProvider';
import BreakpointDecorationProvider from './breakpointDecorationProvider';
import { _debugger, commands } from './utils';
import { window } from './utils';
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
    const replResultsTreeProvider: ReplResultsTreeProvider = ReplResultsTreeProvider.instance;

    // Create the tree view for breakpoints
    const breakpointsTreeView = breakpointsTreeProvider.createTreeView();
    const replResultsTreeView = replResultsTreeProvider.createTreeView();

    /**
     * Registers a debug adapter tracker factory to monitor debug sessions.
     */
    const debugAdapterTrackerFactory: Disposable = _debugger.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session: DebugSession) {
            console.log(`Tracking Session: ${session.id}`);
            return new DebugAdapterTracker(commandHandler); // Pass commandHandler to track capturing state
        }
    });

    const decorationProvider = BreakpointDecorationProvider.instance;
    const decorationDisposable = window.registerFileDecorationProvider(decorationProvider);

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
        registerCommand('replstash.startCapture', commandHandler.startCapture),
        registerCommand('replstash.stopCapture', commandHandler.stopCapture),
        registerCommand('replstash.pauseCapture', commandHandler.pauseCapture),
        registerCommand('replstash.editSavedScript', commandHandler.openScript),
        registerCommand('replstash.deleteSavedScript', commandHandler.deleteSavedScript),
        registerCommand('replstash.purgeBreakpoints', commandHandler.purgeBreakpoints),
        registerCommand('replstash.enableScriptsRunnable', () => commandHandler.setAutomaticRuns(true)),
        registerCommand('replstash.disableScriptsRunnable', () => commandHandler.setAutomaticRuns(false)),
        registerCommand('replstash.deleteBreakpoint', commandHandler.deleteBreakpoint),
        registerCommand('replstash.clearCapture', commandHandler.clearCapture),
        registerCommand('replstash.clearLastExp', commandHandler.clearLastExpression),
        registerCommand('replstash.discardCapture', commandHandler.discardCapture),
        registerCommand('replstash.renameSavedScript', commandHandler.renameSavedScript),
        registerCommand('replstash.purgeScripts', commandHandler.purgeScripts),
        registerCommand('replstash.toggleCapture', commandHandler.toggleCapture),
        registerCommand('replstash.toggleAutoRun', commandHandler.toggleAutoRun),
        registerCommand('replstash.outputCapture', commandHandler.outputCapture),

        // Breakpoint Tree view commands
        registerCommand('replstash.toggleElementActive', breakpointsTreeProvider.setElementActivation),
        registerCommand('replstash.deactivateSelected', breakpointsTreeProvider.deactivateSelectedItems),
        registerCommand('replstash.activateSelected', breakpointsTreeProvider.activateSelectedItems),
        registerCommand('replstash.copyScripts', breakpointsTreeProvider.copyScripts),
        registerCommand('replstash.pasteScripts', breakpointsTreeProvider.pasteScripts),
        registerCommand('replstash.openScripts', breakpointsTreeProvider.openScripts),
        registerCommand('replstash.runScripts', breakpointsTreeProvider.runScripts),
        registerCommand('replstash.removeBreakpointScripts', breakpointsTreeProvider.removeSelectedItems),
        registerCommand('replstash.runAllBreakpointScripts', breakpointsTreeProvider.runAllBreakpointScripts),
        registerCommand('replstash.treeRenameSavedScript', breakpointsTreeProvider.renameSavedScript),
        registerCommand('replstash.toggleBreakpointTreeViewMode', breakpointsTreeProvider.toggleFlattenedView),

        // Evaluation Results Tree view commands
        registerCommand('replstash.toggleReplTreeViewMode', replResultsTreeProvider.toggleReplTreeViewMode),
        registerCommand('replstash.copyErrorStack', replResultsTreeProvider.copyStackTrace),
        registerCommand('replstash.openRanScripts', replResultsTreeProvider.openScripts),
        registerCommand('replstash.jumpToBreakpoint', replResultsTreeProvider.jumpToBreakpoint),
    ];

    // Add disposables and other subscriptions to the extension's lifecycle
    context.subscriptions.push(
        ...disposableCommands,
        decorationDisposable,
        debugAdapterTrackerFactory,
        breakpointsTreeView,
        replResultsTreeView
    );
};

/**
 * Deactivates the extension. This function is called when the extension is unloaded.
 */
export const deactivate = (): void => {};

 

//TODO: README.md - 2.5 hr
//TODO: Logo and publisher name - 1.5 hr

/**
 * TEST ISSUES:
 * - Ln description in treeview for breakpoint not always accurate
 * - Empty scripts sometimes not removed
 * - Show autorun status on repl-stash view
 * - Copy and paste single script via context
 * - Make activation toggle multi select
 * - Right click in tree view to create new script (append a new script to bps list)
 * - When a breakpoint is toggled off and on, it is unlinked but when created again, a new breakpoint is created
        -basically need to restore unlinked
Estimated completions date : MARCH 15, 2025
 */

