import * as vscode from 'vscode';
import path from 'path';
import {
    Breakpoint,
    Script,
    window,
    commands,
    showWarningMessage,
    evaluateScripts,
    _debugger,
    isBreakpoint,
} from './utils';
import StorageManager from './storageManager';
import CommandHandler from './commandHandler';

/**
 * Provides a Tree View for managing breakpoints and their associated scripts in the extension.
 * Supports actions like activation, drag-and-drop, and selection of breakpoints and scripts.
 * @class
 */
export default class BreakpointsTreeProvider implements vscode.TreeDataProvider<Breakpoint | Script> {

    /**
     * Singleton instance of BreakpointsTreeProvider.
     * Ensures only one instance is created and reused.
     */
    private static _instance: BreakpointsTreeProvider | null = null;

    /**
     * Event emitter to signal changes in the TreeView data.
     * Used to refresh the UI when breakpoints or scripts are updated.
     */
    private _onDidChangeTreeData = new vscode.EventEmitter<Breakpoint | Script | undefined>();

    /**
     * Event that clients can subscribe to for changes in TreeView data.
     */
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /**
     * Maps breakpoint IDs to their collapsible state in the TreeView.
     * Tracks expanded or collapsed states for breakpoints.
     * Used to maintain the state of the TreeView when refreshing.
     */
    private collapsibleStates: Map<string, vscode.TreeItemCollapsibleState> = new Map();

    /**
     * Set of currently selected items in the TreeView.
     * Used for multi-selection operations.
     */
    private selectedItems: Set<Breakpoint | Script> = new Set();

    /**
     * Instance of the StorageManager for managing breakpoint and script data.
     * Provides methods for persisting and retrieving data.
     */
    private storageManager: StorageManager;

    /**
     * List of copied scripts for drag-and-drop or clipboard operations.
     * Used for assigning or duplicating scripts.
     */
    private copiedScripts: Script[] = [];


    /**
     * Boolean to indicate whether the TreeView is flattened or hierarchical.
     */
    private isFlattened: boolean = false

    /**
     * MIME type for TreeView drag-and-drop operations.
     * Specifies the type of data that can be dragged or dropped within the TreeView.
     */
    readonly mimeType = 'application/vnd.code.tree.breakpointsView';

    /**
     * MIME types supported for dragging items from the TreeView.
     * Limits drag-and-drop operations to the specified MIME type.
     */
    readonly dragMimeTypes = [this.mimeType];

    /**
     * MIME types supported for dropping items into the TreeView.
     * Ensures dropped data matches the expected format.
     */
    readonly dropMimeTypes = [this.mimeType];

    /**
     * Private constructor to enforce the singleton pattern.
     */
    private constructor() {
        this.storageManager = StorageManager.instance;
    }

    /**
     * Retrieves the singleton instance of the `BreakpointsTreeProvider`.
     * @returns {BreakpointsTreeProvider} The singleton instance.
     */
    static get instance(): BreakpointsTreeProvider {
        if (!this._instance) {
            this._instance = new BreakpointsTreeProvider();
        }
        return this._instance;
    }

    /**
     * Refreshes the Tree View by triggering the `onDidChangeTreeData` event.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }


    /**
     * Toggles the Tree View between hierarchical and flattened modes.
     */
    toggleFlattenedView = (): void => {
        this.isFlattened = !this.isFlattened;
        this.refresh();
    };

