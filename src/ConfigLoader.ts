import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { QuickRunCommand, QuickRunGroup, QuickRunConfig, ConfigScope } from './types';

interface LoadedData {
  commands: QuickRunCommand[];
  groups: QuickRunGroup[];
}

export class ConfigLoader {
  private _onDidExternalChange = new vscode.EventEmitter<void>();
  readonly onDidExternalChange = this._onDidExternalChange.event;

  private _saving = false;
  private watcher: vscode.FileSystemWatcher | undefined;
  private projectConfigPath: string | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      this.projectConfigPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'quickrun.json');
    }
  }

  async loadProject(): Promise<LoadedData> {
    if (!this.projectConfigPath) {
      return { commands: [], groups: [] };
    }
    try {
      const raw = await fs.readFile(this.projectConfigPath, 'utf-8');
      const config: QuickRunConfig = JSON.parse(raw);
      return {
        commands: (config.commands ?? []).map((c) => ({ ...c, source: 'project' as ConfigScope })),
        groups: (config.groups ?? []).map((g) => ({ ...g, source: 'project' as ConfigScope })),
      };
    } catch {
      return { commands: [], groups: [] };
    }
  }

  async saveProject(commands: QuickRunCommand[], groups: QuickRunGroup[]): Promise<void> {
    if (!this.projectConfigPath) {
      vscode.window.showErrorMessage('No workspace folder open. Cannot save project-level config.');
      return;
    }
    this._saving = true;
    setTimeout(() => {
      this._saving = false;
    }, 500);

    const config: QuickRunConfig = {
      commands: commands.map(({ source: _s, ...rest }) => rest),
      groups: groups.map(({ source: _s, ...rest }) => rest),
    };

    const dir = path.dirname(this.projectConfigPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.projectConfigPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  loadGlobal(): LoadedData {
    const cfg = vscode.workspace.getConfiguration('quickrun');
    const stored = cfg.get<QuickRunConfig>('global') ?? { commands: [], groups: [] };
    return {
      commands: (stored.commands ?? []).map((c) => ({ ...c, source: 'global' as ConfigScope })),
      groups: (stored.groups ?? []).map((g) => ({ ...g, source: 'global' as ConfigScope })),
    };
  }

  async saveGlobal(commands: QuickRunCommand[], groups: QuickRunGroup[]): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('quickrun');
    const config: QuickRunConfig = {
      commands: commands.map(({ source: _s, ...rest }) => rest),
      groups: groups.map(({ source: _s, ...rest }) => rest),
    };
    await cfg.update('global', config, vscode.ConfigurationTarget.Global);
  }

  watchProject(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || !this.projectConfigPath) {
      return;
    }
    const pattern = new vscode.RelativePattern(workspaceFolders[0], '.vscode/quickrun.json');
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const notify = () => {
      if (!this._saving) {
        this._onDidExternalChange.fire();
      }
    };
    this.watcher.onDidChange(notify);
    this.watcher.onDidCreate(notify);
    this.watcher.onDidDelete(notify);

    this.context.subscriptions.push(this.watcher);
  }

  dispose(): void {
    this.watcher?.dispose();
    this._onDidExternalChange.dispose();
  }
}
