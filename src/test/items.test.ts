import * as assert from 'assert';
import * as vscode from 'vscode';
import { CommandItem } from '../CommandItem';
import { GroupItem } from '../GroupItem';
import { QuickRunCommand, QuickRunGroup } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCmd = (overrides: Partial<QuickRunCommand> = {}): QuickRunCommand => ({
  id: 'cmd-id',
  label: 'My Command',
  customCommand: 'echo hello',
  icon: 'play',
  source: 'project',
  ...overrides,
});

const makeGroup = (overrides: Partial<QuickRunGroup> = {}): QuickRunGroup => ({
  id: 'grp-id',
  label: 'My Group',
  source: 'project',
  ...overrides,
});

// ---------------------------------------------------------------------------
// CommandItem
// ---------------------------------------------------------------------------

suite('CommandItem — constructor', () => {
  test('sets label from data.label', () => {
    const item = new CommandItem(makeCmd({ label: 'Build' }));
    assert.strictEqual(item.label, 'Build');
  });

  test('sets id from data.id', () => {
    const item = new CommandItem(makeCmd({ id: 'abc-123' }));
    assert.strictEqual(item.id, 'abc-123');
  });

  test('id is undefined when data.id is undefined', () => {
    const item = new CommandItem(makeCmd({ id: undefined }));
    assert.strictEqual(item.id, undefined);
  });

  test('contextValue is commandItem', () => {
    const item = new CommandItem(makeCmd());
    assert.strictEqual(item.contextValue, 'commandItem');
  });

  test('tooltip is the customCommand string', () => {
    const item = new CommandItem(makeCmd({ customCommand: 'npm run test' }));
    assert.strictEqual(item.tooltip, 'npm run test');
  });

  test('iconPath uses the icon from data', () => {
    const item = new CommandItem(makeCmd({ icon: 'gear' }));
    assert.ok(item.iconPath instanceof vscode.ThemeIcon);
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'gear');
  });

  test('iconPath defaults to play when icon is undefined', () => {
    const item = new CommandItem(makeCmd({ icon: undefined }));
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'play');
  });

  test('iconPath defaults to play when icon is empty string', () => {
    const item = new CommandItem(makeCmd({ icon: '' }));
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'play');
  });

  test('description is "project" for project-scoped commands', () => {
    const item = new CommandItem(makeCmd({ source: 'project' }));
    assert.strictEqual(item.description, 'project');
  });

  test('description is "global" for global-scoped commands', () => {
    const item = new CommandItem(makeCmd({ source: 'global' }));
    assert.strictEqual(item.description, 'global');
  });

  test('collapsibleState is None', () => {
    const item = new CommandItem(makeCmd());
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
  });

  test('data property holds the original command', () => {
    const cmd = makeCmd({ label: 'Check' });
    const item = new CommandItem(cmd);
    assert.strictEqual(item.data, cmd);
  });
});

// ---------------------------------------------------------------------------
// CommandItem.execute()
// ---------------------------------------------------------------------------

