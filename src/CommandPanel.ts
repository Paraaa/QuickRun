import * as vscode from 'vscode';
import { escapeHtml } from './utils';
import { QuickRunCommand, QuickRunGroup } from './types';
import { GroupItem } from './GroupItem';
export class CommandPanel {
  private static currentPanel: CommandPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static open(
    context: vscode.ExtensionContext,
    existing: QuickRunCommand | undefined,
    groups: QuickRunGroup[],
    groupItem: GroupItem | undefined,
    onSubmit: (data: QuickRunCommand) => void,
  ): void {
    if (CommandPanel.currentPanel) {
      CommandPanel.currentPanel.panel.reveal();
      return;
    }
    CommandPanel.currentPanel = new CommandPanel(context, existing, groups, groupItem, onSubmit);
  }

  private constructor(
    context: vscode.ExtensionContext,
    existing: QuickRunCommand | undefined,
    groups: QuickRunGroup[],
    groupItem: GroupItem | undefined,
    onSubmit: (data: QuickRunCommand) => void,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'quickrunAddCommand',
      existing ? 'Edit Command' : 'Add Command',
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    this.panel.webview.html = this.getHtml(groups, groupItem, existing);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case 'submit':
            // Always preserve the id when editing, only leave undefined for new commands
            const id = existing ? existing.id : undefined;
            onSubmit({
              id: id ?? '',
              label: message.label,
              customCommand: message.cmd,
              groupId: message?.groupId || undefined,
            });
            this.panel.dispose();
            break;
          case 'cancel':
            this.panel.dispose();
            break;
        }
      },
      null,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private dispose(): void {
    CommandPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  private getGroupsHtml(
    groups: QuickRunGroup[],
    groupItem?: GroupItem,
    existing?: QuickRunCommand,
  ): string {
    const preselectedGroupId = groupItem?.data.id || existing?.groupId;
    const groupOptions = groups
      .map(
        (group) => `
      <option value="${group.id}" ${preselectedGroupId === group.id ? 'selected' : ''}>
        ${escapeHtml(group.label)}
      </option>
    `,
      )
      .join('');
    return groupOptions;
  }

  private getHtml(
    groups: QuickRunGroup[],
    groupItem?: GroupItem,
    existing?: QuickRunCommand,
  ): string {
    const groupOptions = this.getGroupsHtml(groups, groupItem, existing);

    const escapedLabel = existing ? escapeHtml(existing.label) : '';
    const escapedCommand = existing ? escapeHtml(existing.customCommand) : '';

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <style>
          body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
          }
          .field {
            margin-bottom: 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          input {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, transparent);
            padding: 6px 8px;
            font-size: 13px;
            border-radius: 2px;
            outline: none;
          }
          input:focus {
            border-color: var(--vscode-focusBorder);
          }
          input.error {
            border-color: var(--vscode-inputValidation-errorBorder);
          }
          select {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, transparent);
            padding: 6px 8px;
            font-size: 13px;
            border-radius: 2px;
            outline: none;
            width: 100%;
            cursor: pointer;
            appearance: none;   /* ← removes OS default styling */
           }

           select:focus {
            border-color: var(--vscode-focusBorder);
           }
           option {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
           }
          .error-msg {
            font-size: 11px;
            color: var(--vscode-inputValidation-errorForeground);
            display: none;
          }
          .error-msg.visible {
            display: block;
          }
          .actions {
            display: flex;
            gap: 8px;
            margin-top: 24px;
          }
          button {
            padding: 6px 14px;
            font-size: 13px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
          }
          .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }
          .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
          }
        </style>
      </head>
      <body>
        <div class="field">
          <label for="label">Label</label>
          <input id="label" type="text" placeholder="e.g. Run server" value="${escapedLabel}" autofocus/>
          <span class="error-msg" id="label-error">Label is required</span>
        </div>
        <div class="field">
          <label for="cmd">Command</label>
          <input id="cmd" type="text" placeholder="e.g. python manage.py runserver" value="${escapedCommand}"/>
          <span class="error-msg" id="cmd-error">Command is required</span>
        </div>
        <div class="field">
          <label for="group">Group <span style="opacity:0.5">(optional)</span></label>
          <select id="group">
            <option value="">No group</option>
            ${groupOptions}
          </select>
        </div>
        <div class="actions">
          <button class="btn-primary" onclick="submit()">
                ${existing ? 'Save Changes' : 'Add Command'}
          </button>
          <button class="btn-secondary" onclick="cancel()">Cancel</button>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          function validate() {
            let valid = true;
            const label = document.getElementById('label');
            const cmd = document.getElementById('cmd');
            const group = document.getElementById('group');
            console.log("🚀 ~ CommandPanel ~ getHtml ~ group:", group.value)

            const labelError = document.getElementById('label-error');
            const cmdError = document.getElementById('cmd-error');

            if (!label.value.trim()) {
              label.classList.add('error');
              labelError.classList.add('visible');
              valid = false;
            } else {
              label.classList.remove('error');
              labelError.classList.remove('visible');
            }

            if (!cmd.value.trim()) {
              cmd.classList.add('error');
              cmdError.classList.add('visible');
              valid = false;
            } else {
              cmd.classList.remove('error');
              cmdError.classList.remove('visible');
            }

            return valid;
          }

          function submit() {
            if (!validate()) return;
            vscode.postMessage({
              type: 'submit',
              label: document.getElementById('label').value.trim(),
              cmd: document.getElementById('cmd').value.trim(),
              groupId: document.getElementById('group').value || undefined,
            });
          }

          function cancel() {
            vscode.postMessage({ type: 'cancel' });
          }

          // Submit on Enter
          document.addEventListener('keydown', e => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') cancel();
          });
        </script>
      </body>
      </html>
    `;
  }
}
