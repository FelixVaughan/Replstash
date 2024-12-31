import * as vscode from 'vscode';
import ReplResultsPool from './replResultsPool';

export default class BreakpointDecorationProvider implements vscode.FileDecorationProvider {
    private static _instance: BreakpointDecorationProvider | null = null;
    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    private constructor() {}

    static get instance(): BreakpointDecorationProvider {
        if (!this._instance) {
            this._instance = new BreakpointDecorationProvider();
        }
        return this._instance;
    }

    //@ts-ignore
    provideFileDecoration = (uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> => {
        const queryParams = new URLSearchParams(uri.query);
        const bId = queryParams.get('bId'); // Retrieve the bId from the query
        if (!bId) return undefined;
    
        const results = ReplResultsPool.instance.results || [];
        const errCount = results.filter(result => result.bId === bId && !result.success).length;
    
        if (errCount) {
            return {
                badge: `${errCount}`,
                tooltip: 'Error detected',
                color: new vscode.ThemeColor('charts.red'),
            };
        }
    
        return {
            tooltip: 'No errors detected',
            color: new vscode.ThemeColor('charts.green'),
        }
    }
    triggerUpdate(uri?: vscode.Uri | vscode.Uri[]) {
        console.log("Triggering update for URI:", uri);
        this._onDidChangeFileDecorations.fire(uri);
    }
}