    /**
     * @inheritdoc
     * 
     * Retrieves a Tree Item representation of the given element (Breakpoint or Script).
     * @param {Breakpoint | Script} element - The element to create the Tree Item for.
     * @returns {vscode.TreeItem} A VS Code Tree Item with properties such as label, icon, and command.
     */
    getTreeItem(element: Breakpoint | Script): vscode.TreeItem {
        const treeItem: vscode.TreeItem = new vscode.TreeItem(
            'uri' in element ? element.uri : element.file
        );

        const describe = (bp: Breakpoint) => 
            `${path.dirname(bp.file)}@Ln ${bp.line}, Col ${bp.column} - (${bp.scripts.length})`;
    
        treeItem.checkboxState = element.active
            ? vscode.TreeItemCheckboxState.Checked
            : vscode.TreeItemCheckboxState.Unchecked;
    
        if (isBreakpoint(element)) {
            const breakpoint = element as Breakpoint;
            const iconColor = !breakpoint.linked
                ? 'charts.yellow' : breakpoint.active
                ? 'charts.green' : 'errorForeground';
            treeItem.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor(iconColor));
            const collState = this.collapsibleStates.get(breakpoint.id) || vscode.TreeItemCollapsibleState.Collapsed;
            treeItem.collapsibleState = collState;
            treeItem.contextValue = 'breakpoint';
            treeItem.label = path.basename(breakpoint.file);
            treeItem.tooltip = !breakpoint.linked ? 'Unlinked' : breakpoint.active ? 'Active' : 'Inactive';
            treeItem.description = describe(breakpoint);
            const position = new vscode.Position(Math.max(breakpoint.line - 1, 0), 0);
            treeItem.command = {
                command: 'vscode.open',
                title: 'Open Breakpoint Location',
                arguments: [
                    vscode.Uri.file(breakpoint.file),
                    {
                        viewColumn: vscode.ViewColumn.One,
                        selection: new vscode.Range(position, position)
                    }
                ]
            };
        } else {
            const script = element as Script;
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue = 'script';
            treeItem.label = path.basename(script.uri);

            if (this.isFlattened) {
                const parentBreakpoint: Breakpoint | null = this._getParent(script);
                treeItem.description = parentBreakpoint ? describe(parentBreakpoint) : '';
            }

            const iconColor = script.active ? 'charts.green' : 'errorForeground';
            treeItem.iconPath = new vscode.ThemeIcon('file-code', new vscode.ThemeColor(iconColor));
        }
    
        return treeItem;
    }
    

    /**
     * @inheritdoc
     * 
     * If hierarchical, returns the children of the given Breakpoint element.
     * If flattened, returns all scripts from all Breakpoints.
     * @param {Breakpoint} [element] - The parent Breakpoint to fetch children for.
     * @returns {Thenable<Breakpoint[] | Script[]>} A promise resolving to the list of children.
     */
    getChildren(element?: Breakpoint): Thenable<Breakpoint[] | Script[]> {

        if(this.isFlattened){
            // Return all scripts if the flattened view is enabled
            const breakpoints: Breakpoint[] = this.storageManager.loadBreakpoints();
            const allScripts: Script[] = breakpoints.flatMap(bp => bp.scripts);
            return Promise.resolve(allScripts);
        }

        if (!element) {
            // Return top-level breakpoints in the hierarchical view
            return Promise.resolve(this.storageManager.loadBreakpoints());
        }

        // Return top-level breakpoints in the hierarchical view
        return Promise.resolve(element.scripts);
    }

    /**
     * Retrieves the parent Breakpoint for the given Script.
     * @param {Script} script - The Script for which to find the parent Breakpoint.
     * @returns {Breakpoint | null} The parent Breakpoint or `null` if not found.
     */
    private _getParent(script: Script): Breakpoint | null {
        const breakpoints: Breakpoint[] = this.storageManager.loadBreakpoints();
        return breakpoints.find(bp => bp.scripts.some(s => s.uri === script.uri)) || null;
    }

    /**
     * @inheritdoc
     * 
     * Retrieves the parent Breakpoint for the given Script if not flattened.
     * @param {Script} script - The Script for which to find the parent Breakpoint.
     * @returns {Breakpoint | null} The parent Breakpoint or `null` if not found.
     */
    getParent(script: Script): Breakpoint | null {
        
        if (this.isFlattened) {
            return null;
        }

        return this._getParent(script);
    }

    /**
     * Activates or deactivates the given Breakpoint or Script.
     * @param {Breakpoint | Script} element - The element to activate or deactivate.
     * @param {boolean} [status] - The desired activation status. If not provided, toggles the current state.
     */
    setElementActivation = (element: Breakpoint | Script, status?: boolean): void => {
        const statusValue: boolean = status !== undefined ? status : !element.active;

        if (isBreakpoint(element)) {
            const breakpoint = element as Breakpoint;
            this.storageManager.changeBreakpointActivation(breakpoint, statusValue);
        } else {
            const script = element as Script;
            const parentBreakpoint = this._getParent(script);
            if (parentBreakpoint) {
                this.storageManager.changeScriptActivation(parentBreakpoint, script, statusValue);
            }
        }

        this.refresh();
    }

    /**
     * Handles the drag-and-drop operation for scripts.
     * @param {readonly (Breakpoint | Script)[]} source - The dragged elements.
     * @param {vscode.DataTransfer} dataTransfer - The data transfer object.
     */
    handleDrag(source: readonly (Breakpoint | Script)[], dataTransfer: vscode.DataTransfer): void {
        const scriptsToDrag: Script[] = source.filter((e): e is Script => 'uri' in e);
        if (scriptsToDrag.length !== source.length) {
            showWarningMessage('Only scripts can be dragged.');
            return;
        }
        if (scriptsToDrag.length) {
            dataTransfer.set(
                this.mimeType,
                new vscode.DataTransferItem(
                    JSON.stringify(scriptsToDrag.map(s => s.uri))
                )
            );
        }
    }

    /**
     * Handles the drop operation for scripts onto Breakpoints.
     * @param {Breakpoint | Script | undefined} target - The target Breakpoint for the drop operation.
     * @param {vscode.DataTransfer} dataTransfer - The data transfer object containing dropped data.
     */
    async handleDrop(
        target: Breakpoint | Script | undefined,
        dataTransfer: vscode.DataTransfer
    ): Promise<void> {
        if (!target) return;

        const breakpointTarget = (
            isBreakpoint(target)
                ? target
                : this._getParent(target as Script)
        ) as Breakpoint | null;
        
        if (breakpointTarget) {
            const droppedData: vscode.DataTransferItem | undefined = dataTransfer.get(this.mimeType);
            if (droppedData) {
                const droppedUris: string = await droppedData.asString();
                const scriptsToCopy: string[] = JSON.parse(droppedUris) as string[];
                this.storageManager.assignScriptsToBreakpoint(breakpointTarget, scriptsToCopy);
            }
        }

        this.refresh();
    }

    /**
     * Opens the specified script in a new editor tab.
     * @param {Script} script - The script to open.
     */
