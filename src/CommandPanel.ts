import * as vscode from 'vscode';
import { ALLICONS, escapeHtml } from './utils';
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
    CommandPanel.currentPanel = new CommandPanel(
      context.extensionUri,
      existing,
      groups,
      groupItem,
      onSubmit,
    );
  }

  private constructor(
    private readonly extensionUri: vscode.Uri,
    existing: QuickRunCommand | undefined,
    groups: QuickRunGroup[],
    groupItem: GroupItem | undefined,
    onSubmit: (data: QuickRunCommand) => void,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'quickrunAddCommand',
      existing ? 'Edit Command' : 'Add Command',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'node_modules')],
      },
    );

    this.panel.webview.html = this.getHtml(this.panel.webview, groups, groupItem, existing);

    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case 'submit': {
            const id = existing ? existing.id : undefined;
            onSubmit({
              id: id ?? '',
              label: message.label,
              customCommand: message.customCommand,
              icon: message?.icon || 'play',
              groupId: message?.groupId || undefined,
              source: existing ? existing.source : (message.source ?? 'project'),
            });
            this.panel.dispose();
            break;
          }
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
    webview: vscode.Webview,
    groups: QuickRunGroup[],
    groupItem?: GroupItem,
    existing?: QuickRunCommand,
  ): string {
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        'node_modules',
        '@vscode/codicons',
        'dist',
        'codicon.css',
      ),
    );

    const groupOptions = this.getGroupsHtml(groups, groupItem, existing);

    const escapedLabel = existing ? escapeHtml(existing.label) : '';
    const escapedCommand = existing ? escapeHtml(existing.customCommand) : '';
    const selectedIcon = existing?.icon ?? 'play';

    const iconGrid = ALLICONS.map(
      (name) => `
    <div class="icon-item ${name === selectedIcon ? 'selected' : ''}"
         data-icon="${name}"
         title="${name}"
         onclick="selectIcon('${name}')">
      <i class="codicon codicon-${name}"></i>
    </div>
  `,
    ).join('');

    const scopeField = !existing
      ? `
        <div class="field">
          <label for="scope">Save to</label>
          <select id="scope">
            <option value="project" selected>Project (.vscode/quickrun.json)</option>
            <option value="global">Global (settings.json)</option>
          </select>
        </div>`
      : '';

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 font-src ${webview.cspSource};
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src 'unsafe-inline';">
        <link href="${codiconsUri}" rel="stylesheet"/>
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
            appearance: none;
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
        .icon-search {
          margin-bottom: 8px;
        }
        .icon-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
          gap: 4px;
          max-height: 180px;
          overflow-y: auto;
          padding: 4px;
          background: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border, transparent);
          border-radius: 2px;
        }
            .icon-item {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 4px;
            cursor: pointer;
            border: 1px solid transparent;
            font-size: 16px;
            }
            .icon-item:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
            }
            .icon-item.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
            border-color: var(--vscode-focusBorder);
            }
            .icon-preview {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 6px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            }
            .icon-preview i { font-size: 16px; }
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
            <label>Icon</label>
            <input class="icon-search" type="text"
                placeholder="Search icons..."
                oninput="filterIcons(this.value)"/>
            <div class="icon-grid" id="icon-grid">
            ${iconGrid}
            </div>
            <div class="icon-preview">
            <i class="codicon codicon-${selectedIcon}" id="preview-icon"></i>
            <span id="preview-label">${selectedIcon}</span>
            </div>
            <input type="hidden" id="icon" value="${selectedIcon}"/>
        </div>

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
        ${scopeField}
        <div class="actions">
          <button class="btn-primary" onclick="submit()">
                ${existing ? 'Save Changes' : 'Add Command'}
          </button>
          <button class="btn-secondary" onclick="cancel()">Cancel</button>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

            function selectIcon(name) {
          document.querySelectorAll('.icon-item.selected')
            .forEach(el => el.classList.remove('selected'));

          const el = document.querySelector(\`[data-icon="\${name}"]\`);
          if (el) el.classList.add('selected');

          document.getElementById('icon').value = name;
          document.getElementById('preview-icon').className = \`codicon codicon-\${name}\`;
          document.getElementById('preview-label').textContent = name;
             }

            function filterIcons(query) {
            const q = query.toLowerCase();
            document.querySelectorAll('.icon-item').forEach(el => {
                const name = el.dataset.icon;
                el.style.display = name.includes(q) ? 'flex' : 'none';
            });
            }

          function validate() {
            let valid = true;
            const label = document.getElementById('label');
            const cmd = document.getElementById('cmd');
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
            const scopeEl = document.getElementById('scope');
            vscode.postMessage({
              type: 'submit',
              label: document.getElementById('label').value.trim(),
              customCommand: document.getElementById('cmd').value.trim(),
              icon: document.getElementById('icon').value,
              groupId: document.getElementById('group').value || undefined,
              source: scopeEl ? scopeEl.value : undefined,
            });
          }

          function cancel() {
            vscode.postMessage({ type: 'cancel' });
          }

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
