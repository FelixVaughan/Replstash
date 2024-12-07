import * as vscode from 'vscode';
import { Breakpoint, ReplResult, Script } from './utils';
import ReplResultsPool from './replResultsPool';
import StorageManager from './storageManager';
import path from 'path';

export default class ReplResultsTreeProvider implements vscode.TreeDataProvider<Breakpoint | Script | ReplResult> {
    private static _instance: ReplResultsTreeProvider | null = null;
    private _onDidChangeTreeData = new vscode.EventEmitter<Breakpoint | Script | ReplResult | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private results: ReplResult[] = [];
    private isFlattened: boolean = false;

    private storageManager: StorageManager;

    /**
     * Private constructor to enforce singleton pattern.
     */
    private constructor() {
        this.storageManager = StorageManager.instance;

        // Listen to events from ReplResultsPool
        ReplResultsPool.instance.on('results', (results: ReplResult[]) => {
            this.results = results;
            this.refresh();
        });
    }

    /**
     * Get the singleton instance of the `ReplResultsTreeProvider`.
     * @returns {ReplResultsTreeProvider} The singleton instance.
     */
    static get instance(): ReplResultsTreeProvider {
        if (!this._instance) {
            this._instance = new ReplResultsTreeProvider();
        }
        return this._instance;
    }

    /**
     * Refresh the tree view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Toggle between hierarchical and flattened views.
     */
    toggleReplTreeViewMode = (): void => {
        this.isFlattened = !this.isFlattened;
        this.refresh();
    };

    /**
     * Return a TreeItem for each element (Breakpoint, Script, or ReplResult).
     */
    getTreeItem(element: Breakpoint | Script | ReplResult): vscode.TreeItem {
        if ('statusCode' in element) {
            // ReplResult Item
            const result = element as ReplResult;
            const label = result.success ? 'Success' : 'Error';
            const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
            treeItem.description = result.stack ? result.stack.split('\n')[0] : '';
            treeItem.tooltip = result.stack;
            treeItem.iconPath = new vscode.ThemeIcon(result.success ? 'check' : 'error');
            return treeItem;
        } else if ('bId' in element) {
            // Script Item
            const script = element as Script;
            const label = `${path.basename(script.uri)}`;
            const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
            treeItem.tooltip = script.uri;
            treeItem.iconPath = new vscode.ThemeIcon('file-code');
            return treeItem;
        } else {
            // Breakpoint Item
            const bp = element as Breakpoint;
            const label = `${path.basename(bp.file)} @Ln ${bp.line}, Col ${bp.column}`;
            const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
            treeItem.tooltip = `Breakpoint at ${bp.file}:${bp.line}`;
            treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint', new vscode.ThemeColor('charts.green'));
            return treeItem;
        }
    }

    /**
     * Get children elements based on the hierarchical or flattened view.
     */
    async getChildren(element?: Breakpoint | Script): Promise<(Breakpoint | Script | ReplResult)[]> {
        const breakpoints = this.storageManager.loadBreakpoints();

        if (!element) {
            // Root-level elements: breakpoints
            return breakpoints.filter(bp => 
                //@ts-ignore
                bp.scripts.some(script => 
                    this.results.some(result => result.bId === bp.id)
                )
            );
        }

        if ('scripts' in element) {
            // Breakpoint children: scripts with results
            return (element as Breakpoint).scripts.filter(script =>
                this.results.some(result => result.bId === (element as Breakpoint).id && result.script === script.uri)
            );
        }

        if ('bId' in element) {
            // Script children: results
            const script = element as Script;
            return this.results.filter(result => result.bId === script.bId && result.script === script.uri);
        }

        return [];
    }

    /**
     * Create and register the Tree View for Evaluation Results.
     * @returns {vscode.TreeView<Breakpoint | Script | ReplResult>} The created Tree View.
     */
    public createTreeView(): vscode.TreeView<Breakpoint | Script | ReplResult> {
        const treeView = vscode.window.createTreeView('replResultsView', {
            treeDataProvider: this,
            showCollapseAll: true,
        });
        return treeView;
    }
}
