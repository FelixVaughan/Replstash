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
                onDidSendMessage: async (message) => {
                    // Handle the message sent from the debug adapter to the extension
                    if (message.type === 'event' && message.event === 'output') {
                        const output = message.body.output;
                        if (output) {
                            //TODO: only add expression if no errors
                            sessionOutput.push(output);
                            currentBreakpoint.content.push(output);
                        }
                    }

                    //handle breakpoint hit
                    if (message.type === 'event' && message.event === 'stopped') {
                        if (message.body.reason === 'breakpoint') {
                            const stackTraceResponse = await vscode.debug.activeDebugSession.customRequest('stackTrace', { threadId: message.body.threadId });

                            if (stackTraceResponse && stackTraceResponse.stackFrames.length > 0) {
                                const topFrame = stackTraceResponse.stackFrames[0]; // Get the top frame, which is where the breakpoint hit
                                const source = topFrame.source;
                                const line = topFrame.line;
                                const column = topFrame.column;
    
                                // Find the corresponding breakpoint from the list of breakpoints
                                const hitBreakpoint = vscode.debug.breakpoints.find(point => {
                                    const location = point.location;
                                    return location.uri.path === source.path && location.range.start.line + 1 === line
                                });    
                                if (hitBreakpoint) {
                                    const breakpointId = hitBreakpoint.id; // Extract the ID of the breakpoint
                                    const breakpoint = breakpoints.find(breakpoint => breakpoint.id === breakpointId)
                                    if (breakpoint) currentBreakpoint = breakpoint;
                                    else {
                                        currentBreakpoint = {
                                            "id": breakpointId,
                                            "line": line,
                                            "content": []
                                        };
                                        breakpoints.push(currentBreakpoint);
                                    }
                                }

                            }
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

//general questions
//should multiple hits mean multiple scripts? Yes, each breakpoint should be its own "session"
    //Perhaps make configurable
