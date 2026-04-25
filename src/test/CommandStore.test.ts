import * as assert from 'assert';
import * as vscode from 'vscode';
import { CommandStore } from '../CommandStore';
import { QuickRunCommand, QuickRunGroup } from '../types';

// ---------------------------------------------------------------------------
// Mock ConfigLoader
// ---------------------------------------------------------------------------

class MockLoader {
  private _emitter = new vscode.EventEmitter<void>();
  readonly onDidExternalChange = this._emitter.event;

  projectCommands: QuickRunCommand[] = [];
  projectGroups: QuickRunGroup[] = [];
  globalCommands: QuickRunCommand[] = [];
  globalGroups: QuickRunGroup[] = [];

  savedProject: { commands: QuickRunCommand[]; groups: QuickRunGroup[] } | null = null;
  savedGlobal: { commands: QuickRunCommand[]; groups: QuickRunGroup[] } | null = null;

  async loadProject() {
    return { commands: [...this.projectCommands], groups: [...this.projectGroups] };
  }
  loadGlobal() {
    return { commands: [...this.globalCommands], groups: [...this.globalGroups] };
  }
  async saveProject(commands: QuickRunCommand[], groups: QuickRunGroup[]) {
    this.savedProject = { commands: [...commands], groups: [...groups] };
  }
  async saveGlobal(commands: QuickRunCommand[], groups: QuickRunGroup[]) {
    this.savedGlobal = { commands: [...commands], groups: [...groups] };
  }
  fireExternalChange() {
    this._emitter.fire();
  }
  watchProject() {}
  dispose() {
    this._emitter.dispose();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCmd = (overrides: Partial<QuickRunCommand> = {}): QuickRunCommand => ({
  id: 'test-id',
  label: 'Test',
  customCommand: 'echo test',
  source: 'project',
  ...overrides,
});

const makeGroup = (overrides: Partial<QuickRunGroup> = {}): QuickRunGroup => ({
  id: 'grp-id',
  label: 'Group',
  source: 'project',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite('CommandStore', () => {
  let loader: MockLoader;
  let store: CommandStore;
  let origWarn: typeof vscode.window.showWarningMessage;
  let origError: typeof vscode.window.showErrorMessage;
  let warnResult: string | undefined;

  setup(() => {
    loader = new MockLoader();
    store = new CommandStore(loader as unknown as any);
    origWarn = vscode.window.showWarningMessage;
    origError = vscode.window.showErrorMessage;
    warnResult = 'Delete';
    (vscode.window as any).showWarningMessage = (..._a: any[]) => Promise.resolve(warnResult);
    (vscode.window as any).showErrorMessage = (..._a: any[]) => {};
  });

  teardown(() => {
    (vscode.window as any).showWarningMessage = origWarn;
    (vscode.window as any).showErrorMessage = origError;
  });

  // -------------------------------------------------------------------------
  suite('load()', () => {
    test('populates project commands', async () => {
      loader.projectCommands = [makeCmd({ id: 'p1', label: 'Proj' })];
      await store.load();
      assert.strictEqual(store.getAll().length, 1);
      assert.strictEqual(store.getAll()[0].label, 'Proj');
    });

    test('populates global commands', async () => {
      loader.globalCommands = [makeCmd({ id: 'g1', source: 'global' })];
      await store.load();
      assert.strictEqual(store.getAll().length, 1);
      assert.strictEqual(store.getAll()[0].source, 'global');
    });

    test('populates project and global groups', async () => {
      loader.projectGroups = [makeGroup({ id: 'pg1', label: 'PG' })];
      loader.globalGroups = [makeGroup({ id: 'gg1', label: 'GG', source: 'global' })];
      await store.load();
      assert.strictEqual(store.getGroups().length, 2);
    });

    test('fires onDidChange after loading', async () => {
      let fired = false;
      store.onDidChange(() => (fired = true));
      await store.load();
      assert.ok(fired);
    });

    test('reloads project data when external change fires', async () => {
      await store.load();
      loader.projectCommands = [makeCmd({ id: 'p1', label: 'Reloaded' })];
      loader.fireExternalChange();
      await new Promise((r) => setTimeout(r, 20));
      assert.strictEqual(store.getAll()[0].label, 'Reloaded');
    });

    test('external change fires onDidChange', async () => {
      await store.load();
      let changeCount = 0;
      store.onDidChange(() => changeCount++);
      loader.fireExternalChange();
      await new Promise((r) => setTimeout(r, 20));
      assert.strictEqual(changeCount, 1);
    });

    test('calling load() twice does not accumulate external-change handlers', async () => {
      // Bug fix regression: each load() call must dispose the previous subscription
      // so only one reload fires per external change, not one per load() invocation.
      await store.load();
      await store.load();
      let changeCount = 0;
      store.onDidChange(() => changeCount++);
      loader.projectCommands = [makeCmd({ id: 'p1', label: 'New' })];
      loader.fireExternalChange();
      await new Promise((r) => setTimeout(r, 20));
      assert.strictEqual(changeCount, 1, 'Expected exactly one onDidChange after a single external event');
    });

    test('external change does not reload global commands', async () => {
      loader.globalCommands = [makeCmd({ id: 'g1', label: 'GlobalCmd', source: 'global' })];
      await store.load();
      loader.globalCommands = [makeCmd({ id: 'g1', label: 'Changed', source: 'global' })];
      loader.fireExternalChange();
      await new Promise((r) => setTimeout(r, 20));
      // Global data is NOT reloaded on external project-file change
      assert.strictEqual(
        store.getAll().find((c) => c.source === 'global')?.label,
        'GlobalCmd',
      );
    });
  });

  // -------------------------------------------------------------------------
  suite('getAll()', () => {
    test('returns empty array before load', () => {
      assert.deepStrictEqual(store.getAll(), []);
    });

    test('returns project commands before global commands', async () => {
      loader.projectCommands = [makeCmd({ id: 'p1', label: 'Proj' })];
      loader.globalCommands = [makeCmd({ id: 'g1', label: 'Global', source: 'global' })];
      await store.load();
      const all = store.getAll();
      assert.strictEqual(all[0].label, 'Proj');
      assert.strictEqual(all[1].label, 'Global');
    });

    test('returns a copy — mutating result does not affect store state', async () => {
      loader.projectCommands = [makeCmd({ id: 'p1' })];
      await store.load();
      store.getAll().splice(0, 1);
      assert.strictEqual(store.getAll().length, 1);
    });
  });

  // -------------------------------------------------------------------------
  suite('getGroups()', () => {
    test('returns empty array before load', () => {
      assert.deepStrictEqual(store.getGroups(), []);
    });

    test('returns project groups before global groups', async () => {
      loader.projectGroups = [makeGroup({ id: 'pg1', label: 'ProjGrp' })];
      loader.globalGroups = [makeGroup({ id: 'gg1', label: 'GlobalGrp', source: 'global' })];
      await store.load();
      const groups = store.getGroups();
      assert.strictEqual(groups[0].label, 'ProjGrp');
      assert.strictEqual(groups[1].label, 'GlobalGrp');
    });

    test('returns a copy — mutating result does not affect store state', async () => {
      loader.projectGroups = [makeGroup({ id: 'g1' })];
      await store.load();
      store.getGroups().splice(0, 1);
      assert.strictEqual(store.getGroups().length, 1);
    });
  });

  // -------------------------------------------------------------------------
  suite('add()', () => {
    test('adds a project command to the project bucket', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'New', source: 'project' }));
      const all = store.getAll();
      assert.strictEqual(all.length, 1);
      assert.strictEqual(all[0].source, 'project');
    });

    test('adds a global command to the global bucket', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'New', source: 'global' }));
      const all = store.getAll();
      assert.strictEqual(all.length, 1);
      assert.strictEqual(all[0].source, 'global');
    });

    test('always assigns a new UUID, overriding any provided id', async () => {
      await store.load();
      await store.add(makeCmd({ id: 'provided-id', source: 'project' }));
      const added = store.getAll()[0];
      assert.notStrictEqual(added.id, 'provided-id', 'add() must generate a fresh UUID');
      assert.ok(added.id && added.id.length > 0);
    });

    test('persists to project via saveProject', async () => {
      await store.load();
      await store.add(makeCmd({ source: 'project' }));
      assert.ok(loader.savedProject !== null);
      assert.strictEqual(loader.savedGlobal, null);
    });

    test('persists to global via saveGlobal', async () => {
      await store.load();
      await store.add(makeCmd({ source: 'global' }));
      assert.ok(loader.savedGlobal !== null);
      assert.strictEqual(loader.savedProject, null);
    });

    test('fires onDidChange', async () => {
      await store.load();
      let fired = false;
      store.onDidChange(() => (fired = true));
      await store.add(makeCmd({ source: 'project' }));
      assert.ok(fired);
    });

    test('accumulates multiple commands in the same scope', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'A', source: 'project' }));
      await store.add(makeCmd({ label: 'B', source: 'project' }));
      assert.strictEqual(store.getAll().length, 2);
      assert.strictEqual(loader.savedProject!.commands.length, 2);
    });

    test('project and global commands coexist independently', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'Proj', source: 'project' }));
      await store.add(makeCmd({ label: 'Glob', source: 'global' }));
      assert.strictEqual(store.getAll().length, 2);
      assert.strictEqual(loader.savedProject!.commands.length, 1);
      assert.strictEqual(loader.savedGlobal!.commands.length, 1);
    });
  });

  // -------------------------------------------------------------------------
  suite('edit()', () => {
    test('updates label of a project command', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'Old', source: 'project' }));
      const id = store.getAll()[0].id!;
      await store.edit(id, makeCmd({ id, label: 'Updated', source: 'project' }));
      assert.strictEqual(store.getAll()[0].label, 'Updated');
    });

    test('updates a global command', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'Old', source: 'global' }));
      const id = store.getAll()[0].id!;
      await store.edit(id, makeCmd({ id, label: 'Updated', source: 'global' }));
      assert.strictEqual(store.getAll()[0].label, 'Updated');
    });

    test('always preserves the original id', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'A', source: 'project' }));
      const id = store.getAll()[0].id!;
      await store.edit(id, makeCmd({ id: 'should-be-ignored', label: 'B', source: 'project' }));
      assert.strictEqual(store.getAll()[0].id, id);
    });

    test('shows error message when id is undefined', async () => {
      let errorShown = false;
      (vscode.window as any).showErrorMessage = () => {
        errorShown = true;
      };
      await store.load();
      await store.edit(undefined, makeCmd());
      assert.ok(errorShown);
    });

    test('does not modify state when id is undefined', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'Unchanged', source: 'project' }));
      await store.edit(undefined, makeCmd({ label: 'Changed' }));
      assert.strictEqual(store.getAll()[0].label, 'Unchanged');
    });

    test('silently does nothing when id is not found in the expected bucket', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'Original', source: 'project' }));
      await store.edit('non-existent-id', makeCmd({ label: 'Changed', source: 'project' }));
      assert.strictEqual(store.getAll()[0].label, 'Original');
    });

    test('does not fire onDidChange when id is not found', async () => {
      await store.load();
      let fired = false;
      store.onDidChange(() => (fired = true));
      await store.edit('not-found', makeCmd({ source: 'project' }));
      assert.ok(!fired);
    });

    test('silently does nothing when id exists in a different scope bucket', async () => {
      // A project command's id passed as if it were global — edit looks in wrong bucket.
      await store.load();
      await store.add(makeCmd({ label: 'ProjCmd', source: 'project' }));
      const id = store.getAll()[0].id!;
      await store.edit(id, makeCmd({ id, label: 'Changed', source: 'global' }));
      assert.strictEqual(store.getAll()[0].label, 'ProjCmd', 'Cross-scope edit must not modify the command');
    });

    test('persists after a successful edit', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'A', source: 'project' }));
      loader.savedProject = null;
      const id = store.getAll()[0].id!;
      await store.edit(id, makeCmd({ id, label: 'B', source: 'project' }));
      assert.ok(loader.savedProject !== null);
    });

    test('fires onDidChange after a successful edit', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'A', source: 'project' }));
      let fired = false;
      store.onDidChange(() => (fired = true));
      const id = store.getAll()[0].id!;
      await store.edit(id, makeCmd({ id, label: 'B', source: 'project' }));
      assert.ok(fired);
    });
  });

  // -------------------------------------------------------------------------
  suite('delete()', () => {
    test('removes a project command when confirmed', async () => {
      await store.load();
      await store.add(makeCmd({ source: 'project' }));
      warnResult = 'Delete';
      await store.delete(store.getAll()[0]);
      assert.strictEqual(store.getAll().length, 0);
    });

    test('removes a global command when confirmed', async () => {
      await store.load();
      await store.add(makeCmd({ source: 'global' }));
      warnResult = 'Delete';
      await store.delete(store.getAll()[0]);
      assert.strictEqual(store.getAll().length, 0);
    });

    test('does not remove the command when cancelled', async () => {
      await store.load();
      await store.add(makeCmd({ source: 'project' }));
      warnResult = undefined;
      await store.delete(store.getAll()[0]);
      assert.strictEqual(store.getAll().length, 1);
    });

    test('persists the updated list after deletion', async () => {
      await store.load();
      await store.add(makeCmd({ source: 'project' }));
      warnResult = 'Delete';
      await store.delete(store.getAll()[0]);
      // savedProject?.commands is undefined if saveProject was never called — test fails correctly
      assert.strictEqual(loader.savedProject?.commands.length, 0);
    });

    test('fires onDidChange when deleted', async () => {
      await store.load();
      await store.add(makeCmd({ source: 'project' }));
      let fired = false;
      store.onDidChange(() => (fired = true));
      warnResult = 'Delete';
      await store.delete(store.getAll()[0]);
      assert.ok(fired);
    });

    test('does not fire onDidChange when cancelled', async () => {
      await store.load();
      await store.add(makeCmd({ source: 'project' }));
      let fired = false;
      store.onDidChange(() => (fired = true));
      warnResult = undefined;
      await store.delete(store.getAll()[0]);
      assert.ok(!fired);
    });

    test('does nothing (no crash) when id is undefined', async () => {
      // Edge case: command without an id — filter removes nothing silently
      await store.load();
      await store.add(makeCmd({ source: 'project' }));
      const cmdNoId = { ...store.getAll()[0], id: undefined };
      warnResult = 'Delete';
      await store.delete(cmdNoId);
      assert.strictEqual(store.getAll().length, 1);
    });

    test('only removes the targeted command, not others', async () => {
      await store.load();
      await store.add(makeCmd({ label: 'A', source: 'project' }));
      await store.add(makeCmd({ label: 'B', source: 'project' }));
      warnResult = 'Delete';
      await store.delete(store.getAll()[0]);
      assert.strictEqual(store.getAll().length, 1);
      assert.strictEqual(store.getAll()[0].label, 'B');
    });
  });

  // -------------------------------------------------------------------------
  suite('addGroup()', () => {
    test('adds a project group to the project bucket', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: undefined, source: 'project' }));
      assert.strictEqual(store.getGroups().length, 1);
      assert.strictEqual(store.getGroups()[0].source, 'project');
    });

    test('adds a global group to the global bucket', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: undefined, source: 'global' }));
      assert.strictEqual(store.getGroups()[0].source, 'global');
    });

    test('uses the provided id when given', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'explicit-id', source: 'project' }));
      assert.strictEqual(store.getGroups()[0].id, 'explicit-id');
    });

    test('generates a UUID when id is undefined', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: undefined, source: 'project' }));
      const id = store.getGroups()[0].id;
      assert.ok(id && id.length > 0, 'Should generate a non-empty UUID');
    });

    test('two groups without ids get distinct UUIDs', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: undefined, label: 'A', source: 'project' }));
      await store.addGroup(makeGroup({ id: undefined, label: 'B', source: 'project' }));
      const [g1, g2] = store.getGroups();
      assert.notStrictEqual(g1.id, g2.id);
    });

    test('persists to project scope', async () => {
      await store.load();
      await store.addGroup(makeGroup({ source: 'project' }));
      assert.ok(loader.savedProject !== null);
      assert.strictEqual(loader.savedGlobal, null);
    });

    test('persists to global scope', async () => {
      await store.load();
      await store.addGroup(makeGroup({ source: 'global' }));
      assert.ok(loader.savedGlobal !== null);
      assert.strictEqual(loader.savedProject, null);
    });

    test('fires onDidChange', async () => {
      await store.load();
      let fired = false;
      store.onDidChange(() => (fired = true));
      await store.addGroup(makeGroup({ source: 'project' }));
      assert.ok(fired);
    });
  });

  // -------------------------------------------------------------------------
  suite('deleteGroup()', () => {
    test('removes a project group when confirmed', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', source: 'project' }));
      warnResult = 'Delete';
      await store.deleteGroup(store.getGroups()[0]);
      assert.strictEqual(store.getGroups().length, 0);
    });

    test('removes a global group when confirmed', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', source: 'global' }));
      warnResult = 'Delete';
      await store.deleteGroup(store.getGroups()[0]);
      assert.strictEqual(store.getGroups().length, 0);
    });

    test('removes commands in the same scope that belong to the deleted group', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', source: 'project' }));
      await store.add(makeCmd({ label: 'In Group', groupId: 'g1', source: 'project' }));
      warnResult = 'Delete';
      await store.deleteGroup(store.getGroups()[0]);
      assert.strictEqual(store.getAll().length, 0);
    });

    test('does NOT remove commands from the other scope', async () => {
      // Cross-scope isolation: deleting a global group must not touch project commands.
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', source: 'global' }));
      await store.add(makeCmd({ label: 'Proj', groupId: 'g1', source: 'project' }));
      warnResult = 'Delete';
      await store.deleteGroup(store.getGroups().find((g) => g.source === 'global')!);
      assert.strictEqual(store.getAll().length, 1, 'Project command must survive deletion of global group');
      assert.strictEqual(store.getAll()[0].source, 'project');
    });

    test('does nothing when cancelled', async () => {
      await store.load();
      await store.addGroup(makeGroup({ source: 'project' }));
      warnResult = undefined;
      await store.deleteGroup(store.getGroups()[0]);
      assert.strictEqual(store.getGroups().length, 1);
    });

    test('fires onDidChange when deleted', async () => {
      await store.load();
      await store.addGroup(makeGroup({ source: 'project' }));
      let fired = false;
      store.onDidChange(() => (fired = true));
      warnResult = 'Delete';
      await store.deleteGroup(store.getGroups()[0]);
      assert.ok(fired);
    });

    test('does not fire onDidChange when cancelled', async () => {
      await store.load();
      await store.addGroup(makeGroup({ source: 'project' }));
      let fired = false;
      store.onDidChange(() => (fired = true));
      warnResult = undefined;
      await store.deleteGroup(store.getGroups()[0]);
      assert.ok(!fired);
    });

    test('persists after deletion', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', source: 'project' }));
      warnResult = 'Delete';
      await store.deleteGroup(store.getGroups()[0]);
      assert.strictEqual(loader.savedProject?.groups.length, 0);
    });

    test('only removes the targeted group, not others in the same scope', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', label: 'A', source: 'project' }));
      await store.addGroup(makeGroup({ id: 'g2', label: 'B', source: 'project' }));
      warnResult = 'Delete';
      await store.deleteGroup(store.getGroups()[0]); // delete 'A'
      assert.strictEqual(store.getGroups().length, 1);
      assert.strictEqual(store.getGroups()[0].label, 'B');
    });
  });

  // -------------------------------------------------------------------------
  suite('editGroup()', () => {
    test('updates the label of a project group', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', label: 'Old Name', source: 'project' }));
      await store.editGroup('g1', { label: 'New Name' });
      assert.strictEqual(store.getGroups()[0].label, 'New Name');
    });

    test('updates the label of a global group', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', label: 'Old', source: 'global' }));
      await store.editGroup('g1', { label: 'New' });
      assert.strictEqual(store.getGroups()[0].label, 'New');
    });

    test('always preserves the original id regardless of what is passed', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', label: 'Dev', source: 'project' }));
      await store.editGroup('g1', { label: 'Dev2', id: 'should-be-ignored' } as any);
      assert.strictEqual(store.getGroups()[0].id, 'g1');
    });

    test('preserves fields not included in the partial update', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', label: 'Dev', icon: 'gear', source: 'project' }));
      await store.editGroup('g1', { label: 'Development' });
      const group = store.getGroups()[0];
      assert.strictEqual(group.label, 'Development');
      assert.strictEqual(group.icon, 'gear');
    });

    test('silently does nothing when the id does not match any group', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', label: 'Original', source: 'project' }));
      await store.editGroup('non-existent-id', { label: 'Changed' });
      assert.strictEqual(store.getGroups()[0].label, 'Original');
    });

    test('fires onDidChange after a successful edit', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', source: 'project' }));
      let fired = false;
      store.onDidChange(() => (fired = true));
      await store.editGroup('g1', { label: 'New' });
      assert.ok(fired);
    });

    test('does not fire onDidChange when the id is not found', async () => {
      await store.load();
      let fired = false;
      store.onDidChange(() => (fired = true));
      await store.editGroup('non-existent-id', { label: 'Changed' });
      assert.ok(!fired);
    });

    test('persists to project scope after editing a project group', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', source: 'project' }));
      loader.savedProject = null;
      await store.editGroup('g1', { label: 'New' });
      assert.ok(loader.savedProject !== null);
      assert.strictEqual(loader.savedGlobal, null);
    });

    test('persists to global scope after editing a global group', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', source: 'global' }));
      loader.savedGlobal = null;
      await store.editGroup('g1', { label: 'New' });
      assert.ok(loader.savedGlobal !== null);
      assert.strictEqual(loader.savedProject, null);
    });

    test('does not affect other groups in the same scope', async () => {
      await store.load();
      await store.addGroup(makeGroup({ id: 'g1', label: 'A', source: 'project' }));
      await store.addGroup(makeGroup({ id: 'g2', label: 'B', source: 'project' }));
      await store.editGroup('g1', { label: 'A-Renamed' });
      assert.strictEqual(store.getGroups()[1].label, 'B');
    });
  });
});
