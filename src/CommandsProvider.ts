import * as vscode from 'vscode';

export class CommandItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly command?: vscode.Command,
    public readonly collapsibleState = vscode.TreeItemCollapsibleState.None,
  ) {
    super(label, collapsibleState);
  }

  execute(): void {
    if (this.command) {
      const terminal = vscode.window.activeTerminal ?? vscode.window.createTerminal('Quick Run');
      terminal.show();
      terminal.sendText(this.command?.arguments?.[0] ?? '');
    } else {
      vscode.window.showWarningMessage(`No command defined for "${this.label}"`);
    }
  }

  edit(): void {
    vscode.window.showInformationMessage(`Edit "${this.label}" — coming soon!`);
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
      arguments: ['python manage.py runserver'],
    }),
    new CommandItem('Migrate', {
      title: 'Migrate',
      command: 'quickrun.executeCommand',
      arguments: ['python manage.py migrate'],
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

  addCommand(): void {
    vscode.window.showInformationMessage('Add command — coming soon!');
  }

  async deleteCommand(commandItem: CommandItem): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete "${commandItem.label}"?`,
      { modal: true },
      'Delete',
    );
    if (confirm === 'Delete') {
      this.items = this.items.filter((item) => item !== commandItem);
      this.refresh();
    }
  }
}
