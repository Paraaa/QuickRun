// src/GroupItem.ts
import * as vscode from 'vscode';
import { QuickRunGroup } from './types';

export class GroupItem extends vscode.TreeItem {
  constructor(public readonly data: QuickRunGroup) {
    super(data.label, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(
      data.icon ?? 'folder',
      data.color ? new vscode.ThemeColor(data.color) : undefined,
    );
    this.contextValue = 'group';
    this.description = data.source === 'global' ? 'global' : 'project';
    this.id = data.id;
  }
}
