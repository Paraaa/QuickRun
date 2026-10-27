import * as assert from 'assert';
import * as vscode from 'vscode';
import { isFeatureUpdate, showWhatsNew, CHANGELOG_URL, REPO_URL } from '../WhatsNew';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class FakeMemento implements vscode.Memento {
  private data = new Map<string, unknown>();
  keys(): readonly string[] {
    return [...this.data.keys()];
  }
  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.data.has(key) ? (this.data.get(key) as T) : defaultValue;
  }
  async update(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite('WhatsNew — isFeatureUpdate()', () => {
  test('fresh install is not an update', () => {
    assert.strictEqual(isFeatureUpdate(undefined, '1.1.0'), false);
  });

  test('minor and major updates count', () => {
    assert.strictEqual(isFeatureUpdate('1.0.3', '1.1.0'), true);
    assert.strictEqual(isFeatureUpdate('1.4.0', '2.0.0'), true);
  });

  test('patch updates, same version and downgrades do not count', () => {
    assert.strictEqual(isFeatureUpdate('1.1.0', '1.1.1'), false);
    assert.strictEqual(isFeatureUpdate('1.1.0', '1.1.0'), false);
    assert.strictEqual(isFeatureUpdate('1.2.0', '1.1.0'), false);
  });

  test('malformed versions do not count', () => {
    assert.strictEqual(isFeatureUpdate('dev', '1.1.0'), false);
  });
});

suite('WhatsNew — showWhatsNew()', () => {
  let origShowInfo: typeof vscode.window.showInformationMessage;
  let origOpenExternal: typeof vscode.env.openExternal;

  let shownMessages: { message: string; items: string[] }[];
  let choice: string | undefined;
  let opened: string[];
  let state: FakeMemento;

  setup(() => {
    origShowInfo = vscode.window.showInformationMessage;
    origOpenExternal = vscode.env.openExternal;

    shownMessages = [];
    choice = undefined;
    opened = [];
    state = new FakeMemento();

    (vscode.window as any).showInformationMessage = async (message: string, ...items: string[]) => {
      shownMessages.push({ message, items });
      return choice;
    };
    (vscode.env as any).openExternal = async (uri: vscode.Uri) => {
      opened.push(uri.toString());
      return true;
    };
  });

  teardown(() => {
    (vscode.window as any).showInformationMessage = origShowInfo;
    (vscode.env as any).openExternal = origOpenExternal;
  });

  test('shows nothing on a fresh install but remembers the version', async () => {
    await showWhatsNew(state, '1.1.0');
    assert.strictEqual(shownMessages.length, 0);
    assert.strictEqual(state.get('quickrun.lastVersion'), '1.1.0');
  });

  test('shows nothing for a patch update', async () => {
    await state.update('quickrun.lastVersion', '1.1.0');
    await showWhatsNew(state, '1.1.1');
    assert.strictEqual(shownMessages.length, 0);
  });

  test("a feature update offers What's New, Star on GitHub and Don't Show Again", async () => {
    await state.update('quickrun.lastVersion', '1.0.0');
    await showWhatsNew(state, '1.1.0');
    assert.strictEqual(shownMessages.length, 1);
    assert.match(shownMessages[0].message, /1\.1\.0/);
    assert.deepStrictEqual(shownMessages[0].items, [
      "What's New",
      'Star on GitHub',
      "Don't Show Again",
    ]);
  });

  test('every feature update offers the star button', async () => {
    await state.update('quickrun.lastVersion', '1.0.0');
    await showWhatsNew(state, '1.1.0');
    await showWhatsNew(state, '1.2.0');
    assert.strictEqual(shownMessages.length, 2);
    assert.ok(shownMessages[1].items.includes('Star on GitHub'));
  });

  test('shows each version only once', async () => {
    await state.update('quickrun.lastVersion', '1.0.0');
    await showWhatsNew(state, '1.1.0');
    await showWhatsNew(state, '1.1.0');
    assert.strictEqual(shownMessages.length, 1);
  });

  test("What's New opens the changelog on GitHub", async () => {
    await state.update('quickrun.lastVersion', '1.0.0');
    choice = "What's New";
    await showWhatsNew(state, '1.1.0');
    assert.deepStrictEqual(opened, [CHANGELOG_URL]);
  });

  test('Star on GitHub opens the repository', async () => {
    await state.update('quickrun.lastVersion', '1.0.0');
    choice = 'Star on GitHub';
    await showWhatsNew(state, '1.1.0');
    assert.deepStrictEqual(opened, [REPO_URL]);
  });

  test("Don't Show Again silences later updates", async () => {
    await state.update('quickrun.lastVersion', '1.0.0');
    choice = "Don't Show Again";
    await showWhatsNew(state, '1.1.0');
    choice = undefined;
    await showWhatsNew(state, '2.0.0');
    assert.strictEqual(shownMessages.length, 1);
    assert.strictEqual(state.get('quickrun.lastVersion'), '2.0.0');
  });
});
