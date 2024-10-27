import * as vscode from 'vscode';
import path from 'path';
import { 
    Breakpoint, 
    Script, 
    window, 
    commands, 
    showWarningMessage
} from './utils';
import StorageManager from './storageManager';

export default class BreakpointsTreeProvider implements vscode.TreeDataProvider<Breakpoint | Script> {

    private _onDidChangeTreeData: vscode.EventEmitter<Breakpoint | Script | undefined> = new vscode.EventEmitter<Breakpoint | Script | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Breakpoint | Script | undefined> = this._onDidChangeTreeData.event;
    private selectedItems: Set<Breakpoint | Script> = new Set();
    // @ts-ignore
    private copiedScripts: Script[] = [];
    readonly mimeType = "application/vnd.code.tree.breakpointsView";
    readonly dragMimeTypes = [this.mimeType]; // Custom mime type
    readonly dropMimeTypes = [this.mimeType]; 

    constructor(private storageManager: StorageManager) {}

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
            treeItem.label = `[${element.file}] (${element.scripts.length})`;
            treeItem.tooltip = element.id;
            treeItem.description = `Ln ${element.line}, Col ${element.column}`;
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
        return breakpoints.find(bp => bp.scripts.includes(element)) || null;
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

    handleDrag = (source: readonly (Breakpoint | Script)[], dataTransfer: vscode.DataTransfer): void => {
        const scriptsToDrag: Script[] = source.filter((e): e is Script => 'uri' in e);
        if (scriptsToDrag.length !== source.length) {
            showWarningMessage('Only scripts can be dragged.');
            return;
        }
        if (scriptsToDrag.length) {
            dataTransfer.set(
                this.mimeType, 
                new vscode.DataTransferItem(
                    JSON.stringify(scriptsToDrag.map(script => script.uri))
                )
            );
        }
        console.log(dataTransfer)
    };

    handleDrop = async (target: Breakpoint | Script | undefined, dataTransfer: vscode.DataTransfer): Promise<void> => {
        if (target?.hasOwnProperty('scripts')) {
            const droppedData: vscode.DataTransferItem | undefined = dataTransfer.get(this.mimeType);
            if (droppedData) {
                const droppedUris: string = await droppedData.asString(); // Await the data as a string
                const scriptsToCopy: string[] = JSON.parse(droppedUris) as string[];
                this.storageManager.assignScriptsToBreakpoint(target as Breakpoint, scriptsToCopy);
                this.refresh();
            }
        } else {
            showWarningMessage("Scripts can only be dropped onto breakpoints.");
        }
    };
    

    getSelectedItems(): (Breakpoint | Script)[] {
        return Array.from(this.selectedItems);
    }
    
    deactivateSelectedItems = (): void => {
        this.getSelectedItems().forEach((item: Breakpoint | Script) => {
            this.setElementActivation(item, false);
        });
    }

    activateSelectedItems = (): void => {
        this.getSelectedItems().forEach((item: Breakpoint | Script) => {
            this.setElementActivation(item, true);
        });
    }

    copyScripts = (): void => {
        const selectedScripts: Script[] = this.getSelectedItems() as Script[];
        if (selectedScripts.length) {
            this.copiedScripts = selectedScripts;
            const nonEmpty: boolean = selectedScripts.length > 0;
            commands.executeCommand('setContext', 'slugger.hasCopiedScripts', nonEmpty);
        }
    }

    pasteScripts = (breakpoint: Breakpoint): void => {
        this.storageManager.assignScriptsToBreakpoint(
            breakpoint, 
            this.copiedScripts.map(script => script.uri)
        );
        this.refresh();
    }

    createTreeView = (): vscode.TreeView<Breakpoint | Script> => {
        const treeView = window.createTreeView('breakpointsView', {
            treeDataProvider: this,
            manageCheckboxStateManually: true,
            dragAndDropController: this,
            canSelectMany: true
        });

        treeView.onDidChangeSelection(event => {
            const selection: readonly (Breakpoint | Script)[] = event.selection;
            const isMultipleSelect: boolean = selection.length > 0;
            const breakpointSelected: boolean = selection.some((elem: Breakpoint | Script) => Object.hasOwn(elem, 'scripts'));
            this.selectedItems = new Set(selection);
            commands.executeCommand('setContext', 'slugger.hasSelectedItems', isMultipleSelect);
            commands.executeCommand('setContext', 'slugger.hasBreakpointSelected', breakpointSelected);
        });

        treeView.onDidChangeCheckboxState((event: vscode.TreeCheckboxChangeEvent<Script | Breakpoint>) => {
            event.items.forEach(([elem, checked]: [Script | Breakpoint, number]) => {
                const isChecked: boolean = checked === vscode.TreeItemCheckboxState.Checked;
                this.setElementActivation(elem, isChecked);
            });
        });

        return treeView;
    }
}
