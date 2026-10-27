import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { installClaudeSkill, bundledSkillDir, SKILL_NAME } from '../InstallSkill';
import { ICONS, GOAL_PROMPT } from '../AutoSetupLM';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// out/test/*.js → repo root
const EXTENSION_PATH = path.resolve(__dirname, '..', '..');

function overrideWorkspaceFolders(folders: readonly vscode.WorkspaceFolder[] | undefined): void {
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    get: () => folders,
  });
}

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'quickrun-test-'));
}

async function exists(p: string): Promise<boolean> {
  return fs
    .access(p)
    .then(() => true)
    .catch(() => false);
}

async function validCodicons(): Promise<Set<string>> {
  const css = await fs.readFile(
    path.join(EXTENSION_PATH, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'),
    'utf-8',
  );
  return new Set([...css.matchAll(/\.codicon-([a-z0-9-]+):before/g)].map((m) => m[1]));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite('InstallSkill', () => {
  let savedWorkspaceFoldersDesc: PropertyDescriptor | undefined;
  let origShowQuickPick: typeof vscode.window.showQuickPick;
  let origShowInfo: typeof vscode.window.showInformationMessage;
  let origShowError: typeof vscode.window.showErrorMessage;
  let home: string;
  let workspace: string;
  let pickedLabel: string | undefined;
  let offeredLabels: string[];

  setup(async () => {
    savedWorkspaceFoldersDesc = Object.getOwnPropertyDescriptor(
      vscode.workspace,
      'workspaceFolders',
    );
    origShowQuickPick = vscode.window.showQuickPick;
    origShowInfo = vscode.window.showInformationMessage;
    origShowError = vscode.window.showErrorMessage;

    home = await makeTempDir();
    workspace = await makeTempDir();
    overrideWorkspaceFolders([{ uri: vscode.Uri.file(workspace), name: 'ws', index: 0 }]);

    pickedLabel = undefined;
    offeredLabels = [];
    (vscode.window as any).showQuickPick = async (items: vscode.QuickPickItem[]) => {
      offeredLabels = items.map((i) => i.label);
      return items.find((i) => i.label === pickedLabel);
    };
    (vscode.window as any).showInformationMessage = async () => undefined;
    (vscode.window as any).showErrorMessage = async () => undefined;
  });

  teardown(async () => {
    if (savedWorkspaceFoldersDesc) {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', savedWorkspaceFoldersDesc);
    }
    (vscode.window as any).showQuickPick = origShowQuickPick;
    (vscode.window as any).showInformationMessage = origShowInfo;
    (vscode.window as any).showErrorMessage = origShowError;
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(workspace, { recursive: true, force: true });
  });

  test('installs into ~/.claude/skills when Global is picked', async () => {
    pickedLabel = 'Global';
    await installClaudeSkill(EXTENSION_PATH, home);

    const installed = path.join(home, '.claude', 'skills', SKILL_NAME, 'SKILL.md');
    assert.ok(await exists(installed));
    assert.ok(!(await exists(path.join(workspace, '.claude'))));
  });

  test('installs into the workspace when This workspace is picked', async () => {
    pickedLabel = 'This workspace';
    await installClaudeSkill(EXTENSION_PATH, home);

    const installed = path.join(workspace, '.claude', 'skills', SKILL_NAME, 'SKILL.md');
    assert.ok(await exists(installed));
    assert.ok(!(await exists(path.join(home, '.claude'))));
  });

  test('reinstalling overwrites the previous copy and removes stale files', async () => {
    const dir = path.join(home, '.claude', 'skills', SKILL_NAME);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), 'old', 'utf-8');
    await fs.writeFile(path.join(dir, 'stale.md'), 'stale', 'utf-8');

    pickedLabel = 'Global';
    await installClaudeSkill(EXTENSION_PATH, home);

    const content = await fs.readFile(path.join(dir, 'SKILL.md'), 'utf-8');
    const bundled = await fs.readFile(
      path.join(bundledSkillDir(EXTENSION_PATH), 'SKILL.md'),
      'utf-8',
    );
    assert.strictEqual(content, bundled);
    assert.ok(!(await exists(path.join(dir, 'stale.md'))));
  });

  test('writes nothing when the quick pick is cancelled', async () => {
    pickedLabel = undefined;
    await installClaudeSkill(EXTENSION_PATH, home);

    assert.ok(!(await exists(path.join(home, '.claude'))));
    assert.ok(!(await exists(path.join(workspace, '.claude'))));
  });

  test('only offers Global when no workspace is open', async () => {
    overrideWorkspaceFolders(undefined);
    await installClaudeSkill(EXTENSION_PATH, home);

    assert.deepStrictEqual(offeredLabels, ['Global']);
  });
});

suite('Bundled skill', () => {
  test('SKILL.md exists with valid frontmatter', async () => {
    const raw = await fs.readFile(path.join(bundledSkillDir(EXTENSION_PATH), 'SKILL.md'), 'utf-8');
    const frontmatter = raw.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(frontmatter, 'SKILL.md must start with a frontmatter block');
    assert.match(frontmatter[1], new RegExp(`^name: ${SKILL_NAME}$`, 'm'));
    assert.match(frontmatter[1], /^description: .+$/m);
  });

  test('.vscodeignore does not exclude the bundled skill', async () => {
    const ignore = await fs.readFile(path.join(EXTENSION_PATH, '.vscodeignore'), 'utf-8');
    const lines = ignore.split('\n').map((l) => l.trim());
    assert.ok(!lines.some((l) => l === 'skills' || l.startsWith('skills/')));
    assert.ok(!lines.includes('**/*.md'));
  });
});

suite('Icon lists', () => {
  test('Auto-Setup icons are all valid codicons', async () => {
    const valid = await validCodicons();
    const invalid = ICONS.filter((i) => !valid.has(i));
    assert.deepStrictEqual(invalid, []);
    for (const icon of ICONS) {
      assert.ok(GOAL_PROMPT.includes(icon));
    }
  });

  test('SKILL.md icons are all valid codicons and match Auto-Setup', async () => {
    const raw = await fs.readFile(path.join(bundledSkillDir(EXTENSION_PATH), 'SKILL.md'), 'utf-8');
    const line = raw.split('\n').find((l) => l.startsWith('- `icon`:'));
    assert.ok(line, 'SKILL.md must contain the icon rule');
    const icons = [...line.matchAll(/`([a-z0-9-]+)`/g)]
      .map((m) => m[1])
      .filter((i) => i !== 'icon');

    const valid = await validCodicons();
    assert.deepStrictEqual(
      icons.filter((i) => !valid.has(i)),
      [],
    );
    assert.deepStrictEqual(new Set(icons), new Set(ICONS));
  });
});
