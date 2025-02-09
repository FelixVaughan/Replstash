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
    describe,
    InvalidReason,
    getCurrentTimestamp,
    showErrorMessage
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

        if (isBreakpoint(element)) {
            const breakpoint = element as Breakpoint;
            const iconColor = !breakpoint.linked
                ? 'disabledForeground' : breakpoint.active
                ? 'testing.iconPassed' : 'charts.yellow';
            treeItem.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor(iconColor));
            const collState = this.collapsibleStates.get(breakpoint.id) || vscode.TreeItemCollapsibleState.Collapsed;
            treeItem.collapsibleState = collState;
            treeItem.contextValue = 'breakpoint';
            treeItem.label = path.basename(breakpoint.file);
            treeItem.tooltip = !breakpoint.linked ? 'Unlinked' : breakpoint.active ? 'Active' : 'Inactive';
            treeItem.description = describe(breakpoint, { showPath: false, showScriptCount: true });
        } else {
            const script = element as Script;
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue = 'script';
            treeItem.label = path.basename(script.uri);

            if (this.isFlattened) {
                const parentBreakpoint: Breakpoint | null = this._getParent(script);
                treeItem.description = parentBreakpoint ? describe(parentBreakpoint) : '';
            }

            const iconColor = script.error
                ? 'testing.iconFailed' : script.active
                ? 'testing.iconPassed' : 'charts.yellow';
            treeItem.iconPath = new vscode.ThemeIcon('file-code', new vscode.ThemeColor(iconColor));
        }
    
        return treeItem;
    }

    /**
     * Navigates to the specified file from the Tree View.
     * @param {Breakpoint} element - The Breakpoint to navigate to
     */
    goTo = (element: Breakpoint): void => {
        const position = new vscode.Position(Math.max(element.line - 1, 0), 0);
        const fileUri = vscode.Uri.file(element.file);
        commands.executeCommand('vscode.open', fileUri, {
            selection: new vscode.Range(position, position),
        });
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
    setElementActivation = (
        element: Breakpoint | Script, 
        status?: boolean
    ): void => {
        const items = this.getSelectedItems(element);
        items.forEach((item: Breakpoint | Script) => {
            const statusValue: boolean = status !== undefined ? status : !item.active;
            if (isBreakpoint(item)) {
                const breakpoint = item as Breakpoint;
                this.storageManager.changeBreakpointActivation(breakpoint, statusValue);
            } else {
                const script = item as Script;
                const parentBreakpoint = this._getParent(script);
                if (parentBreakpoint) {
                    this.storageManager.changeScriptActivation(parentBreakpoint, script, statusValue);
                }
            }
            this.refresh();
        });
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
        const scripts = this.getSelectedItems(script) as Script[];
        scripts.forEach(async (script: Script) => {
            const document = await vscode.workspace.openTextDocument(script.uri);
            vscode.window.showTextDocument(document, { preview: false }); // Ensure each opens in a new tab
        });
    };


    /**
     * Create an empty script and add it to the specified breakpoint.
     * @param {Breakpoint} breakpoint - The breakpoint to add the script to.
     * @returns {Promise<void>}
     */
    addScript = async (breakpoint: Breakpoint): Promise<void> => {
        const breakpoints = this.getSelectedItems(breakpoint) as Breakpoint[];
        breakpoints.forEach((item: Breakpoint) => {
            const invalidReason: InvalidReason = this.storageManager.persistCaptureContent(
                item,
                `new_${item.id}_${getCurrentTimestamp()}`,
                ''
            )
            if (invalidReason != InvalidReason.None) {
                showWarningMessage(invalidReason);
                return;
            }
        })
        this.refresh();
    }

    /**
     * Gets the currently selected items from the Tree View.
     * @returns {(Breakpoint | Script)[]} The currently selected Breakpoints or Scripts.
     */
    getSelectedItems(
        append: Script | Breakpoint | undefined = undefined)
    : (Breakpoint | Script)[] {
        const items = new Set([
            ...this.selectedItems, 
            ...(append ? [append] : [])
        ]);
        return Array.from(items);
    }

    /**
     * Deactivates all currently selected items in the Tree View.
     */
    deactivateSelectedItems = (element: Script | Breakpoint) :void => {
        this.getSelectedItems(element).forEach((item: Breakpoint | Script) => {
            this.setElementActivation(item, false);
        });
    }

    /**
     * Activates all currently selected items in the Tree View.
     */
    activateSelectedItems = (element: Script | Breakpoint) :void => {
        this.getSelectedItems(element).forEach((item: Breakpoint | Script) => {
            this.setElementActivation(item, true);
        });
    }

    /**
     * Removes the specified Script from the Tree View.
     * @param {Script} element - The Script to remove.
     */
    removeSelectedItems = (element: Script): void => {
        this.getSelectedItems(element).forEach((elem: Breakpoint | Script) => {
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
    copyScripts = (script: Script): void => {
        const selectedScripts: Script[] = this.getSelectedItems(script) as Script[];
        if (selectedScripts.length) {
            this.copiedScripts = selectedScripts;
            const nonEmpty: boolean = selectedScripts.length > 0;
            commands.executeCommand('setContext', 'replstash.hasCopiedScripts', nonEmpty);
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
        const selectedScripts: Script[] = this.getSelectedItems(script) as Script[];
        evaluateScripts([...selectedScripts]);
        // commands.executeCommand('replResultsView.focus');
    }

    /**
     * Runs all scripts associated with the specified breakpoint.
     * @param {Breakpoint} breakpoint - The breakpoint whose scripts to run.
     */
    runAllBreakpointScripts = async (element: Breakpoint): Promise<void> => {
        const breakpoints = this.getSelectedItems(element) as Breakpoint[];

        if (!_debugger?.activeDebugSession) {
            showWarningMessage('No active debug session.');
            return;
        }

        const scripts = breakpoints.flatMap((bp) => bp.scripts);
        evaluateScripts(scripts);
        commands.executeCommand('replResultsView.focus');
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

        treeView.onDidChangeSelection((event: vscode.TreeViewSelectionChangeEvent<any>) => {
            const selection: readonly (Breakpoint | Script)[] = event.selection;
            const breakpointSelected: boolean = selection.some((elem) =>
                isBreakpoint(elem)
            );

            this.selectedItems = new Set(selection);
            
            commands.executeCommand(
                'setContext',
                'replstash.breakpointSelected',
                breakpointSelected
            );
        });

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

    /**
     * Resync breakpoints with the current debug session.
     * @returns {Promise<void>}
     */
    resyncBreakpoints = async (): Promise<void> => {
        // Check for unsaved files
        const unsavedFiles = vscode.workspace.textDocuments.filter(doc => doc.isDirty);
        if (unsavedFiles.length > 0) {
            const message = 'Please save all files before resyncing.';
            const saveButton = 'Save All';
            const result = await showErrorMessage(message, { modal: true }, saveButton);
            
            if (result === saveButton) {
                await vscode.workspace.saveAll();
                // Retry the resync after saving
                return this.resyncBreakpoints();
            }
            return;
        }

        const loadedBreakpoints: Breakpoint[] = this.storageManager.loadBreakpoints();
        //refresh debugger breakpoints
        
        const sessionBreakpoints = vscode.debug?.breakpoints ?? [];
    
        const updatedBreakpoints: Breakpoint[] = loadedBreakpoints.map((bp) => {
            // Try to find an exact match by ID
            const idBp = sessionBreakpoints.find((sbp) => sbp.id === bp.id) as vscode.SourceBreakpoint | undefined;
    
            if (idBp) {
                const { range } = idBp.location;
                return {
                    ...bp,
                    line: range.start.line + 1,
                    column: range.start.character,
                    linked: true,
                };
            }
    
            // Find breakpoints that match by file and line
            const locationMatches = sessionBreakpoints.filter(
                (sbp) => sbp instanceof vscode.SourceBreakpoint
                    && sbp.location.uri.fsPath === bp.file
                    && sbp.location.range.start.line + 1 === bp.line
            ) as vscode.SourceBreakpoint[];
    
            // Find the best match (same column or first match)
            const nearestMatch = locationMatches.find((sbp) => 
                sbp.location.range.start.character === bp.column
            ) ?? locationMatches[0];
    
            if (nearestMatch) {
                return {
                    ...bp,
                    id: nearestMatch.id,
                    active: false,
                    linked: true,
                    scripts: bp.scripts.map((s) => ({ ...s, bId: nearestMatch.id })),
                };
            }
    
            // No match found
            return {
                ...bp,
                linked: false,
            };
        });
    
        this.storageManager.updateBreakpoints(updatedBreakpoints);
    };
    
}
