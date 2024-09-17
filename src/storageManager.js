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

    // Save all breakpoints
    saveBreakpoints(breakpoints) {
        breakpoints.forEach(bp => {
            const content = Object.values(bp.content).join('\n');
            const fileName = `${path.basename(bp.file)}_${bp.line}_${bp.column}_${this.getCurrentTimestamp()}`;
            const fullPath = path.join(this.storagePath, 'breakpoints', fileName);
            this.saveToFile(fullPath, content);
            bp.scripts.push[fullPath];
            bp.createdAt = this.getCurrentTimestamp();
        });
        this.context.workspaceState.update('breakpoints', breakpoints);
        //why are breakpoints saving with the same id?

    }

    // Load all breakpoints
    loadBreakpoints() {
        this.fetchedBreakpoints = this.context.workspaceState.get('breakpoints', []);
        console.log('Loaded breakpoints:\n', this.fetchedBreakpoints);
    }

    // Save session output
    saveSessionOutput(sessionOutput, sessionId) {
        const content = Object.values(sessionOutput).join('\n');
        const sessionFilename = `${sessionId}_${this.getCurrentTimestamp()}`;
        const fullPath = path.join(this.storagePath, 'session', sessionFilename);
        this.saveToFile(fullPath, content);
    }
}

module.exports = StorageManager;
