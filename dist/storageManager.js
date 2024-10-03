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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
class StorageManager {
    constructor(context) {
        var _a;
        this.loadedBreakpoints = [];
        // Helper function to get current timestamp
        this.getCurrentTimestamp = () => {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
        };
        // Save the contents to a file
        this.saveToFile = (fullPath, content) => {
            fs_1.default.writeFileSync(fullPath, content);
            utils_1.window.showInformationMessage(`Saved to: ${fullPath}`);
        };
        // Read contents from a file
        this.readFromFile = (filename) => {
            const filePath = path_1.default.join(this.storagePath, filename);
            if (fs_1.default.existsSync(filePath)) {
                return fs_1.default.readFileSync(filePath, 'utf8');
            }
            else {
                utils_1.window.showErrorMessage(`File not found: ${filePath}`);
                return null;
            }
        };
        //save breakpoint
        this.saveBreakpoint = (bp, fileName) => {
            const content = Object.values(bp.content).join('\n');
            const fullPath = path_1.default.join(this.storagePath, 'breakpoints', fileName);
            this.saveToFile(fullPath, content);
            this.upsertBreakpointScripts(bp, fullPath);
        };
        this._updateBreakpoints = (breakpoints) => {
            this.context.workspaceState.update('breakpoints', breakpoints);
            this.loadBreakpoints(); //refresh
        };
        // Update record
        this.upsertBreakpointScripts = (bp, fullPath) => {
            const loadedBreakpoints = this.loadBreakpoints();
            const existingBreakpoint = loadedBreakpoints.find((b) => b.id === bp.id);
            if (existingBreakpoint) {
                existingBreakpoint.scripts.push(fullPath);
                existingBreakpoint.modifiedAt = this.getCurrentTimestamp();
            }
            else {
                bp.scripts.push(fullPath);
                bp.createdAt = this.getCurrentTimestamp();
                loadedBreakpoints.push(bp);
            }
            this._updateBreakpoints(loadedBreakpoints);
        };
        // Load all breakpoints
        this.loadBreakpoints = () => {
            this.loadedBreakpoints = this.context.workspaceState.get('breakpoints', []);
            return this.loadedBreakpoints;
        };
        // Save session output
        this.saveSessionOutput = (sessionOutput, sessionId) => {
            const content = Object.values(sessionOutput).join('\n');
            const sessionFilename = `${sessionId}_${this.getCurrentTimestamp()}`;
            const fullPath = path_1.default.join(this.storagePath, 'session', sessionFilename);
            this.saveToFile(fullPath, content);
        };
        this.fileExists = (filename) => {
            const paths = ['session', 'breakpoints'].map((dir) => {
                return path_1.default.join(this.storagePath, dir, filename);
            });
            const [sessionPath, breakpointsPath] = paths;
            return fs_1.default.existsSync(sessionPath) || fs_1.default.existsSync(breakpointsPath);
        };
        this.storagePath = ((_a = context.storageUri) === null || _a === void 0 ? void 0 : _a.fsPath) || "";
        this.context = context;
        // Ensure the base directory exists
        if (!fs_1.default.existsSync(this.storagePath)) {
            fs_1.default.mkdirSync(this.storagePath, { recursive: true });
        }
        // Subdirectories to create
        const subdirs = ['session', 'breakpoints'];
        subdirs.forEach((dir) => {
            const fullPath = path_1.default.join(this.storagePath, dir);
            if (!fs_1.default.existsSync(fullPath)) {
                fs_1.default.mkdirSync(fullPath, { recursive: true });
            }
        });
        this.loadBreakpoints();
    }
    breakpointFilesMetaData() {
        const _formatDate = (date) => {
            return date.toLocaleString('en-US', {
                timeZoneName: 'short',
            });
        };
        const breakpointsPath = path_1.default.join(this.storagePath, 'breakpoints');
        return fs_1.default.readdirSync(breakpointsPath).map((file) => {
            const fullPath = path_1.default.join(breakpointsPath, file);
            const { size, birthtime: _createdAt, mtime: _modifiedAt } = fs_1.default.statSync(fullPath);
            const [createdAt, modifiedAt] = [_createdAt, _modifiedAt].map(_formatDate);
            return { fileName: file, fullPath, size, createdAt, modifiedAt };
        });
    }
    openBreakpointFile(fileName) {
        const fullPath = path_1.default.join(this.storagePath, 'breakpoints', fileName);
        vscode.workspace.openTextDocument(fullPath).then((document) => {
            utils_1.window.showTextDocument(document);
        });
    }
    deleteBreakpointFile(fileName) {
        const fullPath = path_1.default.join(this.storagePath, 'breakpoints', fileName);
        fs_1.default.unlinkSync(fullPath);
        const loadedBreakpoints = this.loadBreakpoints();
        const updatedBreakpoints = loadedBreakpoints.filter(bp => {
            const updatedScripts = bp.scripts.filter((s) => s !== fullPath);
            bp.scripts = updatedScripts;
            return bp.scripts.length > 0; // Remove if no scripts are left
        });
        this._updateBreakpoints(updatedBreakpoints);
    }
}
exports.default = StorageManager;
//# sourceMappingURL=storageManager.js.map