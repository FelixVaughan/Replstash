import * as vscode from 'vscode';
import { Breakpoint, Script, ReplEvaluationResult, isBreakpoint } from './utils';
import StorageManager from './storageManager';
import path from 'path';
export default class ReplResultsTreeProvider implements vscode.TreeDataProvider<Breakpoint | Script | ReplEvaluationResult> {
    private static _instance: ReplResultsTreeProvider | null = null; // Singleton instance
    private _onDidChangeTreeData = new vscode.EventEmitter<Breakpoint | Script | ReplEvaluationResult | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private storageManager: StorageManager;
    private isFlattened: boolean = false;

    /**
     * Private constructor to enforce singleton pattern.
     */
    private constructor() {
        this.storageManager = StorageManager.instance;
    }

    /**
     * Retrieves the singleton instance of the `ReplResultsTreeProvider`.
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
    }

    /**
     * Return a TreeItem for each element (Breakpoint, Script, or EvaluationResult).
     */
    getTreeItem(element: Breakpoint | Script | ReplEvaluationResult): vscode.TreeItem {
        const describe = (bp: Breakpoint): string => {
            const active: number = bp.scripts.filter(script => script.active).length;
            const form = active === 1 ? 'script' : 'scripts';
            return `${path.dirname(bp.file)}@Ln ${bp.line}, Col ${bp.column} - ${active} active ${form}`;
        }
        if (isBreakpoint(element)) {
            // Parent Breakpoint Item
            const bp = element as Breakpoint;
           
            const label = `${path.basename(bp.file)}`;
            const treeItem = new vscode.TreeItem(
                label, vscode.TreeItemCollapsibleState.Collapsed
            );
            treeItem.tooltip = `Breakpoint at ${bp.file}:${bp.line}`;
            treeItem.description = describe(bp);
            treeItem.iconPath = new vscode.ThemeIcon(
                'debug-breakpoint', 
                new vscode.ThemeColor(bp.active ? 'charts.green' : 'errorForeground')
            );
            return treeItem;
        } else if ('results' in element) {
            // Child Script Item
            const script = element as Script;
            const label = `${path.basename(script.uri)} {${script.results.length}}`;
            const treeItem = new vscode.TreeItem(
                label, vscode.TreeItemCollapsibleState.Collapsed
            );
            treeItem.tooltip = `${script.uri}`;
            treeItem.iconPath = new vscode.ThemeIcon('file-code');
            return treeItem;
        } else {
            // Leaf Repl Item
            const result = element as ReplEvaluationResult;
            const label = result.success ? 'Success' : 'Error';
            const treeItem = new vscode.TreeItem(
                label, vscode.TreeItemCollapsibleState.None);
            treeItem.description = result.stack || '';
            treeItem.tooltip = result.stack;
            treeItem.iconPath = new vscode.ThemeIcon(result.success ? 'check' : 'error');
            return treeItem;
        }
    }

    /**
     * Get children elements based on the hierarchical or flattened view.
     */
    getChildren(element?: Breakpoint | Script): Thenable<(Breakpoint | Script | ReplEvaluationResult)[]> {
        const breakpoints = this.storageManager.loadBreakpoints();

        if (!element) {
            return Promise.resolve(this.isFlattened
                ? breakpoints.flatMap(bp => bp.scripts.flatMap(script => script.results))
                : breakpoints
            );
        }

        if ('scripts' in element) {
            return Promise.resolve((element as Breakpoint).scripts);
        }

        if ('results' in element) {
            return Promise.resolve((element as Script).results);
        }

        return Promise.resolve([]);
    }


    /**
     * Create and register the Tree View for Evaluation Results.
     * @returns {vscode.TreeView<Breakpoint | Script | EvaluationResult>} The created Tree View.
     */
    public createTreeView(): vscode.TreeView<Breakpoint | Script | ReplEvaluationResult> {
        const treeView = vscode.window.createTreeView('replResultsView', {
            treeDataProvider: this,
            showCollapseAll: true,
        });
        return treeView;
    }
}
