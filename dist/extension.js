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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const storageManager_1 = __importDefault(require("./storageManager"));
const sessionManager_1 = __importDefault(require("./sessionManager"));
const debugAdapterTracker_1 = __importDefault(require("./debugAdapterTracker"));
const commandHandler_1 = __importDefault(require("./commandHandler"));
/**
 * @param {vscode.ExtensionContext} context
 */
const activate = (context) => {
    const sessionManager = new sessionManager_1.default();
    const storageManager = new storageManager_1.default(context);
    const commandHandler = new commandHandler_1.default(sessionManager, storageManager);
    // Register debug adapter tracker factory
    const debugAdapterTrackerFactory = vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session) {
            console.log(`Tracking Session: ${session.id}`);
            return new debugAdapterTracker_1.default(sessionManager, commandHandler); // Pass commandHandler to track capturing state
        }
    });
    // Command registration helper
    const registerCommand = (commandId, commandFunction) => {
        return vscode.commands.registerCommand(commandId, commandFunction);
    };
    // Register all commands with a helper function
    const commands = [
        registerCommand('slugger.startCapture', commandHandler.startCapture),
        registerCommand('slugger.stopCapture', commandHandler.stopCapture),
        registerCommand('slugger.pauseCapture', commandHandler.pauseCapture),
        registerCommand('slugger.editSavedScript', commandHandler.editSavedScript),
        registerCommand('slugger.deleteSavedScript', commandHandler.deleteSavedScript),
        registerCommand('slugger.activateScripts', commandHandler.activateScripts)
    ];
    // Add all disposables (commands and tracker) to the subscriptions
    context.subscriptions.push(...commands, debugAdapterTrackerFactory);
};
exports.activate = activate;
const deactivate = () => { };
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map