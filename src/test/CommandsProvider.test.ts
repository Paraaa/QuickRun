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
  edits: { id: string | undefined; updated: QuickRunCommand }[] = [];

  getAll() {
    return [...this.commands];
  }
  getGroups() {
    return [...this.groups];
  }
  async edit(id: string | undefined, updated: QuickRunCommand) {
    this.edits.push({ id, updated });
    const idx = this.commands.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.commands[idx] = updated;
    }
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
  suite('getChildren() — orphaned commands', () => {
    test('a command whose groupId references a non-existent group does not appear at root', () => {
      store.commands = [cmd({ id: 'c1', groupId: 'deleted-group-id' })];
      store.groups = [];
      const rootItems = provider.getChildren();
      assert.strictEqual(
        rootItems.filter((c) => c instanceof CommandItem).length,
        0,
        'Orphaned command must not appear at root — it has a groupId so it is filtered out',
      );
    });

    test('a command whose groupId references a non-existent group does not appear under any group', () => {
      store.commands = [cmd({ id: 'c1', groupId: 'deleted-group-id' })];
      store.groups = [grp({ id: 'other-group' })];
      const groupChildren = provider.getChildren(new GroupItem(store.groups[0]));
      assert.strictEqual(
        groupChildren.length,
        0,
        'Orphaned command must not appear under an unrelated group',
      );
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

  // -------------------------------------------------------------------------
  suite('getParent()', () => {
    test('returns undefined for a CommandItem without a groupId', () => {
      const item = new CommandItem(cmd({ groupId: undefined }));
      assert.strictEqual(provider.getParent(item), undefined);
    });

    test('returns a GroupItem whose data matches the group when the command has a groupId', () => {
      store.groups = [grp({ id: 'g1', label: 'Dev' })];
      const item = new CommandItem(cmd({ groupId: 'g1' }));
      const parent = provider.getParent(item);
      assert.ok(parent instanceof GroupItem);
      assert.strictEqual((parent as GroupItem).data.id, 'g1');
    });

    test('returns undefined when the groupId does not match any known group', () => {
      store.groups = [];
      const item = new CommandItem(cmd({ groupId: 'missing' }));
      assert.strictEqual(provider.getParent(item), undefined);
    });

    test('returns undefined for a GroupItem', () => {
      const item = new GroupItem(grp());
      assert.strictEqual(provider.getParent(item), undefined);
    });
  });

  // -------------------------------------------------------------------------
  // Fake DataTransfer helpers for drag-and-drop tests
  // ---------------------------------------------------------------------------

  const MIME = 'application/vnd.quickrun.commanditem';

  class FakeTransferItem {
    constructor(private readonly value: unknown) {}
    async asString(): Promise<string> {
      return JSON.stringify(this.value);
    }
  }

  class FakeDataTransfer {
    private readonly map = new Map<string, FakeTransferItem>();
    set(mime: string, item: FakeTransferItem): void {
      this.map.set(mime, item);
    }
    get(mime: string): FakeTransferItem | undefined {
      return this.map.get(mime);
    }
  }

  // -------------------------------------------------------------------------
  suite('handleDrag()', () => {
    test('sets transfer data for dragged CommandItems', () => {
      store.commands = [cmd({ id: 'c1' })];
      const item = new CommandItem(store.commands[0]);
      const dt = new FakeDataTransfer();
      provider.handleDrag([item], dt as any);
      assert.ok(dt.get(MIME) !== undefined, 'Expected transfer item to be set');
    });

    test('transfer data contains the command id', async () => {
      store.commands = [cmd({ id: 'drag-id' })];
      const item = new CommandItem(store.commands[0]);
      const dt = new FakeDataTransfer();
      provider.handleDrag([item], dt as any);
      const ids = JSON.parse(await dt.get(MIME)!.asString());
      assert.deepStrictEqual(ids, ['drag-id']);
    });

    test('includes all dragged command ids when multiple items are dragged', async () => {
      store.commands = [cmd({ id: 'c1' }), cmd({ id: 'c2', label: 'B' })];
      const items = store.commands.map((c) => new CommandItem(c));
      const dt = new FakeDataTransfer();
      provider.handleDrag(items, dt as any);
      const ids = JSON.parse(await dt.get(MIME)!.asString());
      assert.deepStrictEqual(ids.sort(), ['c1', 'c2']);
    });

    test('does not set transfer data when only GroupItems are dragged', () => {
      store.groups = [grp({ id: 'g1' })];
      const item = new GroupItem(store.groups[0]);
      const dt = new FakeDataTransfer();
      provider.handleDrag([item], dt as any);
      assert.strictEqual(dt.get(MIME), undefined);
    });
  });

  // -------------------------------------------------------------------------
  suite('handleDrop()', () => {
    let origWarn: typeof vscode.window.showWarningMessage;

    setup(() => {
      origWarn = vscode.window.showWarningMessage;
      (vscode.window as any).showWarningMessage = () => Promise.resolve(undefined);
    });

    teardown(() => {
      (vscode.window as any).showWarningMessage = origWarn;
    });

    test('assigns the target group id when dropped onto a GroupItem', async () => {
      store.commands = [cmd({ id: 'c1', groupId: undefined, source: 'project' })];
      store.groups = [grp({ id: 'g1', source: 'project' })];
      const dt = new FakeDataTransfer();
      dt.set(MIME, new FakeTransferItem(['c1']));
      const target = new GroupItem(store.groups[0]);
      await provider.handleDrop(target, dt as any);
      assert.strictEqual(store.edits.length, 1);
      assert.strictEqual(store.edits[0].updated.groupId, 'g1');
    });

    test('assigns the same groupId as the target CommandItem when dropped onto a sibling', async () => {
      store.commands = [
        cmd({ id: 'c1', groupId: undefined, source: 'project' }),
        cmd({ id: 'c2', label: 'Target', groupId: 'g1', source: 'project' }),
      ];
      store.groups = [grp({ id: 'g1', source: 'project' })];
      const dt = new FakeDataTransfer();
      dt.set(MIME, new FakeTransferItem(['c1']));
      const target = new CommandItem(store.commands[1]);
      await provider.handleDrop(target, dt as any);
      assert.strictEqual(store.edits[0].updated.groupId, 'g1');
    });

    test('removes groupId when dropped onto the root (undefined target)', async () => {
      store.commands = [cmd({ id: 'c1', groupId: 'g1', source: 'project' })];
      const dt = new FakeDataTransfer();
      dt.set(MIME, new FakeTransferItem(['c1']));
      await provider.handleDrop(undefined, dt as any);
      assert.strictEqual(store.edits[0].updated.groupId, undefined);
    });

    test('shows a warning and skips a cross-scope drop', async () => {
      let warnShown = false;
      (vscode.window as any).showWarningMessage = () => {
        warnShown = true;
        return Promise.resolve(undefined);
      };
      store.commands = [cmd({ id: 'c1', source: 'project' })];
      store.groups = [grp({ id: 'g1', source: 'global' })];
      const dt = new FakeDataTransfer();
      dt.set(MIME, new FakeTransferItem(['c1']));
      const target = new GroupItem(store.groups[0]);
      await provider.handleDrop(target, dt as any);
      assert.ok(warnShown, 'Expected a cross-scope warning');
      assert.strictEqual(store.edits.length, 0, 'Should not edit on cross-scope drop');
    });

    test('silently skips ids that do not match any known command', async () => {
      store.commands = [cmd({ id: 'c1', source: 'project' })];
      const dt = new FakeDataTransfer();
      dt.set(MIME, new FakeTransferItem(['unknown-id']));
      await assert.doesNotReject(() => provider.handleDrop(undefined, dt as any));
      assert.strictEqual(store.edits.length, 0);
    });

    test('does nothing when no transfer data is present for the MIME type', async () => {
      const dt = new FakeDataTransfer();
      await provider.handleDrop(undefined, dt as any);
      assert.strictEqual(store.edits.length, 0);
    });
  });
});
