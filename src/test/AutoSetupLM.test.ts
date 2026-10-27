import * as assert from 'assert';
import * as vscode from 'vscode';
import { selectModel } from '../AutoSetupLM';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeModel = (name: string, family: string) =>
  ({ name, family }) as unknown as vscode.LanguageModelChat;

const SONNET = fakeModel('Claude Sonnet 4.6', 'claude-sonnet-4.6');
const GPT = fakeModel('GPT-5.4', 'gpt-5.4');
const MINI = fakeModel('GPT-4o mini', 'gpt-4o-mini');
const AUTO = fakeModel('Auto', 'auto');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite('AutoSetupLM — selectModel()', () => {
  let origSelectChatModels: typeof vscode.lm.selectChatModels;
  let origShowQuickPick: typeof vscode.window.showQuickPick;
  let origShowError: typeof vscode.window.showErrorMessage;
  let available: vscode.LanguageModelChat[];
  let shownItems: vscode.QuickPickItem[];

  setup(() => {
    origSelectChatModels = vscode.lm.selectChatModels;
    origShowQuickPick = vscode.window.showQuickPick;
    origShowError = vscode.window.showErrorMessage;
    available = [];
    shownItems = [];
    (vscode.lm as any).selectChatModels = async () => available;
    (vscode.window as any).showQuickPick = async (items: vscode.QuickPickItem[]) => {
      shownItems = items;
      return undefined;
    };
    (vscode.window as any).showErrorMessage = async () => undefined;
  });

  teardown(() => {
    (vscode.lm as any).selectChatModels = origSelectChatModels;
    (vscode.window as any).showQuickPick = origShowQuickPick;
    (vscode.window as any).showErrorMessage = origShowError;
  });

  const labels = () => shownItems.map((i) => i.label);

  test('lists every model exactly once, recommended ones first', async () => {
    available = [MINI, GPT, SONNET];
    await selectModel();
    assert.deepStrictEqual(labels(), [
      'GPT-5.4',
      'Claude Sonnet 4.6',
      'Other models',
      'GPT-4o mini',
    ]);
  });

  test('omits the separator when only recommended models are available', async () => {
    available = [SONNET, GPT];
    await selectModel();
    assert.deepStrictEqual(labels(), ['GPT-5.4', 'Claude Sonnet 4.6']);
  });

  test('omits the separator when no recommended model is available', async () => {
    available = [MINI];
    await selectModel();
    assert.deepStrictEqual(labels(), ['GPT-4o mini']);
  });

  test('hides "Auto" models', async () => {
    available = [AUTO, SONNET];
    await selectModel();
    assert.deepStrictEqual(labels(), ['Claude Sonnet 4.6']);
  });
});
