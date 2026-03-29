import * as vscode from 'vscode';
import { CommandItem, CommandsProvider } from './CommandsProvider';
import { CommandPanel } from './CommandPanel';
import { QuickRunCommand } from './types';

export function activate(context: vscode.ExtensionContext) {
  const commandsProvider = new CommandsProvider();

  vscode.window.registerTreeDataProvider('quickrunPanel', commandsProvider);

  const commands: Record<string, (...args: any[]) => void> = {
    'quickrun.addCommand': () => {
      CommandPanel.open(context, undefined, (data: QuickRunCommand) => {
        commandsProvider.addCommand(data);
      });
    },
    'quickrun.refreshCommands': () => commandsProvider.refresh(),

    // These will receive the CommandItem as an argument from the view's context as we set up in package.json with "view/item/context"
    'quickrun.executeCommand': (commandItem: CommandItem) => commandItem.execute(),
    'quickrun.editCommand': (commandItem: CommandItem) =>
      CommandPanel.open(context, commandItem.data, (data: QuickRunCommand) => {
        commandsProvider.editCommand(commandItem, data);
      }),
    'quickrun.deleteCommand': (commandItem: CommandItem) =>
      commandsProvider.deleteCommand(commandItem),
  };

  const disposables = Object.entries(commands).map(([command, callback]) =>
    vscode.commands.registerCommand(command, callback),
  );

  context.subscriptions.push(...disposables);
}

export function deactivate() {}
