import * as vscode from 'vscode';
import { CommandItem, CommandsProvider } from './CommandsProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new CommandsProvider();

  vscode.window.registerTreeDataProvider('quickrunPanel', provider);

  const commands: Record<string, (...args: any[]) => void> = {
    'quickrun.addCommand': () => provider.addCommand(),
    'quickrun.refreshCommands': () => provider.refresh(),

    // These will receive the CommandItem as an argument from the view's context as we set up in package.json with "view/item/context"
    'quickrun.executeCommand': (commandItem: CommandItem) => commandItem.execute(),
    'quickrun.editCommand': (commandItem: CommandItem) => commandItem.edit(),
    'quickrun.deleteCommand': (commandItem: CommandItem) => commandItem.delete(),
  };

  // Register all commands and push disposables
  const disposables = Object.entries(commands).map(([command, callback]) =>
    vscode.commands.registerCommand(command, callback),
  );

  context.subscriptions.push(...disposables);
}

export function deactivate() {}
