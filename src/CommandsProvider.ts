import * as vscode from 'vscode';
import { QuickRunCommand } from './types';

export class CommandItem extends vscode.TreeItem {
  constructor(public readonly data: QuickRunCommand) {
    super(data.label, vscode.TreeItemCollapsibleState.None);
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

  edit(): void {
    vscode.window.showInformationMessage(`Edit "${this.data.label}" — coming soon!`);
  }
}

export class CommandsProvider implements vscode.TreeDataProvider<CommandItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CommandItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // TODO:: Hardcoded for now — replace with config loading later
  private items: CommandItem[] = [
    new CommandItem({ label: 'Run server', customCommand: 'python manage.py runserver' }),
    new CommandItem({ label: 'Migrate', customCommand: 'python manage.py migrate' }),
  ];

  getTreeItem(element: CommandItem): vscode.TreeItem {
    return element;
  }

  getChildren(): CommandItem[] {
    return this.items;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  addCommand(data: QuickRunCommand): void {
    this.items.push(new CommandItem(data));
    this.refresh();
  }

  async deleteCommand(commandItem: CommandItem): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete "${commandItem.data.label}"?`,
      { modal: true },
      'Delete',
    );
    if (confirm === 'Delete') {
      this.items = this.items.filter((item) => item !== commandItem);
      this.refresh();
    }
  }
}