openScripts = (script: Script): void => {
    const scripts = this.getSelectedItems() as Script[];
    const uniqueScripts: Set<Script> = new Set([...scripts, script]);

    uniqueScripts.forEach(async (script: Script) => {
        const document = await vscode.workspace.openTextDocument(script.uri);
        vscode.window.showTextDocument(document, { preview: false }); // Ensure each opens in a new tab
    });
};


    /**
     * Gets the currently selected items from the Tree View.
     * @returns {(Breakpoint | Script)[]} The currently selected Breakpoints or Scripts.
     */
    getSelectedItems(): (Breakpoint | Script)[] {
        return Array.from(this.selectedItems);
    }

    /**
     * Deactivates all currently selected items in the Tree View.
     */
    deactivateSelectedItems = () :void => {
        this.getSelectedItems().forEach((item: Breakpoint | Script) => {
            this.setElementActivation(item, false);
        });
    }

    /**
     * Activates all currently selected items in the Tree View.
     */
    activateSelectedItems = () :void => {
        this.getSelectedItems().forEach((item: Breakpoint | Script) => {
            this.setElementActivation(item, true);
        });
    }

    /**
     * Removes the specified Script from the Tree View.
     * @param {Script} element - The Script to remove.
     */
    removeSelectedItems = (element: Script): void => {
        const elements: (Breakpoint | Script)[] = [...this.getSelectedItems(), element];
        new Set(elements).forEach((elem: Breakpoint | Script) => {
            if (isBreakpoint(elem)) {
                const bp = elem as Breakpoint;
                this.storageManager.removeBreakpoint(bp);
                this.collapsibleStates.delete(bp.id);
                return;
            }
            const script = elem as Script;
            const parentBreakpoint = this._getParent(script);
            parentBreakpoint &&
                this.storageManager.removeBreakpointScript(parentBreakpoint, script.uri);
        });
        this.refresh();
    }

    /**
     * Copies selected scripts and sets the context for them.
     */
    copyScripts = (): void => {
        const selectedScripts: Script[] = this.getSelectedItems() as Script[];
        if (selectedScripts.length) {
            this.copiedScripts = selectedScripts;
            const nonEmpty: boolean = selectedScripts.length > 0;
            commands.executeCommand('setContext', 'replStash.hasCopiedScripts', nonEmpty);
        }
    }

    /**
     * Runs the provided script along with all selected scripts.
     * @param {Script} script - The script to execute.
     */
    runScripts = (script: Script): void => {
        if (!_debugger?.activeDebugSession) {
            showWarningMessage('No active debug session.');
            return;
        }
        const selectedScripts: Script[] = this.getSelectedItems() as Script[];
        const scripts: Set<Script> = new Set([...selectedScripts, script]);
        scripts.forEach(async (script: Script) => {
            evaluateScripts([script.uri]);
        });
    }

    /**
     * Runs all scripts associated with the specified breakpoint.
     * @param {Breakpoint} breakpoint - The breakpoint whose scripts to run.
     */
    runAllBreakpointScripts = (breakpoint: Breakpoint): void => {
        if (!_debugger?.activeDebugSession) {
            showWarningMessage('No active debug session.');
            return;
        }
        if (!breakpoint.linked) {
            showWarningMessage('Breakpoint is not linked to any source file.');
        }
        evaluateScripts(breakpoint.scripts.map(s => s.uri));
    }

    /**
     * Pastes the copied scripts into the specified breakpoint.
     * @param {Breakpoint} breakpoint - The breakpoint to assign copied scripts to.
     */
    pasteScripts = (breakpoint: Breakpoint): void => {
        this.storageManager.assignScriptsToBreakpoint(
            breakpoint,
            this.copiedScripts.map(s => s.uri)
        );
        this.refresh();
    }

    /**
     * Sets the collapsible state for a given element in the TreeView.
     * @private
     * @param {Breakpoint | Script} element - The element for which the collapsible state should be set.
     * @param {vscode.TreeItemCollapsibleState} state - The collapsible state to assign to the element.
     */
    private setCollapsibleState(element: Breakpoint | Script, state: vscode.TreeItemCollapsibleState): void {
        isBreakpoint(element) && this.collapsibleStates.set((element as Breakpoint).id, state);
    }

    /**
     * Creates and registers the Tree View for breakpoints.
     * @returns {vscode.TreeView<Breakpoint | Script>} The created Tree View.
     */
    createTreeView(): vscode.TreeView<Breakpoint | Script> {
        const treeView = window.createTreeView('breakpointsView', {
            treeDataProvider: this,
            manageCheckboxStateManually: true,
            dragAndDropController: this,
            canSelectMany: true,
        });

        treeView.onDidChangeSelection((event) => {
            const selection: readonly (Breakpoint | Script)[] = event.selection;
            const isMultipleSelect: boolean = selection.length > 1;
            const breakpointSelected: boolean = selection.some((elem) =>
                isBreakpoint(elem)
            );
            this.selectedItems = new Set(selection);
            commands.executeCommand(
                'setContext',
                'replStash.multipleSelectedItems',
                isMultipleSelect
            );
            commands.executeCommand(
                'setContext',
                'replStash.breakpointSelected',
                breakpointSelected
            );
        });

        treeView.onDidChangeCheckboxState(
            (event: vscode.TreeCheckboxChangeEvent<Script | Breakpoint>) => {
                event.items.forEach(([elem, checked]: [Script | Breakpoint, number]) => {
                    const isChecked: boolean = checked === vscode.TreeItemCheckboxState.Checked;
                    this.setElementActivation(elem, isChecked);
                });
            }
        );

        type ExpansionEvent = vscode.TreeViewExpansionEvent<Breakpoint | Script>;

        treeView.onDidCollapseElement((event: ExpansionEvent): void => {
            this.setCollapsibleState(event.element, vscode.TreeItemCollapsibleState.Collapsed);
        });

        treeView.onDidExpandElement((event: ExpansionEvent): void => {
            this.setCollapsibleState(event.element, vscode.TreeItemCollapsibleState.Expanded);
        });

        return treeView;
    }
    
    /**
     * Delegates the script renaming operation to the CommandHandler.
     * @param {Script} script - The script to rename.
     * @returns {Promise<void>}
     */
    renameSavedScript = async (script: Script): Promise<void> => {
        CommandHandler.instance.renameSavedScript(path.basename(script.uri));
    };
}
