import * as vscode from 'vscode';
import { CommandsProvider } from './CommandsProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new CommandsProvider();

  // Register the TreeView
  vscode.window.registerTreeDataProvider('quickrunPanel', provider);

  // Register the run command (triggered when clicking an item)
  context.subscriptions.push(
    vscode.commands.registerCommand('quickrun.executeCommand', (cmd: string) => {
      const terminal = vscode.window.activeTerminal
        ?? vscode.window.createTerminal('Quick Run');
      terminal.show();
      terminal.sendText(cmd);
    })
  );
}

export function deactivate() {}