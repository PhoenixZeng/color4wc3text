import * as vscode from "vscode";
import { registerColorProviders } from "./main/color-provider.js";

export function activate(context: vscode.ExtensionContext) {
  registerColorProviders(context);
}

export function deactivate() {}
