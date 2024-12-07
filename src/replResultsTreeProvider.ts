import * as vscode from 'vscode';
import { Breakpoint, ReplResult } from './utils';
import ReplResultsPool from './replResultsPool';
import path from 'path';

export default class ReplResultsTreeProvider implements vscode.TreeDataProvider<Breakpoint | ReplResult> {
    private static _instance: ReplResultsTreeProvider | null = null;
    private _onDidChangeTreeData = new vscode.EventEmitter<Breakpoint | ReplResult | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private results: ReplResult[] = [];
    private isFlattened: boolean = false;

    /**
     * Private constructor to enforce singleton pattern.
     */
    private constructor() {
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
     * Return a TreeItem for each element (Breakpoint or ReplResult).
     */
    getTreeItem(element: Breakpoint | ReplResult): vscode.TreeItem {
        if ('statusCode' in element) {
            // ReplResult Item
            const result = element as ReplResult;
            const label = result.success ? 'Success' : 'Error';
            const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
            treeItem.description = result.stack ? result.stack.split('\n')[0] : '';
            treeItem.tooltip = result.stack;
            treeItem.iconPath = new vscode.ThemeIcon(result.success ? 'check' : 'error');
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
    getChildren(element?: Breakpoint): Thenable<(Breakpoint | ReplResult)[]> {
        if (!element) {
            // Return root level elements
            return Promise.resolve(this.results.length > 0 ? this.results : []);
        }

        // No hierarchical structure for ReplResults, just return an empty array
        return Promise.resolve([]);
    }

    /**
     * Create and register the Tree View for Evaluation Results.
     * @returns {vscode.TreeView<Breakpoint | ReplResult>} The created Tree View.
     */
    public createTreeView(): vscode.TreeView<Breakpoint | ReplResult> {
        const treeView = vscode.window.createTreeView('replResultsView', {
            treeDataProvider: this,
            showCollapseAll: true,
        });
        return treeView;
    }
}
