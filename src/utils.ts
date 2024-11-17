import * as vscode from 'vscode';
import BreakpointsTreeProvider from './breakpointsTreeProvider';
import StorageManager from './storageManager';

export const _debugger = vscode.debug;
export const window = vscode.window;
export const commands = vscode.commands;
export const EventEmitter = vscode.EventEmitter;

export interface Script {
    uri: string;
    active: boolean;
}

export interface Breakpoint {
    id: string;
    threadId: number;
    line: number;
    column: number;
    active: boolean;
    file: string;
    scripts: Script[];
    createdAt?: string;
    modifiedAt?: string;
    content: Record<string, string>;
    linked: boolean;
}


export interface ScriptsMetaData {
    fileName: string;
    fullPath: string;
    size: number;
    createdAt: string;
    modifiedAt: string;
}

export interface LabeledItem {
    label: any;
    description: string;
}


export const { showWarningMessage, showInformationMessage, showErrorMessage} = vscode.window;

export const refreshTree = (): void => {
    BreakpointsTreeProvider.instance.refresh();
}

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

    const _getThreadId = async (): Promise<number | null> => {
        const threadsResponse = await activeSession.customRequest('threads');
        const threads = threadsResponse.threads;
        if (threads?.length) return null;
        const activeThread = threads[0];
        return activeThread.id;
    }

    const _evaluate = async (uri: string, frameId: number): Promise<number> => {
        const scriptContent: string | null = StorageManager.instance.getScriptContent(uri)
        if (!scriptContent) return -1;
        try{
            await activeSession.customRequest('evaluate', {
                expression: scriptContent,
                context: 'repl',
                frameId: frameId,
            });
        }catch(err){
            return 0;
        } return 1;
    }

    try {
        threadId = threadId || await _getThreadId();
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
        showWarningMessage(`An error occurred`);
    }
};

export const isValidFilename = (name: string): boolean => {
    const invalidChars: RegExp = /[<>:"\/\\|?*\x00-\x1F]/g;
    const reservedNames: RegExp = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    if (invalidChars.test(name) || reservedNames.test(name) || name.length > 255)
        return false;
    return true;
}

export const isBreakpoint = (e: Script | Breakpoint): boolean => Object.hasOwn(e, 'scripts')