import * as vscode from 'vscode';
import BreakpointsTreeProvider from './breakpointsTreeProvider';

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