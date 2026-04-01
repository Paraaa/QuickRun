import * as vscode from 'vscode';
import { CommandStore } from './CommandStore';
import { CommandItem, onDidChangeTerminalState } from './CommandItem';
import { GroupItem } from './GroupItem';

export class CommandsProvider implements vscode.TreeDataProvider<CommandItem | GroupItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CommandItem | GroupItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly commandStore: CommandStore) {
    commandStore.onDidChange(() => this.refresh());
    onDidChangeTerminalState(() => this.refresh());
  }

  getTreeItem(element: CommandItem | GroupItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GroupItem | CommandItem): (GroupItem | CommandItem)[] {
    if (!element) {
      // root — return all groups and commands without a groupId
      const groups = this.commandStore.getGroups().map((group) => new GroupItem(group));
      const rootCommands = this.commandStore
        .getAll()
        .filter((commandItem) => !commandItem.groupId)
        .map((commandItem) => new CommandItem(commandItem));
      return [...rootCommands, ...groups];
    }
    if (element instanceof GroupItem) {
      // return commands belonging to this group
      return this.commandStore
        .getAll()
        .filter((commandItem) => commandItem.groupId === element.data.id)
        .map((commandItem) => new CommandItem(commandItem));
    }
    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
