import * as assert from 'assert';
import * as vscode from 'vscode';
import { runFromPalette } from '../CommandPalette';
import { QuickRunCommand, QuickRunGroup } from '../types';

// ---------------------------------------------------------------------------
// Minimal mock of the parts of CommandStore that runFromPalette uses
// ---------------------------------------------------------------------------

class MockStore {
  commands: QuickRunCommand[] = [];
  groups: QuickRunGroup[] = [];
  getAll() {
    return [...this.commands];
  }
  getGroups() {
    return [...this.groups];
  }
}

const cmd = (overrides: Partial<QuickRunCommand> = {}): QuickRunCommand => ({
  id: 'c1',
  label: 'My Command',
  customCommand: 'echo hi',
  source: 'project',
  ...overrides,
});

const grp = (overrides: Partial<QuickRunGroup> = {}): QuickRunGroup => ({
  id: 'g1',
  label: 'Dev',
  source: 'project',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite('CommandPalette — runFromPalette()', () => {
  let store: MockStore;
  let origShowInfo: typeof vscode.window.showInformationMessage;
  let origShowQuickPick: typeof vscode.window.showQuickPick;
  let origCreateTerminal: typeof vscode.window.createTerminal;
  let origWarn: typeof vscode.window.showWarningMessage;
  let infoMessages: string[];
  let quickPickItems: vscode.QuickPickItem[] | undefined;
  let quickPickResolve: vscode.QuickPickItem | undefined;

  setup(() => {
    store = new MockStore();
    infoMessages = [];
    quickPickItems = undefined;
    quickPickResolve = undefined;

    origShowInfo = vscode.window.showInformationMessage;
    origShowQuickPick = vscode.window.showQuickPick;
    origCreateTerminal = vscode.window.createTerminal;
    origWarn = vscode.window.showWarningMessage;

    (vscode.window as any).showInformationMessage = (msg: string) => {
      infoMessages.push(msg);
      return Promise.resolve(undefined);
    };
    (vscode.window as any).showWarningMessage = () => Promise.resolve(undefined);
    (vscode.window as any).showQuickPick = (items: vscode.QuickPickItem[]) => {
      quickPickItems = items;
      return Promise.resolve(quickPickResolve);
    };
    (vscode.window as any).createTerminal = () => ({
      show() {},
      sendText() {},
    });
    Object.defineProperty(vscode.window, 'activeTerminal', {
      get: () => undefined,
      configurable: true,
    });
  });

  teardown(() => {
    (vscode.window as any).showInformationMessage = origShowInfo;
    (vscode.window as any).showQuickPick = origShowQuickPick;
    (vscode.window as any).createTerminal = origCreateTerminal;
    (vscode.window as any).showWarningMessage = origWarn;
  });

  // -------------------------------------------------------------------------
  suite('empty store', () => {
    test('shows an information message when there are no commands', async () => {
      await runFromPalette(store as any);
      assert.ok(infoMessages.length > 0);
    });

    test('does not open a quick pick when there are no commands', async () => {
      await runFromPalette(store as any);
      assert.strictEqual(quickPickItems, undefined);
    });
  });

  // -------------------------------------------------------------------------
  suite('ungrouped commands', () => {
    test('opens a quick pick with one item per ungrouped command', async () => {
      store.commands = [cmd({ id: 'c1' }), cmd({ id: 'c2', label: 'Other' })];
      await runFromPalette(store as any);
      assert.ok(quickPickItems !== undefined);
      assert.strictEqual(quickPickItems!.length, 2);
    });

    test('each pick includes the command text as description', async () => {
      store.commands = [cmd({ customCommand: 'npm test' })];
      await runFromPalette(store as any);
      assert.ok(quickPickItems![0].description === 'npm test');
    });

    test('non-running command uses the play icon in the label', async () => {
      store.commands = [cmd({ id: 'unique-non-running', icon: 'gear' })];
      await runFromPalette(store as any);
      assert.ok(quickPickItems![0].label.includes('gear'));
    });

    test('command without icon falls back to play in the label', async () => {
      store.commands = [cmd({ id: 'no-icon', icon: undefined })];
      await runFromPalette(store as any);
      assert.ok(quickPickItems![0].label.includes('play'));
    });
  });

  // -------------------------------------------------------------------------
  suite('grouped commands', () => {
    test('inserts a separator for groups that have commands', async () => {
      store.commands = [cmd({ id: 'c1', groupId: 'g1' })];
      store.groups = [grp({ id: 'g1', label: 'Dev' })];
      await runFromPalette(store as any);
      const sep = quickPickItems!.find(
        (i) => i.kind === vscode.QuickPickItemKind.Separator && i.label === 'Dev',
      );
      assert.ok(sep !== undefined, 'Expected a separator for group "Dev"');
    });

    test('does not insert a separator for groups with no commands', async () => {
      // Need at least one command to avoid the early-return for empty stores.
      store.commands = [cmd({ id: 'root-only', groupId: undefined })];
      store.groups = [grp({ id: 'g1', label: 'Empty Group' })];
      await runFromPalette(store as any);
      const sep = quickPickItems!.find(
        (i) => i.kind === vscode.QuickPickItemKind.Separator && i.label === 'Empty Group',
      );
      assert.strictEqual(sep, undefined, 'No separator expected for an empty group');
    });

    test('ungrouped commands appear before any group separator', async () => {
      store.commands = [
        cmd({ id: 'root', label: 'Root Cmd', groupId: undefined }),
        cmd({ id: 'grouped', label: 'Grouped Cmd', groupId: 'g1' }),
      ];
      store.groups = [grp({ id: 'g1', label: 'Dev' })];
      await runFromPalette(store as any);
      const rootIdx = quickPickItems!.findIndex((i) => i.label?.includes('Root Cmd'));
      const sepIdx = quickPickItems!.findIndex(
        (i) => i.kind === vscode.QuickPickItemKind.Separator,
      );
      assert.ok(rootIdx < sepIdx, 'Root command must appear before the group separator');
    });

    test('grouped commands appear after their group separator', async () => {
      store.commands = [cmd({ id: 'c1', label: 'Dev Test', groupId: 'g1' })];
      store.groups = [grp({ id: 'g1', label: 'Dev' })];
      await runFromPalette(store as any);
      const sepIdx = quickPickItems!.findIndex(
        (i) => i.kind === vscode.QuickPickItemKind.Separator && i.label === 'Dev',
      );
      const cmdIdx = quickPickItems!.findIndex((i) => i.label?.includes('Dev Test'));
      assert.ok(sepIdx < cmdIdx, 'Command must appear after its group separator');
    });
  });

  // -------------------------------------------------------------------------
  suite('selection handling', () => {
    test('does not throw when the quick pick is cancelled', async () => {
      store.commands = [cmd()];
      quickPickResolve = undefined;
      await assert.doesNotReject(() => runFromPalette(store as any));
    });

    test('executes the selected command without throwing', async () => {
      store.commands = [cmd({ customCommand: 'echo hello' })];
      quickPickResolve = {
        label: '$(play) My Command',
        description: 'echo hello',
        command: store.commands[0],
      } as any;
      await assert.doesNotReject(() => runFromPalette(store as any));
    });

    test('sends the command text to the terminal when a command is selected', async () => {
      const sentTexts: string[] = [];
      (vscode.window as any).createTerminal = () => ({
        show() {},
        sendText(text: string) {
          sentTexts.push(text);
        },
      });
      // Use a unique label to avoid reusing a managed terminal from a prior test.
      const uniqueLabel = `palette-test-${Date.now()}`;
      store.commands = [cmd({ id: 'exec-test', label: uniqueLabel, customCommand: 'npm start' })];
      quickPickResolve = {
        label: `$(play) ${uniqueLabel}`,
        description: 'npm start',
        command: store.commands[0],
      } as any;
      await runFromPalette(store as any);
      assert.ok(sentTexts.includes('npm start'));
    });
  });
});
