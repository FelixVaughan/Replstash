const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    let output = [];
    const verboten = ["app", "arguments.length", "fn"]
    // Listen to the start of a debug session
    const startDebugSessionDisposable = vscode.debug.onDidStartDebugSession(session => {
        vscode.window.showInformationMessage(`Debug session started: ${session.name}`);
        vscode.debug.activeDebugConsole.appendLine(`Debug session started: ${session.name}`);
        output.push(`Debug session started: ${session.name}`);
    });

    // Capture output from the debug console
    const customEventDisposable = vscode.debug.onDidReceiveDebugSessionCustomEvent(event => {
        if (event.body && event.body.output) {
            output.push(event.body.output);
        }
    });

    // Listen to the end of a debug session
    const endDebugSessionDisposable = vscode.debug.onDidTerminateDebugSession(session => {
        vscode.window.showInformationMessage(`Debug session ended: ${session.name}`);
        // Save the captured output to a file
        const filePath = path.join(vscode.workspace.rootPath || '', 'debug_output.txt');
        fs.writeFileSync(filePath, output.join('\n'));
        vscode.window.showInformationMessage(`Debug output saved to: ${filePath}`);
    });

    vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session) {
            return {
                onWillReceiveMessage: async (message) => {
                    // Capture the command entered in the debug console
                    if (message.type === 'request' && message.command === 'evaluate') {
                        const expression = message.arguments.expression;
                        if (expression && !expression.startsWith("Debug session") && !verboten.includes(expression)) {
                            console.log(`Command Entered: ${expression}`);
                            if(expression == "//run"){
                                //run whatever is in the output file
                                const filePath = path.join(vscode.workspace.rootPath || '', 'debug_output.txt');
                                const data = fs.readFileSync(filePath, 'utf8');
                                const activeDebugSession = await vscode.debug.activeDebugSession;
                                try {
                                    vscode.debug.activeDebugConsole.appendLine(data);
                                    await activeDebugSession.customRequest('evaluate', { expression: data });
                                }catch(e){
                                    vscode.window.showErrorMessage(`Error evaluating expression:\n{e}`);
                                }
                                return;
                            }
                            output.push(expression);
                        }
                    }
                },
                onDidSendMessage: (message) => {
                    // Handle the message sent from the debug adapter to the extension
                    if (message.type === 'event' && message.event === 'output') {
                        const output = message.body.output;
                        if (output) {
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
        customEventDisposable,
        endDebugSessionDisposable
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};