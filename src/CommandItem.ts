import * as vscode from 'vscode';
import { QuickRunCommand } from './types';

export class CommandItem extends vscode.TreeItem {
  constructor(public readonly data: QuickRunCommand) {
    super(data.label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'commandItem';
    this.id = data.id;
  }

  execute(): void {
    if (this.data.customCommand) {
      const terminal = vscode.window.activeTerminal ?? vscode.window.createTerminal('Quick Run');
      terminal.show();
      terminal.sendText(this.data.customCommand);
    } else {
      vscode.window.showWarningMessage(`No command defined for "${this.data.label}"`);
    }
  }
}
