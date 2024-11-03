import * as vscode from 'vscode';
import BreakpointsTreeProvider from './breakpointsTreeProvider';

export const _debugger = vscode.debug;
export const window = vscode.window;
export const commands = vscode.commands;
export const EventEmitter = vscode.EventEmitter;

//TODO: Enums for messages
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
}


export interface BreakpointMetaData {
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


export const { showWarningMessage, showInformationMessage } = vscode.window;

export const refreshTree = (): void => {
    BreakpointsTreeProvider.instance.refresh();
}

export const evaluateScripts = async (uris: string[], threadId: number | null = null): Promise<void> => {
    const activeSession = _debugger?.activeDebugSession;
    if (!activeSession) return;

    try {
        if(!threadId){
            const threadsResponse = await activeSession.customRequest('threads');
            const threads = threadsResponse.threads;
            if (threads.length === 0) return;

            const activeThread = threads[0];
            threadId = activeThread.id;
        }

        const stackTraceResponse = await activeSession.customRequest('stackTrace', { threadId });
        if (!stackTraceResponse?.stackFrames?.length) return;
        const topFrame = stackTraceResponse.stackFrames[0];
        const frameId = topFrame.id;

        for (const uri of uris) {
            const scriptContent = storageManager.getScriptContent(script.uri)
            const response = await activeSession.customRequest('evaluate', {
                expression: scriptContent,
                context: 'repl',
                frameId: frameId,
            });
            if (response.success) {
                showInformationMessage(`${uri} ran successfully.`);
                continue;
            }
            showWarningMessage(`${uri} failed to run.`);
        }
    } catch (error) {
        showWarningMessage(`An error occurred`);
    }
};