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

export function stopCommandForLabel(label: string): void {
  const list = managedTerminals.get(label) ?? [];
  const busy = list.find((t) => t.exitStatus === undefined && busyTerminals.has(t));
  if (busy) {
    busy.dispose();
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
    const isRunning = data.id ? runningCommands.has(data.id) : false;
    this.contextValue = isRunning ? 'commandItemRunning' : 'commandItem';
    this.id = data.id;
    const tooltip = new vscode.MarkdownString();
    if (data.notes) {
      tooltip.appendText(data.notes);
      tooltip.appendMarkdown(`\n\n---\n\`${data.customCommand}\``);
    } else {
      tooltip.appendMarkdown(`\`${data.customCommand}\``);
    }
    this.tooltip = tooltip;
    this.iconPath = new vscode.ThemeIcon(isRunning ? 'loading~spin' : data.icon || 'play');
    this.description = isRunning ? 'running' : data.source === 'global' ? 'global' : 'project';
    // Single-click always focuses the terminal (if one exists). Execute via the play button.
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
    const terminalMode = this.data.terminalMode ?? 'reuse';
    const existing = managedTerminals.get(label) ?? [];

    // If already running, just focus that terminal.
    const runningTerminal = existing.find(
      (t) => t.exitStatus === undefined && busyTerminals.has(t),
    );
    if (runningTerminal) {
      runningTerminal.show();
      return;
    }

    // Reuse a free terminal or always create a new one, depending on terminalMode.
    const freeTerminal =
      terminalMode === 'reuse'
        ? existing.find((t) => t.exitStatus === undefined && !busyTerminals.has(t))
        : undefined;
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
      // Without shell integration there is no reliable completion event.
      // The command stays "running" until onDidEndTerminalShellExecution fires
      // (if integration later activates) or the terminal closes.
    }

    subs.push(
      // Terminal-identity (not execution-identity) so interactive programs like
      // htop also clear the busy state when they exit.
      vscode.window.onDidEndTerminalShellExecution((e) => {
        if (e.terminal === terminal) {
          markFree();
        }
      }),
    );
  }
}
