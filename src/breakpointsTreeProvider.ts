import * as vscode from 'vscode';
import { Breakpoint, Script } from './utils';
import StorageManager from './storageManager';
import CommandHandler from './commandHandler';  // Import CommandHandler

export default class BreakpointsTreeProvider implements vscode.TreeDataProvider<Breakpoint | Script> {

    private _onDidChangeTreeData: vscode.EventEmitter<Breakpoint | Script | undefined> = new vscode.EventEmitter<Breakpoint | Script | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Breakpoint | Script | undefined> = this._onDidChangeTreeData.event;

    constructor(
        private storageManager: StorageManager,  // StorageManager for data
        private commandHandler: CommandHandler   // CommandHandler for operations
    ) {
    }

    // Refresh the TreeView
    refresh = (): void => {
        this._onDidChangeTreeData.fire(undefined);
    }

    // Retrieve the item for the TreeView (either Breakpoint or Script)
    getTreeItem = (element: Breakpoint | Script): vscode.TreeItem => {
        const treeItem: vscode.TreeItem = new vscode.TreeItem('uri' in element ? element.uri : element.file);
    
        // Add collapsible state based on whether it's a Breakpoint or a Script
        treeItem.collapsibleState = 'scripts' in element 
            ? vscode.TreeItemCollapsibleState.Collapsed 
            : vscode.TreeItemCollapsibleState.None;
    
        // Add contextValue for context menu
        treeItem.contextValue = 'scripts' in element ? 'breakpoint' : 'script';
        
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

    // Method to deactivate a breakpoint
    deactivateBreakpoint = (breakpoint: Breakpoint): void => {
        this.commandHandler.deactivateBreakpoint(breakpoint);  // Use commandHandler's deactivate logic
        this.refresh();
    }

    // Method to activate or deactivate a script
    activateDeactivateScript = (script: Script): void => {
        script.active = !script.active;  // Toggle active state
        const parentBreakpoint: Breakpoint | null = this.getParent(script);
        if (parentBreakpoint) {
            this.commandHandler.toggleScriptActivation(parentBreakpoint, script, script.active);  // Call commandHandler for state change
        }
        this.refresh();
    }
}
