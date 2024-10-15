import * as vscode from 'vscode';
import path from 'path';
import { Breakpoint, Script, window } from './utils';
import StorageManager from './storageManager';

export default class BreakpointsTreeProvider implements vscode.TreeDataProvider<Breakpoint | Script> {

    private _onDidChangeTreeData: vscode.EventEmitter<Breakpoint | Script | undefined> = new vscode.EventEmitter<Breakpoint | Script | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Breakpoint | Script | undefined> = this._onDidChangeTreeData.event;

    constructor(
        private storageManager: StorageManager,  // StorageManager for data
    ) {}

    // Refresh the TreeView
    refresh = (): void => {
        this._onDidChangeTreeData.fire(undefined);
    }

    // Retrieve the item for the TreeView (either Breakpoint or Script)
    getTreeItem = (element: Breakpoint | Script): vscode.TreeItem => {
        const isBreakpoint: boolean = Object.hasOwn(element, 'scripts');
        const treeItem: vscode.TreeItem = new vscode.TreeItem(
            'uri' in element ? element.uri : element.file
        );

        treeItem.checkboxState = element.active 
            ? vscode.TreeItemCheckboxState.Checked 
            : vscode.TreeItemCheckboxState.Unchecked;


        if (isBreakpoint) {
            element = element as Breakpoint;
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            treeItem.contextValue = 'breakpoint';
            treeItem.label = `[${element.file}]\t(${element.scripts.length})`;
            treeItem.tooltip = element.id;
            treeItem.description = `${element.line}:${element.column}`;
        }else {
            element = element as Script
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue = 'script';
            treeItem.label = `<${path.basename(element.uri)}>`;
        }

        return treeItem;
    }
    

    // Retrieve children for the Breakpoint (the scripts), or return the top-level breakpoints
    getChildren = (element?: Breakpoint): Thenable<Breakpoint[] | Script[]> => {
        if (!element) {
            return Promise.resolve(this.storageManager.loadBreakpoints());  // Load breakpoints from StorageManager
        }
        return Promise.resolve(element.scripts);  // Return scripts for a given breakpoint
    }

    // Get the parent element of the given script (to support nested hierarchy)
    getParent = (element: Script): Breakpoint | null => {
        const breakpoints : Breakpoint[] = this.storageManager.loadBreakpoints();
        return breakpoints.find(breakpoint => breakpoint.scripts.includes(element)) || null;
    }

    setElementActivation = (element: Breakpoint | Script, status?: boolean): void => {
        // Compute the status value: use provided status or toggle current state
        const statusValue: boolean = status !== undefined ? status : !element.active;
    
        if (Object.hasOwn(element, 'scripts')) {
            // Element is a Breakpoint
            const breakpoint = element as Breakpoint;
            this.storageManager.changeBreakpointActivation(breakpoint, statusValue);
        } else {
            // Element is a Script
            const script = element as Script;
            const parentBreakpoint = this.getParent(script);
            if (parentBreakpoint) {
                this.storageManager.changeScriptActivation(parentBreakpoint, script, statusValue);
            }
        }
    
        // Refresh the tree view to reflect changes
        this.refresh();
    }

    createTreeView = (): vscode.TreeView<Breakpoint | Script> => {
        const treeView = window.createTreeView('breakpointsView', {
            treeDataProvider: this,
            manageCheckboxStateManually: true,
        });

        treeView.onDidChangeCheckboxState((event: vscode.TreeCheckboxChangeEvent<Script | Breakpoint>) => {
            event.items.forEach(([elem, checked]: [Script | Breakpoint, number]) => { //vscode.TreeItemCheckboxState
                const isChecked: boolean = checked === vscode.TreeItemCheckboxState.Checked;
                this.setElementActivation(elem, isChecked);
            });
        });

        return treeView;
    }
}
