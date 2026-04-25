import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ConfigLoader } from '../ConfigLoader';
import { QuickRunCommand, QuickRunGroup } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockContext = { subscriptions: [] as vscode.Disposable[] };

function overrideWorkspaceFolders(folders: readonly vscode.WorkspaceFolder[] | undefined): void {
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    get: () => folders,
  });
}

let savedWorkspaceFoldersDesc: PropertyDescriptor | undefined;

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'quickrun-test-'));
}

async function writeFakeConfig(dir: string, content: object | string): Promise<void> {
  const vscodeDir = path.join(dir, '.vscode');
  await fs.mkdir(vscodeDir, { recursive: true });
  const raw = typeof content === 'string' ? content : JSON.stringify(content);
  await fs.writeFile(path.join(vscodeDir, 'quickrun.json'), raw, 'utf-8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite('ConfigLoader', () => {
  let origGetConfiguration: typeof vscode.workspace.getConfiguration;
  let origCreateWatcher: typeof vscode.workspace.createFileSystemWatcher;
  let origShowError: typeof vscode.window.showErrorMessage;

  setup(() => {
    savedWorkspaceFoldersDesc = Object.getOwnPropertyDescriptor(
      vscode.workspace,
      'workspaceFolders',
    );
    origGetConfiguration = vscode.workspace.getConfiguration;
    origCreateWatcher = vscode.workspace.createFileSystemWatcher;
    origShowError = vscode.window.showErrorMessage;
  });

  teardown(() => {
    if (savedWorkspaceFoldersDesc) {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', savedWorkspaceFoldersDesc);
    }
    (vscode.workspace as any).getConfiguration = origGetConfiguration;
    (vscode.workspace as any).createFileSystemWatcher = origCreateWatcher;
    (vscode.window as any).showErrorMessage = origShowError;
  });

  // -------------------------------------------------------------------------
  suite('loadProject()', () => {
    test('returns empty when no workspace folder is open', async () => {
      overrideWorkspaceFolders(undefined);
      const loader = new ConfigLoader(mockContext as any);
      const result = await loader.loadProject();
      assert.deepStrictEqual(result, { commands: [], groups: [] });
    });

    test('returns empty when the config file does not exist', async () => {
      const dir = await makeTempDir();
      overrideWorkspaceFolders([{ uri: vscode.Uri.file(dir), name: 't', index: 0 }]);
      try {
        const loader = new ConfigLoader(mockContext as any);
        const result = await loader.loadProject();
        assert.deepStrictEqual(result, { commands: [], groups: [] });
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('returns empty when the config file contains malformed JSON', async () => {
      const dir = await makeTempDir();
      overrideWorkspaceFolders([{ uri: vscode.Uri.file(dir), name: 't', index: 0 }]);
      try {
        await writeFakeConfig(dir, 'not { valid json');
        const loader = new ConfigLoader(mockContext as any);
        const result = await loader.loadProject();
        assert.deepStrictEqual(result, { commands: [], groups: [] });
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('parses commands and tags them source=project', async () => {
      const dir = await makeTempDir();
      overrideWorkspaceFolders([{ uri: vscode.Uri.file(dir), name: 't', index: 0 }]);
      try {
        await writeFakeConfig(dir, {
          commands: [{ id: 'c1', label: 'Build', customCommand: 'npm run build' }],
          groups: [],
        });
        const loader = new ConfigLoader(mockContext as any);
        const result = await loader.loadProject();
        assert.strictEqual(result.commands.length, 1);
        assert.strictEqual(result.commands[0].id, 'c1');
        assert.strictEqual(result.commands[0].label, 'Build');
        assert.strictEqual(result.commands[0].source, 'project');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('parses groups and tags them source=project', async () => {
      const dir = await makeTempDir();
      overrideWorkspaceFolders([{ uri: vscode.Uri.file(dir), name: 't', index: 0 }]);
      try {
        await writeFakeConfig(dir, { commands: [], groups: [{ id: 'g1', label: 'Dev' }] });
        const loader = new ConfigLoader(mockContext as any);
        const result = await loader.loadProject();
        assert.strictEqual(result.groups.length, 1);
        assert.strictEqual(result.groups[0].id, 'g1');
        assert.strictEqual(result.groups[0].source, 'project');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('handles missing commands and groups keys in the file', async () => {
      const dir = await makeTempDir();
      overrideWorkspaceFolders([{ uri: vscode.Uri.file(dir), name: 't', index: 0 }]);
      try {
        await writeFakeConfig(dir, {});
        const loader = new ConfigLoader(mockContext as any);
        const result = await loader.loadProject();
        assert.deepStrictEqual(result, { commands: [], groups: [] });
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('preserves all optional command fields from disk', async () => {
      const dir = await makeTempDir();
      overrideWorkspaceFolders([{ uri: vscode.Uri.file(dir), name: 't', index: 0 }]);
      try {
        await writeFakeConfig(dir, {
          commands: [
            { id: 'c1', label: 'Test', customCommand: 'npm test', icon: 'beaker', groupId: 'g1' },
          ],
          groups: [],
        });
        const loader = new ConfigLoader(mockContext as any);
        const result = await loader.loadProject();
        assert.strictEqual(result.commands[0].icon, 'beaker');
        assert.strictEqual(result.commands[0].groupId, 'g1');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // -------------------------------------------------------------------------
  suite('loadGlobal()', () => {
    test('returns empty when global config is not set', () => {
      (vscode.workspace as any).getConfiguration = (_s: string) => ({
        get: (_k: string) => undefined,
      });
      const loader = new ConfigLoader(mockContext as any);
      const result = loader.loadGlobal();
      assert.deepStrictEqual(result, { commands: [], groups: [] });
    });

    test('returns empty when commands and groups arrays are empty', () => {
      (vscode.workspace as any).getConfiguration = (_s: string) => ({
        get: (_k: string) => ({ commands: [], groups: [] }),
      });
      const loader = new ConfigLoader(mockContext as any);
      const result = loader.loadGlobal();
      assert.deepStrictEqual(result, { commands: [], groups: [] });
    });

    test('parses commands and tags them source=global', () => {
      (vscode.workspace as any).getConfiguration = (_s: string) => ({
        get: (_k: string) => ({
          commands: [{ id: 'gc1', label: 'Deploy', customCommand: 'deploy.sh' }],
          groups: [],
        }),
      });
      const loader = new ConfigLoader(mockContext as any);
      const result = loader.loadGlobal();
      assert.strictEqual(result.commands.length, 1);
      assert.strictEqual(result.commands[0].source, 'global');
      assert.strictEqual(result.commands[0].id, 'gc1');
    });

    test('parses groups and tags them source=global', () => {
      (vscode.workspace as any).getConfiguration = (_s: string) => ({
        get: (_k: string) => ({
          commands: [],
          groups: [{ id: 'gg1', label: 'Deploy' }],
        }),
      });
      const loader = new ConfigLoader(mockContext as any);
      const result = loader.loadGlobal();
      assert.strictEqual(result.groups.length, 1);
      assert.strictEqual(result.groups[0].source, 'global');
    });
  });

  // -------------------------------------------------------------------------
  suite('saveProject()', () => {
    test('shows error and does not write when no workspace folder is open', async () => {
      overrideWorkspaceFolders(undefined);
      let errorShown = false;
      (vscode.window as any).showErrorMessage = () => {
        errorShown = true;
      };
      const loader = new ConfigLoader(mockContext as any);
      await loader.saveProject([], []);
      assert.ok(errorShown, 'Expected an error message when no workspace is open');
    });

    test('strips the source field from commands before writing', async () => {
      const dir = await makeTempDir();
      overrideWorkspaceFolders([{ uri: vscode.Uri.file(dir), name: 't', index: 0 }]);
      try {
        const loader = new ConfigLoader(mockContext as any);
        const cmd: QuickRunCommand = {
          id: 'c1',
          label: 'T',
          customCommand: 'echo',
          source: 'project',
        };
        await loader.saveProject([cmd], []);
        const raw = await fs.readFile(
          path.join(dir, '.vscode', 'quickrun.json'),
          'utf-8',
        );
        const parsed = JSON.parse(raw);
        assert.strictEqual(parsed.commands[0].source, undefined);
        assert.strictEqual(parsed.commands[0].id, 'c1');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('strips the source field from groups before writing', async () => {
      const dir = await makeTempDir();
      overrideWorkspaceFolders([{ uri: vscode.Uri.file(dir), name: 't', index: 0 }]);
      try {
        const loader = new ConfigLoader(mockContext as any);
        const grp: QuickRunGroup = { id: 'g1', label: 'G', source: 'project' };
        await loader.saveProject([], [grp]);
        const raw = await fs.readFile(
          path.join(dir, '.vscode', 'quickrun.json'),
          'utf-8',
        );
        const parsed = JSON.parse(raw);
        assert.strictEqual(parsed.groups[0].source, undefined);
        assert.strictEqual(parsed.groups[0].id, 'g1');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('creates the .vscode directory if it does not exist', async () => {
      const dir = await makeTempDir();
      overrideWorkspaceFolders([{ uri: vscode.Uri.file(dir), name: 't', index: 0 }]);
      try {
        const loader = new ConfigLoader(mockContext as any);
        await loader.saveProject([], []);
        const stat = await fs.stat(path.join(dir, '.vscode'));
        assert.ok(stat.isDirectory());
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    test('writes valid JSON to disk', async () => {
      const dir = await makeTempDir();
      overrideWorkspaceFolders([{ uri: vscode.Uri.file(dir), name: 't', index: 0 }]);
      try {
        const loader = new ConfigLoader(mockContext as any);
        await loader.saveProject([], []);
        const raw = await fs.readFile(
          path.join(dir, '.vscode', 'quickrun.json'),
          'utf-8',
        );
        assert.doesNotThrow(() => JSON.parse(raw));
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  // -------------------------------------------------------------------------
  suite('saveGlobal()', () => {
    test('strips the source field from commands before updating settings', async () => {
      let updatedValue: any;
      (vscode.workspace as any).getConfiguration = (_s: string) => ({
        update: async (_k: string, value: any) => {
          updatedValue = value;
        },
      });
      const loader = new ConfigLoader(mockContext as any);
      const cmd: QuickRunCommand = {
        id: 'gc1',
        label: 'G',
        customCommand: 'echo',
        source: 'global',
      };
      await loader.saveGlobal([cmd], []);
      assert.strictEqual(updatedValue.commands[0].source, undefined);
      assert.strictEqual(updatedValue.commands[0].id, 'gc1');
    });

    test('strips the source field from groups before updating settings', async () => {
      let updatedValue: any;
      (vscode.workspace as any).getConfiguration = (_s: string) => ({
        update: async (_k: string, value: any) => {
          updatedValue = value;
        },
      });
      const loader = new ConfigLoader(mockContext as any);
      const grp: QuickRunGroup = { id: 'gg1', label: 'G', source: 'global' };
      await loader.saveGlobal([], [grp]);
      assert.strictEqual(updatedValue.groups[0].source, undefined);
    });

    test('uses ConfigurationTarget.Global as the target', async () => {
      let savedTarget: vscode.ConfigurationTarget | undefined;
      (vscode.workspace as any).getConfiguration = (_s: string) => ({
        update: async (_k: string, _v: any, target: vscode.ConfigurationTarget) => {
          savedTarget = target;
        },
      });
      const loader = new ConfigLoader(mockContext as any);
      await loader.saveGlobal([], []);
      assert.strictEqual(savedTarget, vscode.ConfigurationTarget.Global);
    });

    test('saves to the "global" key in the quickrun configuration', async () => {
      let savedKey: string | undefined;
      (vscode.workspace as any).getConfiguration = (_s: string) => ({
        update: async (k: string) => {
          savedKey = k;
        },
      });
      const loader = new ConfigLoader(mockContext as any);
      await loader.saveGlobal([], []);
      assert.strictEqual(savedKey, 'global');
    });
  });

  // -------------------------------------------------------------------------
  suite('watchProject()', () => {
    test('does not create a watcher when no workspace folder is open', () => {
      overrideWorkspaceFolders(undefined);
      let watcherCreated = false;
      (vscode.workspace as any).createFileSystemWatcher = () => {
        watcherCreated = true;
        return {
          onDidChange: () => {},
          onDidCreate: () => {},
          onDidDelete: () => {},
          dispose: () => {},
        };
      };
      const loader = new ConfigLoader(mockContext as any);
      loader.watchProject();
      assert.ok(!watcherCreated);
    });

    test('creates a file system watcher when a workspace folder is open', () => {
      overrideWorkspaceFolders([{ uri: vscode.Uri.file('/fake/ws'), name: 'fake', index: 0 }]);
      let watcherCreated = false;
      (vscode.workspace as any).createFileSystemWatcher = () => {
        watcherCreated = true;
        return {
          onDidChange: () => ({ dispose: () => {} }),
          onDidCreate: () => ({ dispose: () => {} }),
          onDidDelete: () => ({ dispose: () => {} }),
          dispose: () => {},
        };
      };
      const loader = new ConfigLoader(mockContext as any);
      loader.watchProject();
      assert.ok(watcherCreated);
    });

    test('fires onDidExternalChange when the watched file changes', () => {
      overrideWorkspaceFolders([{ uri: vscode.Uri.file('/fake/ws'), name: 'fake', index: 0 }]);
      let onChangeCb: (() => void) | undefined;
      (vscode.workspace as any).createFileSystemWatcher = () => ({
        onDidChange: (cb: () => void) => {
          onChangeCb = cb;
          return { dispose: () => {} };
        },
        onDidCreate: () => ({ dispose: () => {} }),
        onDidDelete: () => ({ dispose: () => {} }),
        dispose: () => {},
      });
      const loader = new ConfigLoader(mockContext as any);
      loader.watchProject();
      let fired = false;
      loader.onDidExternalChange(() => (fired = true));
      onChangeCb!();
      assert.ok(fired);
    });

    test('fires onDidExternalChange when the watched file is created', () => {
      overrideWorkspaceFolders([{ uri: vscode.Uri.file('/fake/ws'), name: 'fake', index: 0 }]);
      let onCreateCb: (() => void) | undefined;
      (vscode.workspace as any).createFileSystemWatcher = () => ({
        onDidChange: () => ({ dispose: () => {} }),
        onDidCreate: (cb: () => void) => {
          onCreateCb = cb;
          return { dispose: () => {} };
        },
        onDidDelete: () => ({ dispose: () => {} }),
        dispose: () => {},
      });
      const loader = new ConfigLoader(mockContext as any);
      loader.watchProject();
      let fired = false;
      loader.onDidExternalChange(() => (fired = true));
      onCreateCb!();
      assert.ok(fired);
    });

    test('fires onDidExternalChange when the watched file is deleted', () => {
      overrideWorkspaceFolders([{ uri: vscode.Uri.file('/fake/ws'), name: 'fake', index: 0 }]);
      let onDeleteCb: (() => void) | undefined;
      (vscode.workspace as any).createFileSystemWatcher = () => ({
        onDidChange: () => ({ dispose: () => {} }),
        onDidCreate: () => ({ dispose: () => {} }),
        onDidDelete: (cb: () => void) => {
          onDeleteCb = cb;
          return { dispose: () => {} };
        },
        dispose: () => {},
      });
      const loader = new ConfigLoader(mockContext as any);
      loader.watchProject();
      let fired = false;
      loader.onDidExternalChange(() => (fired = true));
      onDeleteCb!();
      assert.ok(fired);
    });

    test('suppresses onDidExternalChange while saveProject is in progress', async () => {
      const dir = await makeTempDir();
      overrideWorkspaceFolders([{ uri: vscode.Uri.file(dir), name: 't', index: 0 }]);
      let onChangeCb: (() => void) | undefined;
      (vscode.workspace as any).createFileSystemWatcher = () => ({
        onDidChange: (cb: () => void) => {
          onChangeCb = cb;
          return { dispose: () => {} };
        },
        onDidCreate: () => ({ dispose: () => {} }),
        onDidDelete: () => ({ dispose: () => {} }),
        dispose: () => {},
      });
      try {
        const loader = new ConfigLoader(mockContext as any);
        loader.watchProject();
        let fired = false;
        loader.onDidExternalChange(() => (fired = true));
        const savePromise = loader.saveProject([], []);
        onChangeCb!();
        await savePromise;
        assert.ok(!fired, 'onDidExternalChange must be suppressed while saving');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });
});
