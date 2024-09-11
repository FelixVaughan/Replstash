const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
const activate = (context) => {
    let sessionOutput = {};
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
        
        // Save the captured output for each breakpoint
        breakpoints.forEach((breakpoint, index) => {
            const filePath = path.join(vscode.workspace.rootPath || '', '.vscode',`breakpoint_${breakpoint.line}.txt`);
            fs.writeFileSync(filePath, Object.values(breakpoint.content).join('\n'));
            vscode.window.showInformationMessage(`Breakpoint output saved to: ${filePath}`);
        });

        const sessionFilePath = path.join(vscode.workspace.rootPath || '', '.vscode','debug_output.txt');
        fs.writeFileSync(sessionFilePath, Object.values(sessionOutput).join('\n'));
        vscode.window.showInformationMessage(`Debug session output saved to: ${sessionFilePath}`);
    });

    vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session) {
            return {
                onWillReceiveMessage: async (message) => {
                    if (message.arguments?.context === 'repl') {
                        const expression = message.arguments.expression;
                        currentBreakpoint.content[message.seq] = expression;
                        sessionOutput[message.seq] = expression;
                        
                    }
                },
                onDidSendMessage: async (message) => {

                    // if (message.type === 'event' && message.event === 'output') {
                    //     const output = message.body.output;
                    //     if (output) {
                    //         sessionOutput.push(output);
                    //         currentBreakpoint?.content.push(output);
                    //     }
                    // }

                    if (message.type === 'response' && message.command === 'evaluate') {
                        if (!message?.success) {
                            delete currentBreakpoint.content[message.request_seq];
                            delete sessionOutput[message.request_seq];
                        }
                    }

                    //handle breakpoint hit
                    if (message.type === 'event' && message.event === 'stopped') {
                        if (message.body.reason === 'breakpoint') {
                            const stackTraceResponse = await vscode.debug.activeDebugSession.customRequest('stackTrace', { 
                                threadId: message.body.threadId 
                            });

                            if (stackTraceResponse && stackTraceResponse.stackFrames.length > 0) {
                                const topFrame = stackTraceResponse.stackFrames[0]; // Get the top frame, which is where the breakpoint hit
                                const source = topFrame.source;
                                const line = topFrame.line;
    
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
                                            "content": {}
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


//general questions
//should multiple hits mean multiple scripts? Yes, each breakpoint should be its own "session"
//Perhaps make configurable
