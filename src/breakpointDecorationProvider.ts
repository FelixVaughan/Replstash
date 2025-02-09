import * as vscode from 'vscode';
import ReplResultsPool from './replResultsPool';

export default class BreakpointDecorationProvider implements vscode.FileDecorationProvider {
    private static _instance: BreakpointDecorationProvider | null = null;
    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    private constructor() {}

    /**
     * Get the singleton instance of the BreakpointDecorationProvider.
     * @returns {BreakpointDecorationProvider} The singleton instance.
    */
    static get instance(): BreakpointDecorationProvider {
        if (!this._instance) {
            this._instance = new BreakpointDecorationProvider();
        }
        return this._instance;
    }

    /**
     * Provides a decoration for the given file URI.
     * @param {vscode.Uri} uri - The URI of the file to decorate.
     * @param {vscode.CancellationToken} token - A cancellation token.
     * @returns {vscode.ProviderResult<vscode.FileDecoration>} The file decoration.
     */
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
                color: new vscode.ThemeColor('charts.yellow'),
            };
        }
    
        return {
            tooltip: 'No errors detected',
            color: new vscode.ThemeColor('testing.iconPassed'),
        }
    }

    /**
     * Triggers an update for the given URI.
     * @param {vscode.Uri | vscode.Uri[]} uri - The URI to update.
     * @returns {void}
     */
    triggerUpdate(uri?: vscode.Uri | vscode.Uri[]) {
        console.log("Triggering update for URI:", uri);
        this._onDidChangeFileDecorations.fire(uri);
    }
}

