import * as vscode from 'vscode';
import BreakpointsTreeProvider from './breakpointsTreeProvider';
import StorageManager from './storageManager';

/** Alias for the VS Code debug namespace. */
export const _debugger = vscode.debug;
/** Alias for the VS Code window namespace. */
export const window = vscode.window;
/** Alias for the VS Code commands namespace. */
export const commands = vscode.commands;
/** Alias for the VS Code EventEmitter. */
export const EventEmitter = vscode.EventEmitter;

/**
 * Represents a script that can be executed in a debugging session.
 */
export interface Script {
    /** URI of the script file. */
    uri: string;
    /** Indicates whether the script is active. */
    active: boolean;
}

/**
 * Represents a breakpoint in the code with associated metadata.
 */
export interface Breakpoint {
    /** Unique identifier for the breakpoint. */
    id: string;
    /** Thread ID associated with the breakpoint. */
    threadId: number;
    /** Line number of the breakpoint in the source file. */
    line: number;
    /** Column number of the breakpoint in the source file. */
    column: number;
    /** Indicates whether the breakpoint is active. */
    active: boolean;
    /** File path of the source file containing the breakpoint. */
    file: string;
    /** List of scripts associated with the breakpoint. */
    scripts: Script[];
    /** Timestamp when the breakpoint was created. */
    createdAt?: string;
    /** Timestamp when the breakpoint was last modified. */
    modifiedAt?: string;
    /** Captured content for the breakpoint. */
    content: Record<string, string>;
    /** Indicates if the breakpoint is linked to a source file. */
    linked: boolean;
}

/**
 * Metadata information for saved scripts.
 */
export interface ScriptsMetaData {
    /** Name of the script file. */
    fileName: string;
    /** Full path to the script file. */
    fullPath: string;
    /** Size of the script file in bytes. */
    size: number;
    /** Timestamp of when the script file was created. */
    createdAt: string;
    /** Timestamp of when the script file was last modified. */
    modifiedAt: string;
}

/**
 * Represents an item with a label and description, often used in UI components.
 */
export interface LabeledItem {
    /** Label text for the item. */
    label: any;
    /** Description text for the item. */
    description: string;
}

/** Show a warning message in the VS Code UI. */
export const { showWarningMessage, showInformationMessage, showErrorMessage } = vscode.window;

/**
 * Refreshes the Breakpoints Tree View.
 */
export const refreshTree = (): void => {
    BreakpointsTreeProvider.instance.refresh();
};

/**
 * Generates the current timestamp in a file-safe format.
 * 
 * @returns {string} The current timestamp in the format `YYYY-MM-DD_HH-MM-SS`.
 */
export const getCurrentTimestamp = (): string => {
    return new Date().toISOString().replace('T', '_').slice(0, 19).replace(/:/g, '-');
};

/**
 * Evaluates scripts by executing them in the active debug session.
 * 
 * @param uris - An array of script URIs to evaluate.
 * @param threadId - The ID of the thread to evaluate the scripts in. If not provided, the active thread ID will be used.
 * @returns A Promise that resolves to void.
 */
export const evaluateScripts = async (uris: string[], threadId: number | null = null): Promise<void> => {
    const activeSession = _debugger?.activeDebugSession;
    if (!activeSession) return;

    /**
     * Retrieves the active thread ID.
     * 
     * @returns A Promise that resolves to the active thread ID or null if none are available.
     */
    const _getThreadId = async (): Promise<number | null> => {
        const threadsResponse = await activeSession.customRequest('threads');
        const threads = threadsResponse.threads;
        if (!threads?.length) return null;
        return threads[0].id;
    };

    /**
     * Evaluates a single script in the given frame.
     * 
     * @param uri - The URI of the script to evaluate.
     * @param frameId - The ID of the stack frame to evaluate the script in.
     * @returns A Promise that resolves to an evaluation status code:
     *          -1: Script is empty
     *           0: Evaluation error
     *           1: Evaluation succeeded
     */
    const _evaluate = async (uri: string, frameId: number): Promise<number> => {
        const scriptContent: string | null = StorageManager.instance.getScriptContent(uri);
        if (!scriptContent) return -1;
        try {
            await activeSession.customRequest('evaluate', {
                expression: scriptContent,
                context: 'repl',
                frameId: frameId,
            });
            return 1;
        } catch (err) {
            return 0;
        }
    };

    try {
        threadId = threadId || (await _getThreadId());
        const stackTraceResponse = await activeSession.customRequest('stackTrace', { threadId });
        if (!stackTraceResponse?.stackFrames?.length) return;

        const topFrame: Record<string, any> = stackTraceResponse.stackFrames[0];
        const frameId = topFrame.id;

        uris.forEach(async (uri: string) => {
            const status: number = await _evaluate(uri, frameId);
            if (status === -1) showWarningMessage(`Script: ${uri} is empty.`);
            else if (status === 0) showWarningMessage(`An error occurred on: ${uri}`);
            else showInformationMessage(`Successfully ran: ${uri}`);
        });
    } catch (error) {
        showWarningMessage('An error occurred');
    }
};

/**
 * Validates a filename against reserved names and invalid characters.
 * 
 * @param name - The filename to validate.
 * @returns {boolean} True if the filename is valid, false otherwise.
 */
export const isValidFilename = (name: string): boolean => {
    const invalidChars: RegExp = /[<>:"\/\\|?*\x00-\x1F]/g;
    const reservedNames: RegExp = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    return !invalidChars.test(name) && !reservedNames.test(name) && name.length <= 255;
};

/**
 * Determines if the given object is a breakpoint.
 * 
 * @param e - The object to check.
 * @returns {boolean} True if the object is a breakpoint, false otherwise.
 */
export const isBreakpoint = (e: Script | Breakpoint): boolean => Object.hasOwn(e, 'scripts');
