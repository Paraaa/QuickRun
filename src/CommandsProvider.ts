import * as vscode from 'vscode';
import { QuickRunCommand } from './types';
import { CommandStore } from './CommandStore';
import { CommandItem } from './CommandItem';

export class CommandsProvider implements vscode.TreeDataProvider<CommandItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CommandItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly commandStore: CommandStore) {
    commandStore.onDidChange(() => this.refresh());
  }

  getTreeItem(element: CommandItem): vscode.TreeItem {
    return element;
  }

  getChildren(): CommandItem[] {
    return this.commandStore.getAll().map((cmd) => new CommandItem(cmd));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
