const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
const activate = (context) => {
    let sessionOutput = [];
    let breakpoints = [];
    let currentBreakpoint = null;

    // Listen to the start of a debug session
    const startDebugSessionDisposable = vscode.debug.onDidStartDebugSession(session => {
        vscode.window.showInformationMessage(`Debug session started: ${session.name}`);
        vscode.debug.activeDebugConsole.appendLine(`Debug session started: ${session.name}`);
        sessionOutput.push(`Debug session started: ${session.name}`);
    });

    const breakpointDisposable = vscode.debug.onDidChangeBreakpoints((event) => {
        if (event.added.length > 0) {
            event.added.forEach((breakpoint) => {
                console.log('Breakpoint added:', breakpoint);
                // You can handle the added breakpoint here
                // For example, check its location, conditions, etc.
            });
        }
    });

    // Listen to the end of a debug session
    const endDebugSessionDisposable = vscode.debug.onDidTerminateDebugSession(session => {
        vscode.window.showInformationMessage(`Debug session ended: ${session.name}`);
        // Save the captured output to a file
        const filePath = path.join(vscode.workspace.rootPath || '', 'debug_output.txt');
        fs.writeFileSync(filePath, sessionOutput.join('\n'));
        vscode.window.showInformationMessage(`Debug output saved to: ${filePath}`);
    });

    vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session) {
            return {
                onWillReceiveMessage: async (message) => {
                    if (message.arguments?.context === 'repl') {
                        const expression = message.arguments.expression;
                        sessionOutput.push(expression);
                    }
                },
                onDidSendMessage: (message) => {
                    // Handle the message sent from the debug adapter to the extension
                    if (message.type === 'event' && message.event === 'output') {
                        const output = message.body.output;
                        if (output) {
                            //TODO: only add expression if no errors
                            console.log(`Debug Console Output: ${output}`);
                            // Do something with the output, e.g., store it, process it, etc.
                        }
                    }
                },
                onError: (error) => {
                    console.error(`Debug Adapter Tracker Error: ${error}`);
                },
                onExit: (code, signal) => {
                    console.log(`Debug Adapter exited with code: ${code}, signal: ${signal}`);
                }
            };
        }
    })

    context.subscriptions.push(
        startDebugSessionDisposable,
        breakpointDisposable,
        endDebugSessionDisposable
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};

const func = async () => {
    const filePath = path.join(vscode.workspace.rootPath || '', 'debug_output.txt');
    const data = fs.readFileSync(filePath, 'utf8');
    const activeDebugSession = await vscode.debug.activeDebugSession;
    try {
        vscode.debug.activeDebugConsole.appendLine(data);
        await activeDebugSession.customRequest('evaluate', { expression: data, context: 'repl' });
    }catch(e){
        vscode.window.showErrorMessage(`Error evaluating expression:\n{e}`);
    }
    return;
}