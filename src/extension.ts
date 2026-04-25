import * as vscode from 'vscode';
import { CommandsProvider } from './CommandsProvider';
import { CommandItem, focusTerminalForLabel, stopCommandForLabel } from './CommandItem';
import { CommandPanel } from './CommandPanel';
import { runFromPalette } from './CommandPalette';
import { CommandStore } from './CommandStore';
import { ConfigLoader } from './ConfigLoader';
import { QuickRunCommand, ConfigScope } from './types';
import { GroupItem } from './GroupItem';
import { runAutoSetup } from './AutoSetup';

const GROUP_COLOR_OPTIONS = [
  { label: '$(folder) Default', description: 'No color', value: undefined as string | undefined },
  { label: '$(folder) Red', description: '', value: 'charts.red' },
  { label: '$(folder) Orange', description: '', value: 'charts.orange' },
  { label: '$(folder) Yellow', description: '', value: 'charts.yellow' },
  { label: '$(folder) Green', description: '', value: 'charts.green' },
  { label: '$(folder) Blue', description: '', value: 'charts.blue' },
  { label: '$(folder) Purple', description: '', value: 'charts.purple' },
];

export async function activate(context: vscode.ExtensionContext) {
  const configLoader = new ConfigLoader(context);
  const commandStore = new CommandStore(configLoader);

  await commandStore.load();

  configLoader.watchProject();

  const commandsProvider = new CommandsProvider(commandStore);
  const treeView = vscode.window.createTreeView('quickrunPanel', {
    treeDataProvider: commandsProvider,
    dragAndDropController: commandsProvider,
  });
  context.subscriptions.push(treeView);
  const commands: Record<string, (...args: any[]) => void | Promise<void>> = {
    'quickrun.addCommand': (groupItem?: GroupItem) => {
      CommandPanel.open(
        context,
        undefined,
        commandStore.getGroups(),
        groupItem,
        (data: QuickRunCommand) => commandStore.add(data),
      );
    },

    'quickrun.refreshCommands': () => commandsProvider.refresh(),

    'quickrun.addGroup': async () => {
      const scopePick = await vscode.window.showQuickPick(
        [
          {
            label: 'Project',
            description: '.vscode/quickrun.json',
            value: 'project' as ConfigScope,
          },
          {
            label: 'Global',
            description: 'settings.json',
            value: 'global' as ConfigScope,
          },
        ],
        { title: 'Add Group - Choose Scope', placeHolder: 'Where should this group be stored?' },
      );
      if (!scopePick) {
        return;
      }
      const groupName = await vscode.window.showInputBox({ prompt: 'Enter group name' });
      if (!groupName) {
        return;
      }
      const colorPick = await vscode.window.showQuickPick(GROUP_COLOR_OPTIONS, {
        title: 'Add Group - Choose Color',
        placeHolder: 'Pick a folder color (optional)',
      });
      if (!colorPick) {
        return;
      }
      await commandStore.addGroup({
        label: groupName,
        color: colorPick.value,
        source: scopePick.value,
      });
    },

    'quickrun.deleteGroup': (groupItem: GroupItem) => commandStore.deleteGroup(groupItem.data),

    'quickrun.editGroup': async (groupItem: GroupItem) => {
      const group = groupItem.data;
      const groupName = await vscode.window.showInputBox({
        prompt: 'Edit group name',
        value: group.label,
      });
      if (!groupName) {
        return;
      }
      const colorPick = await vscode.window.showQuickPick(GROUP_COLOR_OPTIONS, {
        title: 'Edit Group - Choose Color',
        placeHolder: 'Pick a folder color (optional)',
      });
      if (!colorPick) {
        return;
      }
      await commandStore.editGroup(group.id!, { label: groupName, color: colorPick.value });
    },

    'quickrun.executeCommand': (commandItem: CommandItem) => commandItem.execute(),

    'quickrun.editCommand': (commandItem: CommandItem) =>
      CommandPanel.open(
        context,
        commandItem.data,
        commandStore.getGroups(),
        undefined,
        (data: QuickRunCommand) => commandStore.edit(commandItem.data.id, data),
      ),

    'quickrun.deleteCommand': (commandItem: CommandItem) => commandStore.delete(commandItem.data),

    'quickrun.focusTerminal': (commandItem: CommandItem) =>
      focusTerminalForLabel(commandItem.data.label),

    'quickrun.stopCommand': (commandItem: CommandItem) =>
      stopCommandForLabel(commandItem.data.label),

    'quickrun.runFromPalette': () => runFromPalette(commandStore),

    'quickrun.autoSetup': () => runAutoSetup(commandStore),
    'quickrun.autoSetupRecheck': () => runAutoSetup(commandStore, true),
  };

  const disposables = Object.entries(commands).map(([command, callback]) =>
    vscode.commands.registerCommand(command, callback),
  );

  context.subscriptions.push(...disposables);
  context.subscriptions.push(configLoader);
}

export function deactivate() {}
