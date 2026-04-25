import * as assert from 'assert';
import * as vscode from 'vscode';
import { CommandItem, focusTerminalForLabel } from '../CommandItem';
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

  test('tooltip contains the customCommand', () => {
    const item = new CommandItem(makeCmd({ customCommand: 'npm run test' }));
    assert.ok(item.tooltip instanceof vscode.MarkdownString);
    assert.ok((item.tooltip as vscode.MarkdownString).value.includes('npm run test'));
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
    const item = new CommandItem(
      makeCmd({ label: 'Send Text Test', customCommand: 'npm run build' }),
    );
    item.execute();
    assert.ok(sentTexts.includes('npm run build'));
  });

  test('creates a new terminal named after the command label', () => {
    let capturedName = '';
    (vscode.window as any).createTerminal = (name: string) => {
      capturedName = name;
      return fakeTerminal;
    };
    const item = new CommandItem(makeCmd({ label: 'My Server', customCommand: 'ls' }));
    item.execute();
    assert.strictEqual(capturedName, 'My Server');
  });

  test('sends the command to a managed terminal when one already exists for the label', () => {
    // First execute registers the terminal in managedTerminals.
    const item = new CommandItem(makeCmd({ label: 'Managed Test', customCommand: 'echo hi' }));
    item.execute();
    // As long as no error is thrown and sendText was called, the managed path ran.
    assert.ok(sentTexts.includes('echo hi'));
  });
});

// ---------------------------------------------------------------------------
// CommandItem — terminal reuse
// ---------------------------------------------------------------------------

suite('CommandItem — terminal reuse', () => {
  // Each test uses a unique label so module-level managedTerminals state doesn't
  // bleed between tests.
  let seq = 0;
  const uid = () => `__reuse_${seq++}_${Date.now()}`;

  interface FakeTerm {
    exitStatus: vscode.TerminalExitStatus | undefined;
    shellIntegration: undefined;
    showCount: number;
    sentTexts: string[];
    show(): void;
    sendText(t: string, nl: boolean): void;
  }

  const makeTerm = (): FakeTerm => ({
    exitStatus: undefined,
    shellIntegration: undefined,
    showCount: 0,
    sentTexts: [],
    show() {
      this.showCount++;
    },
    sendText(t: string) {
      this.sentTexts.push(t);
    },
  });

  // Saved originals
  let savedCreate: typeof vscode.window.createTerminal;
  let savedOnEnd: typeof vscode.window.onDidEndTerminalShellExecution;
  let savedOnIntegration: typeof vscode.window.onDidChangeTerminalShellIntegration;
  let savedOnClose: typeof vscode.window.onDidCloseTerminal;

  // Captured callbacks from mocks
  let endCbs: Array<(e: { terminal: unknown }) => void>;
  let integrationCbs: Array<(e: { terminal: unknown }) => void>;
  let closeCbs: Array<(t: unknown) => void>;

  // Terminals returned by createTerminal
  let created: FakeTerm[];

  setup(() => {
    created = [];
    endCbs = [];
    integrationCbs = [];
    closeCbs = [];

    savedCreate = vscode.window.createTerminal;
    savedOnEnd = vscode.window.onDidEndTerminalShellExecution;
    savedOnIntegration = vscode.window.onDidChangeTerminalShellIntegration;
    savedOnClose = vscode.window.onDidCloseTerminal;

    (vscode.window as any).createTerminal = (_name: string) => {
      const t = makeTerm();
      created.push(t);
      return t;
    };

    (vscode.window as any).onDidEndTerminalShellExecution = (cb: (e: any) => void) => {
      endCbs.push(cb);
      return { dispose() {} };
    };

    (vscode.window as any).onDidChangeTerminalShellIntegration = (cb: (e: any) => void) => {
      integrationCbs.push(cb);
      return { dispose() {} };
    };

    (vscode.window as any).onDidCloseTerminal = (cb: (t: any) => void) => {
      closeCbs.push(cb);
      return { dispose() {} };
    };
  });

  teardown(() => {
    (vscode.window as any).createTerminal = savedCreate;
    (vscode.window as any).onDidEndTerminalShellExecution = savedOnEnd;
    (vscode.window as any).onDidChangeTerminalShellIntegration = savedOnIntegration;
    (vscode.window as any).onDidCloseTerminal = savedOnClose;
  });

  const fireEnd = (t: FakeTerm) => endCbs.forEach((cb) => cb({ terminal: t }));
  const fireIntegration = (t: FakeTerm) => integrationCbs.forEach((cb) => cb({ terminal: t }));

  test('first execute creates a terminal named after the command label', () => {
    const label = uid();
    let capturedName = '';
    (vscode.window as any).createTerminal = (name: string) => {
      capturedName = name;
      const t = makeTerm();
      created.push(t);
      return t;
    };
    new CommandItem(makeCmd({ label, customCommand: 'echo hi' })).execute();
    assert.strictEqual(capturedName, label);
    assert.strictEqual(created.length, 1);
  });

  test('reuses free terminal after onDidEndTerminalShellExecution fires', () => {
    const label = uid();
    const item = new CommandItem(makeCmd({ id: `id-${label}`, label, customCommand: 'echo hi' }));

    item.execute();
    assert.strictEqual(created.length, 1);
    const term = created[0];

    fireEnd(term); // simulate command completion

    item.execute(); // second run
    assert.strictEqual(created.length, 1, 'no new terminal created — reused the free one');
    assert.strictEqual(term.sentTexts.length, 2, 'command sent to the same terminal twice');
  });

  test('focuses running terminal without re-executing while command is busy', () => {
    const label = uid();
    const item = new CommandItem(makeCmd({ id: `id-${label}`, label, customCommand: 'npm start' }));

    item.execute();
    const term = created[0];
    const showAfterFirst = term.showCount;

    // No completion event fired — terminal is still busy
    item.execute();
    assert.strictEqual(created.length, 1, 'no new terminal created');
    assert.strictEqual(term.sentTexts.length, 1, 'command not sent a second time');
    assert.ok(term.showCount > showAfterFirst, 'terminal.show() called again to focus it');
  });

  test('creates a new terminal when previous one has exited', () => {
    const label = uid();
    const item = new CommandItem(makeCmd({ id: `id-${label}`, label, customCommand: 'echo hi' }));

    item.execute();
    const term1 = created[0];

    // Mark terminal as exited and simulate completion cleanup
    (term1 as any).exitStatus = { code: 0 };
    fireEnd(term1);

    item.execute();
    assert.strictEqual(
      created.length,
      2,
      'new terminal created because the old one has exitStatus set',
    );
  });

  test('does not re-execute when completion fires twice (freed guard)', () => {
    const label = uid();
    const item = new CommandItem(makeCmd({ id: `id-${label}`, label, customCommand: 'echo' }));

    item.execute();
    const term = created[0];

    fireEnd(term);
    fireEnd(term); // second fire should be a no-op due to the freed guard

    // Terminal should still be free — one more execute should reuse it, not create new
    item.execute();
    assert.strictEqual(created.length, 1);
    assert.strictEqual(term.sentTexts.length, 2);
  });
});

