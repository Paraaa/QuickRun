import * as vscode from 'vscode';
import { CommandItem, CommandsProvider } from './CommandsProvider';

export function activate(context: vscode.ExtensionContext) {
  const commandsProvider = new CommandsProvider();

  vscode.window.registerTreeDataProvider('quickrunPanel', commandsProvider);

  const commands: Record<string, (...args: any[]) => void> = {
    'quickrun.addCommand': () => commandsProvider.addCommand(),
    'quickrun.refreshCommands': () => commandsProvider.refresh(),

    // These will receive the CommandItem as an argument from the view's context as we set up in package.json with "view/item/context"
    'quickrun.executeCommand': (commandItem: CommandItem) => commandItem.execute(),
    'quickrun.editCommand': (commandItem: CommandItem) => commandItem.edit(),
    'quickrun.deleteCommand': (commandItem: CommandItem) =>
      commandsProvider.deleteCommand(commandItem),
  };

  // Register all commands and push disposables
  const disposables = Object.entries(commands).map(([command, callback]) =>
    vscode.commands.registerCommand(command, callback),
  );

  context.subscriptions.push(...disposables);
}

export function deactivate() {}
