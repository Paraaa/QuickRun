import * as vscode from 'vscode';
import crypto from 'crypto';
import { QuickRunCommand, QuickRunGroup, ConfigScope } from './types';
import { ConfigLoader } from './ConfigLoader';

export class CommandStore {
  private projectCommands: QuickRunCommand[] = [];
  private globalCommands: QuickRunCommand[] = [];
  private projectGroups: QuickRunGroup[] = [];
  private globalGroups: QuickRunGroup[] = [];

  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private _externalChangeSub: vscode.Disposable | undefined;

  constructor(private readonly configLoader: ConfigLoader) {}

  async load(): Promise<void> {
    const [project, global] = await Promise.all([
      this.configLoader.loadProject(),
      Promise.resolve(this.configLoader.loadGlobal()),
    ]);
    this.projectCommands = project.commands;
    this.projectGroups = project.groups;
    this.globalCommands = global.commands;
    this.globalGroups = global.groups;

    this._externalChangeSub?.dispose();
    this._externalChangeSub = this.configLoader.onDidExternalChange(async () => {
      const reloaded = await this.configLoader.loadProject();
      this.projectCommands = reloaded.commands;
      this.projectGroups = reloaded.groups;
      this._onDidChange.fire();
    });

    this._onDidChange.fire();
  }

  getAll(): QuickRunCommand[] {
    return [...this.projectCommands, ...this.globalCommands];
  }

  getGroups(): QuickRunGroup[] {
    return [...this.projectGroups, ...this.globalGroups];
  }

  async add(data: QuickRunCommand): Promise<void> {
    const command: QuickRunCommand = { ...data, id: crypto.randomUUID() };
    if (command.source === 'global') {
      this.globalCommands.push(command);
    } else {
      this.projectCommands.push(command);
    }
    await this._persist(command.source);
    this._onDidChange.fire();
  }

  async edit(id: string | undefined, data: QuickRunCommand): Promise<void> {
    if (!id) {
      vscode.window.showErrorMessage('Command ID is missing. Cannot edit command.');
      return;
    }
    const scope = data.source;
    const bucket = scope === 'global' ? this.globalCommands : this.projectCommands;
    const index = bucket.findIndex((c) => c.id === id);
    if (index !== -1) {
      bucket[index] = { ...data, id };
      await this._persist(scope);
      this._onDidChange.fire();
    }
  }

  async delete(data: QuickRunCommand): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete "${data.label}"?`,
      { modal: true },
      'Delete',
    );
    if (confirm !== 'Delete') {
      return;
    }
    const scope = data.source;
    if (scope === 'global') {
      this.globalCommands = this.globalCommands.filter((c) => c.id !== data.id);
    } else {
      this.projectCommands = this.projectCommands.filter((c) => c.id !== data.id);
    }
    await this._persist(scope);
    this._onDidChange.fire();
  }

  async addGroup(data: QuickRunGroup): Promise<void> {
    const group: QuickRunGroup = { ...data, id: data.id ?? crypto.randomUUID() };
    if (group.source === 'global') {
      this.globalGroups.push(group);
    } else {
      this.projectGroups.push(group);
    }
    await this._persist(group.source);
    this._onDidChange.fire();
  }

  async deleteGroup(group: QuickRunGroup): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete the group "${group.label}"? This will also delete all commands in this group.`,
      { modal: true },
      'Delete',
    );
    if (confirm !== 'Delete') {
      return;
    }
    const scope = group.source;
    if (scope === 'global') {
      this.globalGroups = this.globalGroups.filter((g) => g.id !== group.id);
      this.globalCommands = this.globalCommands.filter((c) => c.groupId !== group.id);
    } else {
      this.projectGroups = this.projectGroups.filter((g) => g.id !== group.id);
      this.projectCommands = this.projectCommands.filter((c) => c.groupId !== group.id);
    }
    await this._persist(scope);
    this._onDidChange.fire();
  }

  private async _persist(scope: ConfigScope): Promise<void> {
    if (scope === 'global') {
      await this.configLoader.saveGlobal(this.globalCommands, this.globalGroups);
    } else {
      await this.configLoader.saveProject(this.projectCommands, this.projectGroups);
    }
  }
}