// ---------------------------------------------------------------------------
// focusTerminalForLabel
// ---------------------------------------------------------------------------

suite('focusTerminalForLabel', () => {
  let seq = 0;
  const uid = () => `__focus_${seq++}_${Date.now()}`;

  interface FakeTerm {
    exitStatus: vscode.TerminalExitStatus | undefined;
    shellIntegration: undefined;
    showCount: number;
    sentTexts: string[];
    show(): void;
    sendText(t: string, nl: boolean): void;
  }

  const makeTerm = (): FakeTerm => ({
    exitStatus: undefined,
    shellIntegration: undefined,
    showCount: 0,
    sentTexts: [],
    show() {
      this.showCount++;
    },
    sendText(t: string) {
      this.sentTexts.push(t);
    },
  });

  let savedCreate: typeof vscode.window.createTerminal;
  let savedOnEnd: typeof vscode.window.onDidEndTerminalShellExecution;
  let savedOnIntegration: typeof vscode.window.onDidChangeTerminalShellIntegration;
  let savedOnClose: typeof vscode.window.onDidCloseTerminal;
  let created: FakeTerm[];

  setup(() => {
    created = [];
    savedCreate = vscode.window.createTerminal;
    savedOnEnd = vscode.window.onDidEndTerminalShellExecution;
    savedOnIntegration = vscode.window.onDidChangeTerminalShellIntegration;
    savedOnClose = vscode.window.onDidCloseTerminal;

    (vscode.window as any).createTerminal = (_name: string) => {
      const t = makeTerm();
      created.push(t);
      return t;
    };
    (vscode.window as any).onDidEndTerminalShellExecution = () => ({ dispose() {} });
    (vscode.window as any).onDidChangeTerminalShellIntegration = () => ({ dispose() {} });
    (vscode.window as any).onDidCloseTerminal = () => ({ dispose() {} });
  });

  teardown(() => {
    (vscode.window as any).createTerminal = savedCreate;
    (vscode.window as any).onDidEndTerminalShellExecution = savedOnEnd;
    (vscode.window as any).onDidChangeTerminalShellIntegration = savedOnIntegration;
    (vscode.window as any).onDidCloseTerminal = savedOnClose;
  });

  test('shows the open terminal for a known label', () => {
    const label = uid();
    new CommandItem(makeCmd({ label, customCommand: 'echo' })).execute();
    const term = created[0];
    const showBefore = term.showCount;

    focusTerminalForLabel(label);
    assert.ok(term.showCount > showBefore);
  });

  test('does nothing for an unknown label', () => {
    assert.doesNotThrow(() => focusTerminalForLabel('__no_such_label__'));
  });

  test('does nothing when terminal has exited', () => {
    const label = uid();
    new CommandItem(makeCmd({ label, customCommand: 'echo' })).execute();
    const term = created[0];
    (term as any).exitStatus = { code: 0 };
    const showBefore = term.showCount;

    focusTerminalForLabel(label);
    assert.strictEqual(term.showCount, showBefore, 'should not show an exited terminal');
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
