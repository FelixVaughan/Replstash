import * as vscode from 'vscode';
import { Breakpoint, describe, ReplResult, Script, commands, isReplResult, showWarningMessage } from './utils';
import ReplResultsPool from './replResultsPool';
import StorageManager from './storageManager';
import path from 'path';

export default class ReplResultsTreeProvider implements vscode.TreeDataProvider<Breakpoint | Script | ReplResult> {

    /**
     * Singleton instance of the `ReplResultsTreeProvider`.
     */
    private static _instance: ReplResultsTreeProvider | null = null;

    /**
     * Event emitter to signal changes in the TreeView data.
     * Used to refresh the TreeView when data changes.
     */
    private _onDidChangeTreeData = new vscode.EventEmitter<Breakpoint | Script | ReplResult | undefined>();

    /**
     * Event to signal changes in the TreeView data.
     * Used to refresh the TreeView when data changes.
     */
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /**
     * The TreeView instance to display the ReplResults.
     */
    private treeView: vscode.TreeView<Breakpoint | Script | ReplResult> | undefined;

    /**
     * The list of ReplResults to display in the TreeView.
     */
    private results: ReplResult[] = [];

    /**
     * Flag to toggle between hierarchical and flattened views.
     */
    private isFlattened: boolean = false;

    /**
     * The StorageManager instance to manage breakpoints and scripts.
     */
    private storageManager: StorageManager;

    /**
     * Map to store collapsible states of tree items.
     */
    private collapsibleStates: Map<string, vscode.TreeItemCollapsibleState> = new Map();

    /**
     * Private constructor to enforce singleton pattern.
     */
    private constructor() {
        this.storageManager = StorageManager.instance;

        // Listen to events from ReplResultsPool
        ReplResultsPool.instance.on('results', (results: ReplResult[]) => {
            this.results = results;
            if (this.treeView){
                this.treeView.badge = {
                    value: this.results.length,
                    tooltip: `Results Available`, // Tooltip text
                };
                this.collapsibleStates.clear();
            }
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
     * Set collapsible state for a given tree item.
     */
     private setCollapsibleState(
        element: Breakpoint | Script | ReplResult,
        state: vscode.TreeItemCollapsibleState
    ): void {
        const key = 'id' in element ? element.id : (element as Script).uri;
        this.collapsibleStates.set(key, state);
    }

    /**
     * Get the collapsible state for a given tree item.
     */
    private getCollapsibleState(element: Breakpoint | Script | ReplResult): vscode.TreeItemCollapsibleState {
        const key = 'id' in element ? element.id : (element as Script).uri;
        return this.collapsibleStates.get(key) || vscode.TreeItemCollapsibleState.Collapsed;
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
        let treeItem: vscode.TreeItem;
        if (isReplResult(element)) {
            // ReplResult Item
            const result = element as ReplResult;
            const label = result.success ? 'Success' : 'Error';
            treeItem = new vscode.TreeItem(label);
            treeItem.contextValue = 'result';
            treeItem.description = result.stack ? result.stack.split('\n')[0] : 'No issues detected.';
            treeItem.tooltip = result.stack;
            treeItem.iconPath = new vscode.ThemeIcon(
                result.success ? 'pass' : 'error', new vscode.ThemeColor(
                    result.success ? 'charts.green' : 'charts.red'
                )
            );
        } else if ('bId' in element) {
            // Script Item
            const script = element as Script;
            const label = `${path.basename(script.uri)}`;
            const scriptHasError = this.results.some(result => 
                result.bId === script.bId && result.script === script.uri && !result.success
            );
            treeItem = new vscode.TreeItem(label);
            treeItem.contextValue = 'script';
            treeItem.tooltip = script.uri;
            treeItem.iconPath = new vscode.ThemeIcon(
                scriptHasError ? 'error' : 'pass', new vscode.ThemeColor(
                    scriptHasError ? 'charts.red' : 'charts.green'
                )
            );
            treeItem.resourceUri = vscode.Uri.file(script.uri);
            treeItem.label = label;
        } else {
            // Breakpoint Item
            const bp = element as Breakpoint;
            const label = `${path.basename(bp.file)}`;
            const breakpointHasError = bp.scripts.some(script =>
                this.results.some(result => result.bId === bp.id && result.script === script.uri && !result.success)
            );
            treeItem = new vscode.TreeItem(label);
            treeItem.contextValue = 'breakpoint';
            treeItem.tooltip = `Breakpoint at ${bp.file}:${bp.line}`;
            treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint', new vscode.ThemeColor(breakpointHasError ? 'charts.red' : 'charts.green'));
            treeItem.description = describe(bp);
        }

        treeItem.collapsibleState = this.getCollapsibleState(element);
        return treeItem;
    }
    

    /**
     * Get children elements based on the hierarchical or flattened view.
     */
    async getChildren(element?: Breakpoint | Script): Promise<(Breakpoint | Script | ReplResult)[]> {
        const breakpoints = this.storageManager.loadBreakpoints();

        if (!element) {
            // Root-level elements: breakpoints
            if (this.isFlattened) {
                // If flattened, return all ReplResults directly
                return Promise.resolve(this.results);
            }
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
                this.results.some(result => 
                    result.bId === (element as Breakpoint).id && result.script === script.uri
                )
            );
        }

        if ('bId' in element) {
            // Script children: results
            const script = element as Script;
            return this.results.filter(
                result => result.bId === script.bId && result.script === script.uri
            );
        }

        return [];
    }

    /**
     * Copy the error stack to the clipboard.
     * @param element The ReplResult to copy the error stack from.
     */
    copyStackTrace = async (element: ReplResult): Promise<void> => {
        if (!element.stack) {
            showWarningMessage('No stack info to copy.');
            return;
        }
        await vscode.env.clipboard.writeText(`\'${element.stack}\'`);
    }


    /**
     * Create and register the Tree View for Evaluation Results.
     * @returns {vscode.TreeView<Breakpoint | Script | ReplResult>} The created Tree View.
     */
    public createTreeView(): vscode.TreeView<Breakpoint | Script | ReplResult> {
        this.treeView = vscode.window.createTreeView('replResultsView', {
            treeDataProvider: this,
            showCollapseAll: false,
        });

        this.treeView.onDidCollapseElement((event: vscode.TreeViewExpansionEvent<any>) => {
            this.setCollapsibleState(event.element, vscode.TreeItemCollapsibleState.Collapsed);
        });

        this.treeView.onDidExpandElement((event: vscode.TreeViewExpansionEvent<any>) => {
            this.setCollapsibleState(event.element, vscode.TreeItemCollapsibleState.Expanded);
        });

        this.treeView.onDidChangeSelection((event: vscode.TreeViewSelectionChangeEvent<any>) => {
            const [selected] = event.selection;
            if (isReplResult(selected)) {
                commands.executeCommand(
                    'setContext',
                    'replStash.stackAvailable',
                    Boolean(selected.stack)
                );
            }
        });

        return this.treeView;
    }
}
