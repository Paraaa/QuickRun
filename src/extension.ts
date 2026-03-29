import * as vscode from 'vscode';
import { CommandsProvider } from './CommandsProvider';
import { CommandItem } from './CommandItem';
import { CommandPanel } from './CommandPanel';
import { CommandStore } from './CommandStore';
import { QuickRunCommand } from './types';
import { GroupItem } from './GroupItem';

export function activate(context: vscode.ExtensionContext) {
  const commandStore = new CommandStore();

  // TODO:: Hardcoded for now — replace with config loading later and move to constructor of CommandStore
  commandStore.addGroup({ label: 'Django', id: 'django' });
  commandStore.addGroup({ label: 'General', id: 'general' });
  commandStore.add({
    label: 'Run server',
    customCommand: 'python manage.py runserver',
    groupId: 'django',
  });

  commandStore.add({
    label: 'Migrate',
    customCommand: 'python manage.py migrate',
    groupId: 'django',
  });

  commandStore.add({
    label: 'Test command',
    customCommand: 'echo "Hello World\\!"',
    groupId: 'general',
  });

  const commandsProvider = new CommandsProvider(commandStore);

  vscode.window.registerTreeDataProvider('quickrunPanel', commandsProvider);

  const commands: Record<string, (...args: any[]) => void> = {
    'quickrun.addCommand': (groupItem?: GroupItem) => {
      CommandPanel.open(
        context,
        undefined,
        commandStore.getGroups(),
        groupItem,
        (data: QuickRunCommand) => {
          commandStore.add(data);
        },
      );
    },
    'quickrun.refreshCommands': () => commandsProvider.refresh(),
    'quickrun.addGroup': async () => {
      const groupName = await vscode.window.showInputBox({ prompt: 'Enter group name' });
      if (groupName) {
        commandStore.addGroup({ label: groupName });
      }
    },
    'quickrun.deleteGroup': (groupItem: GroupItem) => commandStore.deleteGroup(groupItem.data),

    // These will receive the CommandItem as an argument from the view's context as we set up in package.json with "view/item/context"
    'quickrun.executeCommand': (commandItem: CommandItem) => commandItem.execute(),
    'quickrun.editCommand': (commandItem: CommandItem) =>
      CommandPanel.open(
        context,
        commandItem.data,
        commandStore.getGroups(),
        undefined,
        (data: QuickRunCommand) => {
          commandStore.edit(commandItem.data.id, data);
        },
      ),
    'quickrun.deleteCommand': (commandItem: CommandItem) => commandStore.delete(commandItem.data),
  };

  const disposables = Object.entries(commands).map(([command, callback]) =>
    vscode.commands.registerCommand(command, callback),
  );

  context.subscriptions.push(...disposables);
}

export function deactivate() {}
