import * as vscode from 'vscode';

export const _debugger = vscode.debug;
export const window = vscode.window;
export interface Breakpoint {
    id: string;
    threadId: number;
    line: number;
    column: number;
    file: string;
    scripts: string[];
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