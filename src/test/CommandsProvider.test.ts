import * as assert from 'assert';
import * as vscode from 'vscode';
import { CommandsProvider } from '../CommandsProvider';
import { CommandItem } from '../CommandItem';
import { GroupItem } from '../GroupItem';
import { QuickRunCommand, QuickRunGroup } from '../types';

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

class MockStore {
  private _emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this._emitter.event;

  commands: QuickRunCommand[] = [];
  groups: QuickRunGroup[] = [];

  getAll() {
    return [...this.commands];
  }
  getGroups() {
    return [...this.groups];
  }
  fireChange() {
    this._emitter.fire();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cmd = (overrides: Partial<QuickRunCommand> = {}): QuickRunCommand => ({
  id: 'c1',
  label: 'Cmd',
  customCommand: 'echo',
  source: 'project',
  ...overrides,
});

const grp = (overrides: Partial<QuickRunGroup> = {}): QuickRunGroup => ({
  id: 'g1',
  label: 'Group',
  source: 'project',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite('CommandsProvider', () => {
  let store: MockStore;
  let provider: CommandsProvider;

  setup(() => {
    store = new MockStore();
    provider = new CommandsProvider(store as any);
  });

  // -------------------------------------------------------------------------
  suite('getTreeItem()', () => {
    test('returns the element unchanged', () => {
      const item = new CommandItem(cmd());
      assert.strictEqual(provider.getTreeItem(item), item);
    });

    test('returns a GroupItem unchanged', () => {
      const item = new GroupItem(grp());
      assert.strictEqual(provider.getTreeItem(item), item);
    });
  });

  // -------------------------------------------------------------------------
  suite('getChildren() — root level', () => {
    test('returns empty array when store is empty', () => {
      assert.deepStrictEqual(provider.getChildren(), []);
    });

    test('returns a CommandItem for each ungrouped command', () => {
      store.commands = [cmd({ id: 'c1', groupId: undefined })];
      const children = provider.getChildren();
      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof CommandItem);
    });

    test('returns a GroupItem for each group', () => {
      store.groups = [grp({ id: 'g1' })];
      const children = provider.getChildren();
      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof GroupItem);
    });

    test('excludes commands that have a groupId', () => {
      store.commands = [cmd({ id: 'c1', groupId: 'g1' })];
      const children = provider.getChildren();
      assert.strictEqual(children.filter((c) => c instanceof CommandItem).length, 0);
    });

    test('returns root commands before groups', () => {
      store.commands = [cmd({ id: 'c1', groupId: undefined })];
      store.groups = [grp({ id: 'g1' })];
      const children = provider.getChildren();
      assert.ok(children[0] instanceof CommandItem, 'First child should be a CommandItem');
      assert.ok(children[1] instanceof GroupItem, 'Second child should be a GroupItem');
    });

    test('includes multiple ungrouped commands and multiple groups', () => {
      store.commands = [
        cmd({ id: 'c1', groupId: undefined }),
        cmd({ id: 'c2', groupId: undefined }),
      ];
      store.groups = [grp({ id: 'g1' }), grp({ id: 'g2', label: 'G2' })];
      const children = provider.getChildren();
      assert.strictEqual(children.filter((c) => c instanceof CommandItem).length, 2);
      assert.strictEqual(children.filter((c) => c instanceof GroupItem).length, 2);
    });
  });

  // -------------------------------------------------------------------------
  suite('getChildren() — group element', () => {
    test('returns commands that belong to the group', () => {
      store.commands = [
        cmd({ id: 'c1', groupId: 'g1' }),
        cmd({ id: 'c2', groupId: 'g2' }),
      ];
      store.groups = [grp({ id: 'g1' })];
      const groupItem = new GroupItem(store.groups[0]);
      const children = provider.getChildren(groupItem);
      assert.strictEqual(children.length, 1);
      assert.strictEqual((children[0] as CommandItem).data.id, 'c1');
    });

    test('returns empty array for a group with no commands', () => {
      store.groups = [grp({ id: 'g1' })];
      const groupItem = new GroupItem(store.groups[0]);
      assert.deepStrictEqual(provider.getChildren(groupItem), []);
    });

    test('returns only commands matching the group id, not all commands', () => {
      store.commands = [
        cmd({ id: 'c1', groupId: 'g1' }),
        cmd({ id: 'c2', groupId: 'g1' }),
        cmd({ id: 'c3', groupId: 'g2' }),
      ];
      const groupItem = new GroupItem(grp({ id: 'g1' }));
      const children = provider.getChildren(groupItem);
      assert.strictEqual(children.length, 2);
      assert.ok(children.every((c) => (c as CommandItem).data.groupId === 'g1'));
    });

    test('a group with undefined id matches commands where groupId is undefined', () => {
      // Documenting known behavior: if a group somehow has id === undefined,
      // it will capture all root-level commands (groupId === undefined).
      store.commands = [cmd({ id: 'c1', groupId: undefined })];
      const groupItem = new GroupItem(grp({ id: undefined }));
      const children = provider.getChildren(groupItem);
      assert.strictEqual(children.length, 1);
    });
  });

  // -------------------------------------------------------------------------
  suite('getChildren() — CommandItem element', () => {
    test('returns empty array (commands have no children)', () => {
      const commandItem = new CommandItem(cmd());
      assert.deepStrictEqual(provider.getChildren(commandItem), []);
    });
  });

  // -------------------------------------------------------------------------
  suite('refresh()', () => {
    test('fires onDidChangeTreeData', () => {
      let fired = false;
      provider.onDidChangeTreeData(() => (fired = true));
      provider.refresh();
      assert.ok(fired);
    });

    test('fires onDidChangeTreeData with undefined (full refresh)', () => {
      let receivedElement: unknown = 'not-set';
      provider.onDidChangeTreeData((el) => {
        receivedElement = el;
      });
      provider.refresh();
      assert.strictEqual(receivedElement, undefined);
    });
  });

  // -------------------------------------------------------------------------
  suite('store change subscription', () => {
    test('automatically refreshes the tree when the store fires onDidChange', () => {
      let refreshCount = 0;
      provider.onDidChangeTreeData(() => refreshCount++);
      store.fireChange();
      assert.strictEqual(refreshCount, 1);
    });

    test('multiple store changes each trigger a tree refresh', () => {
      let refreshCount = 0;
      provider.onDidChangeTreeData(() => refreshCount++);
      store.fireChange();
      store.fireChange();
      assert.strictEqual(refreshCount, 2);
    });
  });
});
