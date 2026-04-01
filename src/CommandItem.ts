import * as vscode from 'vscode';
import { QuickRunCommand } from './types';

const runningCommands = new Set<string>(); // command ids currently executing
const terminalCommandId = new Map<vscode.Terminal, string>();
const busyTerminals = new Set<vscode.Terminal>();
const managedTerminals = new Map<string, vscode.Terminal[]>();

const _onDidChangeState = new vscode.EventEmitter<void>();
export const onDidChangeTerminalState = _onDidChangeState.event;

export function focusTerminalForLabel(label: string): void {
  const list = managedTerminals.get(label) ?? [];
  const open = list.find((t) => t.exitStatus === undefined);
  if (open) {
    open.show();
  }
}

let trackingInitialized = false;
function initTracking(): void {
  if (trackingInitialized) {
    return;
  }
  trackingInitialized = true;

  vscode.window.onDidCloseTerminal((t) => {
    busyTerminals.delete(t);
    const cmdId = terminalCommandId.get(t);
    if (cmdId) {
      runningCommands.delete(cmdId);
      terminalCommandId.delete(t);
      _onDidChangeState.fire();
    }
    for (const [label, list] of managedTerminals) {
      const idx = list.indexOf(t);
      if (idx !== -1) {
        list.splice(idx, 1);
        if (list.length === 0) {
          managedTerminals.delete(label);
        }
        break;
      }
    }
  });
}

function markRunning(terminal: vscode.Terminal, cmdId: string): void {
  runningCommands.add(cmdId);
  terminalCommandId.set(terminal, cmdId);
  _onDidChangeState.fire();
}

function markDone(terminal: vscode.Terminal, cmdId: string): void {
  runningCommands.delete(cmdId);
  terminalCommandId.delete(terminal);
  busyTerminals.delete(terminal);
  _onDidChangeState.fire();
}

export class CommandItem extends vscode.TreeItem {
  constructor(public readonly data: QuickRunCommand) {
    super(data.label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'commandItem';
    this.id = data.id;
    this.tooltip = data.customCommand;
    this.description = data.source === 'global' ? 'global' : 'project';

    const isRunning = data.id ? runningCommands.has(data.id) : false;
    this.iconPath = new vscode.ThemeIcon(
      data.icon || 'play',
      isRunning ? new vscode.ThemeColor('testing.iconPassed') : undefined,
    );
    this.command = {
      command: 'quickrun.focusTerminal',
      title: 'Focus Terminal',
      arguments: [this],
    };
  }

  execute(): void {
    if (!this.data.customCommand.trim()) {
      vscode.window.showWarningMessage(`No command defined for "${this.data.label}"`);
      return;
    }

    initTracking();

    const label = this.data.label;
    const commandId = this.data.id ?? '';
    const existing = managedTerminals.get(label) ?? [];

    // If already running, just focus that terminal.
    const runningTerminal = existing.find(
      (t) => t.exitStatus === undefined && busyTerminals.has(t),
    );
    if (runningTerminal) {
      runningTerminal.show();
      return;
    }

    // Find a free managed terminal or create a new one.
    const freeTerminal = existing.find(
      (t) => t.exitStatus === undefined && !busyTerminals.has(t),
    );
    const terminal = freeTerminal ?? vscode.window.createTerminal(label);

    if (!freeTerminal) {
      if (!managedTerminals.has(label)) {
        managedTerminals.set(label, []);
      }
      managedTerminals.get(label)!.push(terminal);
    }

    busyTerminals.add(terminal);
    if (commandId) {
      markRunning(terminal, commandId);
    }
    terminal.show();

    const subs: vscode.Disposable[] = [];
    let freed = false;
    const markFree = () => {
      if (freed) return;
      freed = true;
      subs.forEach((s) => s.dispose());
      if (commandId) {
        markDone(terminal, commandId);
      }
    };

    if (terminal.shellIntegration) {
      terminal.shellIntegration.executeCommand(this.data.customCommand);
    } else {
      terminal.sendText(this.data.customCommand, true);
      // When shell integration first activates, the command has finished and the
      // shell is at a prompt — treat that as completion.
      subs.push(
        vscode.window.onDidChangeTerminalShellIntegration((e) => {
          if (e.terminal === terminal) markFree();
        }),
      );
    }

    subs.push(
      // Terminal-identity (not execution-identity) so interactive programs like
      // htop also clear the busy state when they exit.
      vscode.window.onDidEndTerminalShellExecution((e) => {
        if (e.terminal === terminal) markFree();
      }),
      vscode.window.onDidCloseTerminal((t) => {
        if (t === terminal) markFree();
      }),
    );
  }
}
