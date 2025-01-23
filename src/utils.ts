import * as vscode from 'vscode';
import BreakpointsTreeProvider from './breakpointsTreeProvider';
import StorageManager from './storageManager';
import ReplResultsPool from './replResultsPool';
import path from 'path';

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
    bId: string;
    error: boolean;
}

/**
 * InvalidSaveError thrown when a capture save is unsuccessful 
 */

export enum InvalidReason {
    InvalidFileName = 'Invalid file name',
    InvalidContent = 'Invalid content',
    FileExists = 'File already exist',
    None = 'None'
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
    /** Unique idetifier*/
    id: string;
}

/**
 * Represents the result of evaluating a script.
 */
export type ReplResult = {

    /**Uri of ran repl*/
    script?: string;

    /** Unique identifier for the breakpoint. */
    bId?: string;

    /** Exit code indicating the outcome of the evaluation (0 for failure, 1 for success). */
    statusCode: number;

    /** Indicates whether the evaluation was successful. */
    success: boolean;

    /** Stack trace of the error, if any (empty string if successful). */
    stack: string;
};


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
    return new Date().toISOString().replace('T', ' ').slice(0, 19).replace(/:/g, '-');
};

/**
 * Evaluates scripts by executing them in the active debug session.
 * 
 * @param scripts - An array of script URIs to evaluate.
 * @param threadId - The ID of the thread to evaluate the scripts in. If not provided, the active thread ID will be used.
 * @returns A Promise that resolves to a ReplEvaluationResult.
 */
export const evaluateScripts = async (scripts: Script[], threadId: number | null = null): Promise<ReplResult[]> => {
    const activeSession = _debugger?.activeDebugSession;
    if (!activeSession) return [];

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
     */

    const _evaluate = async (uri: string, frameId: number): Promise<ReplResult> => {
        const scriptContent: string | null = StorageManager.instance.getScriptContent(uri);
        if (!scriptContent) 
            return {
                statusCode: 0, 
                success: false, 
                stack: ''
            };
        try {
            await activeSession.customRequest('evaluate', {
                expression: scriptContent,
                context: 'repl',
                frameId: frameId,
            });
            return {
                statusCode: 1, 
                success: true, 
                stack: ''
            };
        } catch (err: any) {
            return {
                statusCode: 0, 
                success: false, 
                stack: err?.stack || ''
            };
        }
    };

    const results: ReplResult[] = [];
    try {
        threadId = threadId || (await _getThreadId());
        const stackTraceResponse = await activeSession.customRequest('stackTrace', { threadId });
        if (!stackTraceResponse?.stackFrames?.length) return results;

        const topFrame: Record<string, any> = stackTraceResponse.stackFrames[0];
        const frameId = topFrame.id;

        const errorDecoration = vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            backgroundColor: 'rgba(255, 0, 0, 0.3)', // Red background for errors
        });
        
        const successDecoration = vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            backgroundColor: 'rgba(0, 255, 0, 0.3)', // Green background for success
        });

        const editor = vscode.window.activeTextEditor;
        const breakpoints = vscode.debug.breakpoints;

        await Promise.all(scripts.map(async (script: Script) => {
            const result: ReplResult = await _evaluate(script.uri, frameId);
            script.error = !result.success;
            const bp = breakpoints.find(b => b.id === script.bId);
    
            if (bp && bp instanceof vscode.SourceBreakpoint) {
                const activeBreakpointDecoration = result.success ? successDecoration : errorDecoration;
                editor?.setDecorations(activeBreakpointDecoration, [{ range: bp.location.range }]);
                setTimeout(() => {
                    editor?.setDecorations(activeBreakpointDecoration, []);
                }, 500); // 0.5 seconds
            }
            results.push({script: script.uri, bId: script.bId, ...result});
        }));
    } catch (error) {
        showWarningMessage('An error occurred evaulating the scripts.');
    }finally{
        StorageManager.instance.updateLoadedBreakpoints();
        ReplResultsPool.instance.send(results);
        return results;
    }
};


/**
 * 
 * @param bp - The breakpoint to describe.
 * @returns A string description of the breakpoint.
 */
export const describe = (bp: Breakpoint, length: boolean = true) => {
    let result = `${path.dirname(bp.file)}@Ln ${bp.line}, Col ${bp.column}`;
    if (length) result += `- {${bp.scripts.length}}`; 
    return result;
}

/**
 * Determines if the given object is a breakpoint.
 * 
 * @param e - The object to check.
 * @returns {boolean} True if the object is a breakpoint, false otherwise.
 */
export const isBreakpoint = (e: Script | Breakpoint | ReplResult): boolean => Object.hasOwn(e, 'scripts');
export const isReplResult = (e: Script | Breakpoint | ReplResult): boolean => Object.hasOwn(e, 'statusCode');