import * as vscode from 'vscode';
import crypto from 'crypto';
import { QuickRunCommand, QuickRunGroup } from './types';

export class CommandStore {
  private commands: QuickRunCommand[] = [];
  private groups: QuickRunGroup[] = [];

  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  getAll(): QuickRunCommand[] {
    return this.commands;
  }

  add(data: QuickRunCommand): void {
    const command = { ...data, id: crypto.randomUUID() };
    this.commands.push(command);
    this._onDidChange.fire();
  }

  edit(id: string | undefined, data: QuickRunCommand): void {
    if (!id) {
      vscode.window.showErrorMessage('Command ID is missing. Cannot edit command.');
      return;
    }

    const index = this.commands.findIndex((commandItem) => commandItem.id === id);
    if (index !== -1) {
      // Preserve the original id while updating the rest of the data
      this.commands[index] = { ...data, id };
      this._onDidChange.fire();
    }
  }

  async delete(data: QuickRunCommand): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete "${data.label}"?`,
      { modal: true },
      'Delete',
    );
    if (confirm === 'Delete') {
      this.commands = this.commands.filter((commandItem) => commandItem.id !== data.id);
      this._onDidChange.fire();
    }
  }

  getGroups(): QuickRunGroup[] {
    return this.groups;
  }

  addGroup(data: QuickRunGroup): void {
    const group = { ...data, id: data.id || data.label };
    this.groups.push(group);
    this._onDidChange.fire();
  }

  async deleteGroup(group: QuickRunGroup): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete the group "${group.label}"? This will also delete all commands in this group.`,
      { modal: true },
      'Delete',
    );

    if (confirm === 'Delete') {
      this.groups = this.groups.filter((g) => g.id !== group.id);
      // delete all commands belonging to this group too
      this.commands = this.commands.filter((cmd) => cmd.groupId !== group.id);
      this._onDidChange.fire();
    }
  }
}
