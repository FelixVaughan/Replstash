const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class StorageManager {
    constructor(context) {
        this.storagePath = context.storageUri.fsPath;
        this.context = context;
        
        // Ensure the base directory exists
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }

        // Subdirectories to create
        const subdirs = ['session', 'breakpoints'];

        subdirs.forEach((dir) => {
            const fullPath = path.join(this.storagePath, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
        this.loadBreakpoints();
    }

    // Helper function to get current timestamp
    getCurrentTimestamp() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    }

    // Save the contents to a file
    saveToFile(fullPath, content) {
        fs.writeFileSync(fullPath, content);
        vscode.window.showInformationMessage(`Saved to: ${fullPath}`);
    }

    // Read contents from a file
    readFromFile(filename) {
        const filePath = path.join(this.storagePath, filename);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
        } else {
            vscode.window.showErrorMessage(`File not found: ${filePath}`);
            return null;
        }
    }

    //save breakpoint
    saveBreakpoint(bp, fileName) {
        const content = Object.values(bp.content).join('\n');
        const fullPath = path.join(this.storagePath, 'breakpoints', fileName);
        this.saveToFile(fullPath, content);
        this.upsertBreakpointScripts(bp, fullPath);
    }

    _updateBreakpoints(breakpoints) {
        this.context.workspaceState.update('breakpoints', breakpoints);
        this.loadBreakpoints(); //refresh
    }

    // Update record
    upsertBreakpointScripts(bp, fullPath) {
        const loadedBreakpoints = this.loadBreakpoints();
        const existingBreakpoint = loadedBreakpoints.find(b => b.id === bp.id);
        if (existingBreakpoint) {
            existingBreakpoint.scripts.push(fullPath);
            existingBreakpoint.modifedAt = this.getCurrentTimestamp();
        } else {
            bp.scripts.push(fullPath);
            bp.createdAt = this.getCurrentTimestamp();
            loadedBreakpoints.push(bp);
        }
        this._updateBreakpoints(loadedBreakpoints);
    }

    // Load all breakpoints
    loadBreakpoints() {
        this.loadedBreakpoints = this.context.workspaceState.get('breakpoints', []);
        return this.loadedBreakpoints;
    }

    // Save session output
    saveSessionOutput(sessionOutput, sessionId) {
        const content = Object.values(sessionOutput).join('\n');
        const sessionFilename = `${sessionId}_${this.getCurrentTimestamp()}`;
        const fullPath = path.join(this.storagePath, 'session', sessionFilename);
        this.saveToFile(fullPath, content);
    }

    fileExists(filename) {
        const [sessionPath, breakpointsPath] = ['session', 'breakpoints'].map(dir => path.join(this.storagePath, dir, filename));
        return fs.existsSync(sessionPath) || fs.existsSync(breakpointsPath);
    }

    breakpointFilesMetaData() {
        const _formatDate = (date) => {
            return date.toLocaleString('en-US', {
                timeZoneName: 'short',
            });
        }

        const breakpointsPath = path.join(this.storagePath, 'breakpoints');
        return fs.readdirSync(breakpointsPath).map(file => {
            const fullPath = path.join(breakpointsPath, file);
            let { size, birthtime: createdAt, mtime: modifiedAt } = fs.statSync(fullPath);
            [createdAt, modifiedAt] = [createdAt, modifiedAt].map(_formatDate);
            return { fileName: file, fullPath, size, createdAt, modifiedAt };
        });
    }
    
    openBreakpointFile(fileName) {
        const fullPath = path.join(this.storagePath, 'breakpoints', fileName);
        vscode.workspace.openTextDocument(fullPath).then((doc) => {
            vscode.window.showTextDocument(doc);
        });
    }

    deleteBreakpointFile(fileName) {
        const fullPath = path.join(this.storagePath, 'breakpoints', fileName);
        fs.unlinkSync(fullPath);

        const loadedBreakpoints = this.loadBreakpoints();
        const updatedBreakpoints = loadedBreakpoints.filter(bp => {
            const updatedScripts = bp.scripts.filter(s => s !== fullPath);
            bp.scripts = updatedScripts;
            return bp.scripts.length > 0; // Remove if no scripts are left
        });
        this._updateBreakpoints(updatedBreakpoints);
    }

}

module.exports = StorageManager;
