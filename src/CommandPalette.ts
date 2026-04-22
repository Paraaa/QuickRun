import * as vscode from 'vscode';
import { CommandItem, isCommandRunning } from './CommandItem';
import { CommandStore } from './CommandStore';
import { QuickRunCommand } from './types';

type CommandPick = vscode.QuickPickItem & { command?: QuickRunCommand };

function makePick(cmd: QuickRunCommand): CommandPick {
  const running = cmd.id ? isCommandRunning(cmd.id) : false;
  return {
    label: `$(${running ? 'loading~spin' : cmd.icon || 'play'}) ${cmd.label}`,
    description: cmd.customCommand,
    command: cmd,
  };
}

export async function runFromPalette(commandStore: CommandStore): Promise<void> {
  const allCommands = commandStore.getAll();
  const groups = commandStore.getGroups();
  if (allCommands.length === 0) {
    vscode.window.showInformationMessage('No QuickRun commands saved yet.');
    return;
  }

  const picks: CommandPick[] = [];

  const ungrouped = allCommands.filter((cmd) => !cmd.groupId);
  for (const cmd of ungrouped) {
    picks.push(makePick(cmd));
  }

  for (const group of groups) {
    const members = allCommands.filter((cmd) => cmd.groupId === group.id);
    if (members.length === 0) {
      continue;
    }
    picks.push({ label: group.label, kind: vscode.QuickPickItemKind.Separator });
    for (const cmd of members) {
      picks.push(makePick(cmd));
    }
  }

  const selected = await vscode.window.showQuickPick(picks, {
    title: 'QuickRun: Run Command',
    placeHolder: 'Select a command to run',
    matchOnDescription: true,
  });
  if (selected?.command) {
    new CommandItem(selected.command).execute();
  }
}
