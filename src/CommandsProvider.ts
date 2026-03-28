import * as vscode from 'vscode';

export class CommandItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly command?: vscode.Command,
    public readonly collapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    this.iconPath = new vscode.ThemeIcon('run');
  }
}

export class CommandsProvider implements vscode.TreeDataProvider<CommandItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CommandItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Hardcoded for now — replace with config loading later
  private items: CommandItem[] = [
    new CommandItem('Run server', {
      title: 'Run server',
      command: 'quickrun.executeCommand',
      arguments: ['python manage.py runserver']
    }),
    new CommandItem('Migrate', {
      title: 'Migrate',
      command: 'quickrun.executeCommand',
      arguments: ['python manage.py migrate']
    }),
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
}