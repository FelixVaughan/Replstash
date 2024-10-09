"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
class BreakpointsTreeProvider {
    constructor(storageManager, // StorageManager for data
    commandHandler // CommandHandler for operations
    ) {
        this.storageManager = storageManager;
        this.commandHandler = commandHandler;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Refresh the TreeView
        this.refresh = () => {
            this._onDidChangeTreeData.fire(undefined);
        };
        // Retrieve the item for the TreeView (either Breakpoint or Script)
        this.getTreeItem = (element) => {
            const treeItem = new vscode.TreeItem('uri' in element ? element.uri : element.file);
            // Add collapsible state based on whether it's a Breakpoint or a Script
            treeItem.collapsibleState = 'scripts' in element
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;
            // Add contextValue for context menu
            treeItem.contextValue = 'scripts' in element ? 'breakpoint' : 'script';
            return treeItem;
        };
        // Retrieve children for the Breakpoint (the scripts), or return the top-level breakpoints
        this.getChildren = (element) => {
            if (!element) {
                return Promise.resolve(this.storageManager.loadBreakpoints()); // Load breakpoints from StorageManager
            }
            return Promise.resolve(element.scripts); // Return scripts for a given breakpoint
        };
        // Get the parent element of the given script (to support nested hierarchy)
        this.getParent = (element) => {
            const breakpoints = this.storageManager.loadBreakpoints();
            return breakpoints.find(breakpoint => breakpoint.scripts.includes(element)) || null;
        };
        // Method to deactivate a breakpoint
        this.deactivateBreakpoint = (breakpoint) => {
            this.commandHandler.deactivateBreakpoint(breakpoint); // Use commandHandler's deactivate logic
            this.refresh();
        };
        // Method to activate or deactivate a script
        this.activateDeactivateScript = (script) => {
            script.active = !script.active; // Toggle active state
            const parentBreakpoint = this.getParent(script);
            if (parentBreakpoint) {
                this.commandHandler.toggleScriptActivation(parentBreakpoint, script, script.active); // Call commandHandler for state change
            }
            this.refresh();
        };
    }
}
exports.default = BreakpointsTreeProvider;
//# sourceMappingURL=breakpointsTreeProvider.js.map