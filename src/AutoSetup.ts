import * as vscode from 'vscode';
import crypto from 'crypto';
import { CommandStore } from './CommandStore';
import { selectModel, analyseProject, SuggestedCommand } from './AutoSetupLM';

export async function runAutoSetup(commandStore: CommandStore, recheckMode = false): Promise<void> {
  // Must happen before withProgress. Consent dialog cannot appear behind a progress notification
  const model = await selectModel();
  if (!model) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: recheckMode
        ? 'QuickRun: Checking for new commands...'
        : 'QuickRun: Analysing project... This may take a while on large projects.',
    },
    async (_, token) => {
      const suggestions = await analyseProject(model, token);
      if (!suggestions) {
        return;
      }

      let candidates = suggestions;

      if (recheckMode) {
        const existing = new Set(commandStore.getAll().map((c) => c.customCommand));
        candidates = suggestions.filter((s) => !existing.has(s.customCommand));
        if (candidates.length === 0) {
          vscode.window.showInformationMessage('QuickRun: No new commands found.');
          return;
        }
      }

      const selected = await showPreviewPick(candidates);
      if (!selected || selected.length === 0) {
        return;
      }

      await importCommands(selected, commandStore);

      const groupCount = new Set(selected.map((s) => s.group)).size;
      vscode.window.showInformationMessage(
        `QuickRun: Added ${selected.length} command${selected.length !== 1 ? 's' : ''} in ${groupCount} group${groupCount !== 1 ? 's' : ''}.`,
      );
    },
  );
}

async function showPreviewPick(
  candidates: SuggestedCommand[],
): Promise<SuggestedCommand[] | undefined> {
  const items = candidates.map((c) => ({
    label: c.label,
    description: `(${c.group})`,
    detail: c.notes ? `${c.customCommand}  —  ${c.notes}` : c.customCommand,
    picked: true,
    candidate: c,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: 'QuickRun Auto-Setup — Select commands to import',
    placeHolder: 'All commands are pre-selected. Deselect any you do not want.',
    matchOnDescription: true,
    matchOnDetail: true,
    ignoreFocusOut: true,
  });

  return selected?.map((i) => i.candidate);
}

async function importCommands(
  commands: SuggestedCommand[],
  commandStore: CommandStore,
): Promise<void> {
  const groupIdMap = new Map<string, string>();
  const existingGroups = commandStore.getGroups();

  for (const groupLabel of new Set(commands.map((c) => c.group))) {
    const existing = existingGroups.find((g) => g.label === groupLabel && g.source === 'project');
    if (existing?.id) {
      groupIdMap.set(groupLabel, existing.id);
    } else {
      const id = crypto.randomUUID();
      await commandStore.addGroup({ id, label: groupLabel, source: 'project' });
      groupIdMap.set(groupLabel, id);
    }
  }

  for (const command of commands) {
    await commandStore.add({
      label: command.label,
      customCommand: command.customCommand,
      icon: command.icon,
      notes: command.notes ?? undefined,
      groupId: groupIdMap.get(command.group),
      source: 'project',
    });
  }
}
