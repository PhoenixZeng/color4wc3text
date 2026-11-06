import * as vscode from "vscode";
import { registerWar3Preview } from "./main/war3-preview.js";
import { registerColorProviders } from "./main/color-provider.js";

export function activate(context: vscode.ExtensionContext) {
  registerColorProviders(context);
  registerWar3Preview(context);
}

export function deactivate() {}