suite('CommandItem — execute()', () => {
  let origWarn: typeof vscode.window.showWarningMessage;
  let origCreate: typeof vscode.window.createTerminal;
  let warnMessages: string[];
  let sentTexts: string[];
  let fakeTerminal: { show(): void; sendText(t: string, nl: boolean): void };

  setup(() => {
    warnMessages = [];
    sentTexts = [];
    origWarn = vscode.window.showWarningMessage;
    origCreate = vscode.window.createTerminal;

    (vscode.window as any).showWarningMessage = (msg: string) => {
      warnMessages.push(msg);
      return Promise.resolve(undefined);
    };

    fakeTerminal = {
      show() {},
      sendText(text: string, _nl: boolean) {
        sentTexts.push(text);
      },
    };

    // Default: no active terminal — force createTerminal path
    Object.defineProperty(vscode.window, 'activeTerminal', {
      get: () => undefined,
      configurable: true,
    });
    (vscode.window as any).createTerminal = () => fakeTerminal;
  });

  teardown(() => {
    (vscode.window as any).showWarningMessage = origWarn;
    (vscode.window as any).createTerminal = origCreate;
    // Restore activeTerminal getter
    Object.defineProperty(vscode.window, 'activeTerminal', {
      get: () => undefined,
      configurable: true,
    });
  });

  test('shows warning for an empty command string', () => {
    const item = new CommandItem(makeCmd({ label: 'Empty', customCommand: '' }));
    item.execute();
    assert.ok(warnMessages.some((m) => m.includes('Empty')));
  });

  test('shows warning for a whitespace-only command', () => {
    const item = new CommandItem(makeCmd({ label: 'Spaces', customCommand: '   ' }));
    item.execute();
    assert.ok(warnMessages.some((m) => m.includes('Spaces')));
  });

  test('shows warning for a tab-only command', () => {
    const item = new CommandItem(makeCmd({ label: 'Tabs', customCommand: '\t\t' }));
    item.execute();
    assert.ok(warnMessages.some((m) => m.includes('Tabs')));
  });

  test('does not show warning for a valid command', () => {
    const item = new CommandItem(makeCmd({ customCommand: 'echo hi' }));
    item.execute();
    assert.strictEqual(warnMessages.length, 0);
  });

  test('sends the exact command text to the terminal', () => {
    const item = new CommandItem(makeCmd({ customCommand: 'npm run build' }));
    item.execute();
    assert.ok(sentTexts.includes('npm run build'));
  });

  test('creates a new terminal when no active terminal', () => {
    let terminalCreated = false;
    (vscode.window as any).createTerminal = (name: string) => {
      terminalCreated = true;
      assert.strictEqual(name, 'Quick Run');
      return fakeTerminal;
    };
    const item = new CommandItem(makeCmd({ customCommand: 'ls' }));
    item.execute();
    assert.ok(terminalCreated);
  });

  test('uses the active terminal when one exists', () => {
    const activeSent: string[] = [];
    const activeTerminal = {
      show() {},
      sendText(text: string, _nl: boolean) {
        activeSent.push(text);
      },
    };
    Object.defineProperty(vscode.window, 'activeTerminal', {
      get: () => activeTerminal,
      configurable: true,
    });
    // createTerminal must not be called
    (vscode.window as any).createTerminal = () => {
      throw new Error('createTerminal should not be called when there is an active terminal');
    };

    const item = new CommandItem(makeCmd({ customCommand: 'ls -la' }));
    item.execute();
    assert.ok(activeSent.includes('ls -la'));
  });
});

// ---------------------------------------------------------------------------
// GroupItem
// ---------------------------------------------------------------------------

suite('GroupItem — constructor', () => {
  test('sets label from data.label', () => {
    const item = new GroupItem(makeGroup({ label: 'Backend' }));
    assert.strictEqual(item.label, 'Backend');
  });

  test('sets id from data.id', () => {
    const item = new GroupItem(makeGroup({ id: 'backend-id' }));
    assert.strictEqual(item.id, 'backend-id');
  });

  test('id is undefined when data.id is undefined', () => {
    const item = new GroupItem(makeGroup({ id: undefined }));
    assert.strictEqual(item.id, undefined);
  });

  test('contextValue is group', () => {
    const item = new GroupItem(makeGroup());
    assert.strictEqual(item.contextValue, 'group');
  });

  test('iconPath uses the icon from data', () => {
    const item = new GroupItem(makeGroup({ icon: 'rocket' }));
    assert.ok(item.iconPath instanceof vscode.ThemeIcon);
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'rocket');
  });

  test('iconPath defaults to folder when icon is undefined', () => {
    const item = new GroupItem(makeGroup({ icon: undefined }));
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'folder');
  });

  test('description is "project" for project-scoped groups', () => {
    const item = new GroupItem(makeGroup({ source: 'project' }));
    assert.strictEqual(item.description, 'project');
  });

  test('description is "global" for global-scoped groups', () => {
    const item = new GroupItem(makeGroup({ source: 'global' }));
    assert.strictEqual(item.description, 'global');
  });

  test('collapsibleState is Expanded', () => {
    const item = new GroupItem(makeGroup());
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
  });

  test('data property holds the original group', () => {
    const grp = makeGroup({ label: 'Check' });
    const item = new GroupItem(grp);
    assert.strictEqual(item.data, grp);
  });
});
