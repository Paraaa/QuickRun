import * as vscode from 'vscode';
import crypto from 'crypto';
import { QuickRunCommand } from './types';

export class CommandStore {
  private commands: QuickRunCommand[] = [];

  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  getAll(): QuickRunCommand[] {
    return this.commands;
  }

  add(data: QuickRunCommand): void {
    this.commands.push({ ...data, id: crypto.randomUUID() });
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
}
