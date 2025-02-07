import * as vscode from 'vscode';
import { Breakpoint, describe, ReplResult, Script, commands, isReplResult, showWarningMessage, isBreakpoint } from './utils';
import ReplResultsPool from './replResultsPool';
import StorageManager from './storageManager';
import BreakpointDecorationProvider from './breakpointDecorationProvider';
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
     * @returns {ReplResultsTreeProvider} The singleton instance.'
     */
    static get instance(): ReplResultsTreeProvider {
        if (!this._instance) {
            this._instance = new ReplResultsTreeProvider();
        }
        return this._instance;
    }

    /**
     * Refresh the tree view.
     * @returns {void}
     */
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

     /**
     * Set collapsible state for a given tree item.
     * @param element - The tree item to set the collapsible state for.
     * @param state - The collapsible state to set.
     * @returns {void}
     */
     private setCollapsibleState(
        element: Breakpoint | Script | ReplResult,
        state: vscode.TreeItemCollapsibleState
    ): void {
        if (isReplResult(element)) return; 
        const key = 'id' in element ? element.id : (element as Script).uri;
        this.collapsibleStates.set(key, state);
    }

    /**
     * Get the collapsible state for a given tree item.
     * @param element - The tree item to get the collapsible state for.
     * @returns {vscode.TreeItemCollapsibleState} The collapsible state.
     */
    private getCollapsibleState(element: Breakpoint | Script | ReplResult): vscode.TreeItemCollapsibleState {
        if (isReplResult(element)) return vscode.TreeItemCollapsibleState.None;
        const key = 'id' in element ? element.id : (element as Script).uri;
        return this.collapsibleStates.get(key) || vscode.TreeItemCollapsibleState.Collapsed;
    }



    /**
     * Toggle between hierarchical and flattened views.
     * @returns {void}
     */
    toggleReplTreeViewMode = (): void => {
        this.isFlattened = !this.isFlattened;
        this.refresh();
    };

    /**
     * Return a TreeItem for each element (Breakpoint, Script, or ReplResult).
     * @param element - The element to get a TreeItem for.
     * @returns {vscode.TreeItem} The TreeItem for the element.
     * @override
     */
    getTreeItem(element: Breakpoint | Script | ReplResult): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(''); // Placeholder for initialization
    
        if (isReplResult(element)) {
            this.configureReplResultItem(treeItem, element as ReplResult);
        } else if ('bId' in element) {
            this.configureScriptItem(treeItem, element as Script);
        } else {
            this.configureBreakpointItem(treeItem, element as Breakpoint);
        }
    
        treeItem.collapsibleState = this.getCollapsibleState(element);
        return treeItem;
    }
    
    /**
     * Configure the TreeItem for a ReplResult.
     * @param treeItem - The TreeItem to configure.
     * @param result - The ReplResult to configure the TreeItem for.
     * @returns {void}
     */
    private configureReplResultItem(treeItem: vscode.TreeItem, result: ReplResult): void {
        treeItem.label = result.success ? 'Success' : 'Failure';
        treeItem.contextValue = 'result';
        treeItem.description = this.isFlattened
            ? this.getAssociatedBreakpointDescription(result)
            : result.stack.substring(0, 100) || 'No issues detected.';
        treeItem.description += ` -- ${new Date().toLocaleTimeString()}`; 
        treeItem.tooltip = result.stack || 'No issues detected.';
        treeItem.iconPath = new vscode.ThemeIcon(
            result.success ? 'pass' : 'error',
            new vscode.ThemeColor(result.success ? 'charts.green' : 'charts.red')
        );
    }


    /**
     * Configure the TreeItem for a Script.
     * @param treeItem - The TreeItem to configure.
     * @param script - The Script to configure the TreeItem for.
     * @returns {void}
     */
    private configureScriptItem(treeItem: vscode.TreeItem, script: Script): void {
        const label = path.basename(script.uri);
        const scriptHasError = this.results.some(result =>
            result.bId === script.bId && result.script === script.uri && !result.success
        );
    
        treeItem.label = label;
        treeItem.contextValue = 'script';
        treeItem.tooltip = script.uri;
        treeItem.iconPath = new vscode.ThemeIcon(
            scriptHasError ? 'error' : 'pass',
            new vscode.ThemeColor(scriptHasError ? 'charts.red' : 'charts.green')
        );
        // treeItem.resourceUri = vscode.Uri.file(script.uri);
    }

    /**
     * Configure the TreeItem for a Breakpoint.
     * @param treeItem 
     * @param bp 
     * @returns {void}
     */
    private configureBreakpointItem(treeItem: vscode.TreeItem, bp: Breakpoint): void {
        const label = path.basename(bp.file);
        
        //@ts-ignore
        const breakpointHasError = bp.scripts.some(script =>
            this.results.some(result => result.bId === bp.id && result.script === script.uri && !result.success)
        );
    
        treeItem.label = label;
        treeItem.contextValue = 'breakpoint';
        treeItem.tooltip = `Breakpoint at ${bp.file}:${bp.line}`;
        const resourceUri: vscode.Uri = vscode.Uri.file(
            bp.file).with({query: `bId=${bp.id}`});
        treeItem.resourceUri = resourceUri;
        treeItem.iconPath = new vscode.ThemeIcon('file');
        treeItem.description = describe(bp);

        // Notify the decoration provider
        const decorationProvider = BreakpointDecorationProvider.instance;
        decorationProvider.triggerUpdate(resourceUri);

    }

    /**
     * 
     * @param {ReplResult} result - The ReplResult to get the associated breakpoint for.
     * @returns {string} The description of the associated breakpoint.
     */
    private getAssociatedBreakpointDescription(result: ReplResult): string {
        const assocBreakpoint = this.storageManager.loadBreakpoints().find(
            bp => bp.id === result.bId
        );
        return assocBreakpoint ? describe(assocBreakpoint) : 'No breakpoint info.';
    }
    

    /**
     * Get children elements based on the hierarchical or flattened view.
     * @param {Breakpoint | Script} element - The parent element to get children for.
     * @returns {Promise<(Breakpoint | Script | ReplResult)[]>} The children elements.
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
     * @param {ReplResult} element - The ReplResult to copy the stack for.
     * @returns {Promise<void>} A Promise that resolves when the stack is copied.
     */
    copyStackTrace = async (element: ReplResult): Promise<void> => {
        if (!element.stack) {
            showWarningMessage('No stack info to copy.');
            return;
        }
        await vscode.env.clipboard.writeText(`\'${element.stack}\'`);
    }

    /**
     * Open the script file associated with the ReplResult.
     * @param {ReplResult | Script} element - The ReplResult to open the script for.
     * @returns {Promise<void>} A Promise that resolves when the script is opened.
     */
    openScripts = async (element: ReplResult | Script): Promise<void> => {
        const uri = isReplResult(element) ? (element as ReplResult).script : (element as Script).uri;
        if (!uri) return
        const document = await vscode.workspace.openTextDocument(uri);
        vscode.window.showTextDocument(document, { preview: false });
    }

    /**
     * get the breakpoint id of the element
     * @param {ReplResult | Script | Breakpoint} element - The element to get the breakpoint id for.
     * @returns {string | undefined} The breakpoint id.
     */
    getBid = (element: ReplResult | Script | Breakpoint): string | undefined => {
        if (isReplResult(element)) {
            return (element as ReplResult).bId;
        }
        if (isBreakpoint(element)) {
            return (element as Breakpoint).id;
        }
        return (element as Script).bId;
    };
    

    /**
     * Jump to the breakpoint associated with the ReplResult.
     * @param {ReplResult | Script | Breakpoint} element - The element to jump to the breakpoint for.
     * @returns {Promise<void>} A Promise that resolves when the breakpoint is jumped to.
     */
    jumpToBreakpoint = async (element: ReplResult | Script | Breakpoint): Promise<void> => {
        const bid = this.getBid(element);
        if (!bid) return;
        const breakpoint = this.storageManager.loadBreakpoints().find(bp => bp.id === bid);
        if (!breakpoint) return;
        //run command to jump to breakpoint
        const document = await vscode.workspace.openTextDocument(breakpoint.file);
        const position = new vscode.Position(Math.max(breakpoint.line - 1, 0), 0)
        await vscode.window.showTextDocument(document, {
            selection: new vscode.Range(position, position),
        });
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
                    'replstash.stackAvailable',
                    Boolean(selected.stack)
                );
            }
        });

        return this.treeView;
    }
}
