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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
class BreakpointsTreeProvider {
    storageManager;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(storageManager) {
        this.storageManager = storageManager;
    }
    // Refresh the TreeView
    refresh = () => {
        this._onDidChangeTreeData.fire(undefined);
    };
    // Retrieve the item for the TreeView (either Breakpoint or Script)
    getTreeItem = (element) => {
        const isBreakpoint = Object.hasOwn(element, 'scripts');
        const treeItem = new vscode.TreeItem('uri' in element ? element.uri : element.file);
        treeItem.checkboxState = element.active
            ? vscode.TreeItemCheckboxState.Checked
            : vscode.TreeItemCheckboxState.Unchecked;
        if (isBreakpoint) {
            element = element;
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            treeItem.contextValue = 'breakpoint';
            treeItem.label = `[${element.file}]\t(${element.scripts.length})`;
            treeItem.tooltip = element.id;
            treeItem.description = `${element.line}:${element.column}`;
        }
        else {
            element = element;
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue = 'script';
            treeItem.label = `<${path_1.default.basename(element.uri)}>`;
        }
        return treeItem;
    };
    // Retrieve children for the Breakpoint (the scripts), or return the top-level breakpoints
    getChildren = (element) => {
        if (!element) {
            return Promise.resolve(this.storageManager.loadBreakpoints()); // Load breakpoints from StorageManager
        }
        return Promise.resolve(element.scripts); // Return scripts for a given breakpoint
    };
    // Get the parent element of the given script (to support nested hierarchy)
    getParent = (element) => {
        const breakpoints = this.storageManager.loadBreakpoints();
        return breakpoints.find(breakpoint => breakpoint.scripts.includes(element)) || null;
    };
    setElementActivation = (element, status) => {
        // Compute the status value: use provided status or toggle current state
        const statusValue = status !== undefined ? status : !element.active;
        if (Object.hasOwn(element, 'scripts')) {
            // Element is a Breakpoint
            const breakpoint = element;
            this.storageManager.changeBreakpointActivation(breakpoint, statusValue);
        }
        else {
            // Element is a Script
            const script = element;
            const parentBreakpoint = this.getParent(script);
            if (parentBreakpoint) {
                this.storageManager.changeScriptActivation(parentBreakpoint, script, statusValue);
            }
        }
        // Refresh the tree view to reflect changes
        this.refresh();
    };
    createTreeView = () => {
        const treeView = utils_1.window.createTreeView('breakpointsView', {
            treeDataProvider: this,
            manageCheckboxStateManually: true,
        });
        treeView.onDidChangeCheckboxState((event) => {
            event.items.forEach(([elem, checked]) => {
                const isChecked = checked === vscode.TreeItemCheckboxState.Checked;
                this.setElementActivation(elem, isChecked);
            });
        });
        return treeView;
    };
}
exports.default = BreakpointsTreeProvider;
//# sourceMappingURL=breakpointsTreeProvider.js.map