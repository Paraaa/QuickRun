import * as vscode from 'vscode';
import { CommandsProvider } from './CommandsProvider';
import { CommandItem } from './CommandItem';
import { CommandPanel } from './CommandPanel';
import { CommandStore } from './CommandStore';
import { QuickRunCommand } from './types';

export function activate(context: vscode.ExtensionContext) {
  const commandStore = new CommandStore();

  // TODO:: Hardcoded for now — replace with config loading later and move to constructor of CommandStore
  commandStore.add({
    label: 'Run server',
    customCommand: 'python manage.py runserver',
  });

  commandStore.add({
    label: 'Migrate',
    customCommand: 'python manage.py migrate',
  });

  const commandsProvider = new CommandsProvider(commandStore);

  vscode.window.registerTreeDataProvider('quickrunPanel', commandsProvider);

  const commands: Record<string, (...args: any[]) => void> = {
    'quickrun.addCommand': () => {
      CommandPanel.open(context, undefined, (data: QuickRunCommand) => {
        commandStore.add(data);
      });
    },
    'quickrun.refreshCommands': () => commandsProvider.refresh(),

    // These will receive the CommandItem as an argument from the view's context as we set up in package.json with "view/item/context"
    'quickrun.executeCommand': (commandItem: CommandItem) => commandItem.execute(),
    'quickrun.editCommand': (commandItem: CommandItem) =>
      CommandPanel.open(context, commandItem.data, (data: QuickRunCommand) => {
        commandStore.edit(commandItem.data.id, data);
      }),
    'quickrun.deleteCommand': (commandItem: CommandItem) => commandStore.delete(commandItem.data),
  };

  const disposables = Object.entries(commands).map(([command, callback]) =>
    vscode.commands.registerCommand(command, callback),
  );

  context.subscriptions.push(...disposables);
}

export function deactivate() {}
