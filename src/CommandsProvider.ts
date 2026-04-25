import * as vscode from 'vscode';
import { CommandStore } from './CommandStore';
import { CommandItem, onDidChangeTerminalState } from './CommandItem';
import { GroupItem } from './GroupItem';

const MIME = 'application/vnd.quickrun.commanditem';

export class CommandsProvider
  implements
    vscode.TreeDataProvider<CommandItem | GroupItem>,
    vscode.TreeDragAndDropController<CommandItem | GroupItem>
{
  readonly dropMimeTypes = [MIME];
  readonly dragMimeTypes = [MIME];

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

  getParent(element: CommandItem | GroupItem): GroupItem | undefined {
    if (element instanceof CommandItem && element.data.groupId) {
      const group = this.commandStore.getGroups().find((g) => g.id === element.data.groupId);
      return group ? new GroupItem(group) : undefined;
    }
    return undefined;
  }

  handleDrag(
    source: readonly (CommandItem | GroupItem)[],
    dataTransfer: vscode.DataTransfer,
  ): void {
    const commands = source.filter((item): item is CommandItem => item instanceof CommandItem);
    if (commands.length === 0) {
      return;
    }
    dataTransfer.set(MIME, new vscode.DataTransferItem(commands.map((c) => c.data.id)));
  }

  async handleDrop(
    target: CommandItem | GroupItem | undefined,
    dataTransfer: vscode.DataTransfer,
  ): Promise<void> {
    const item = dataTransfer.get(MIME);
    if (!item) {
      return;
    }

    const ids: string[] = await item.asString().then((s) => JSON.parse(s));
    const allCommands = this.commandStore.getAll();

    let targetGroupId: string | undefined;
    let targetScope: 'project' | 'global';

    if (target instanceof GroupItem) {
      targetGroupId = target.data.id;
      targetScope = target.data.source;
    } else if (target instanceof CommandItem) {
      targetGroupId = target.data.groupId;
      targetScope = target.data.source;
    } else {
      // Dropped on root — remove from group
      const firstCmd = allCommands.find((c) => ids.includes(c.id ?? ''));
      targetScope = firstCmd?.source ?? 'project';
      targetGroupId = undefined;
    }

    for (const id of ids) {
      const cmd = allCommands.find((c) => c.id === id);
      if (!cmd) {
        continue;
      }
      if (cmd.source !== targetScope) {
        vscode.window.showWarningMessage(
          `Cannot move "${cmd.label}" — project and global commands cannot be mixed into the same group.`,
        );
        continue;
      }
      await this.commandStore.edit(id, { ...cmd, groupId: targetGroupId });
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
