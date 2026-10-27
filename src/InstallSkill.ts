import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export const SKILL_NAME = 'quickrun-setup';

export function bundledSkillDir(extensionPath: string): string {
  return path.join(extensionPath, 'skills', SKILL_NAME);
}

export async function installClaudeSkill(
  extensionPath: string,
  homeDir = os.homedir(),
): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  const targets = [
    {
      label: 'Global',
      description: `~/.claude/skills/${SKILL_NAME}`,
      detail: 'Available in Claude Code in every project.',
      dir: path.join(homeDir, '.claude', 'skills', SKILL_NAME),
    },
  ];
  if (workspaceRoot) {
    targets.push({
      label: 'This workspace',
      description: `.claude/skills/${SKILL_NAME}`,
      detail: 'Only for this project. Commit it to share the skill with your team.',
      dir: path.join(workspaceRoot, '.claude', 'skills', SKILL_NAME),
    });
  }

  const target = await vscode.window.showQuickPick(targets, {
    title: 'QuickRun — Install Claude Code Skill',
    placeHolder: 'Where should the skill be installed?',
  });
  if (!target) {
    return;
  }

  try {
    // Overwrite unconditionally — the skill is owned by the extension, reinstalling updates it.
    await fs.rm(target.dir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(target.dir), { recursive: true });
    await fs.cp(bundledSkillDir(extensionPath), target.dir, { recursive: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    vscode.window.showErrorMessage(`QuickRun: Could not install the Claude Code skill: ${msg}`);
    return;
  }

  vscode.window.showInformationMessage(
    `QuickRun: Claude Code skill installed. In Claude Code, run /${SKILL_NAME} or ask it to set up your QuickRun commands.`,
  );
}
