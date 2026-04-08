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
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons', 'dist'),
        ],
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
              notes: message?.notes || undefined,
              groupId: message?.groupId || undefined,
              terminalMode: message.terminalMode === 'new' ? 'new' : 'reuse',
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
    return groups
      .map(
        (group) => `
        <option value="${group.id}" ${preselectedGroupId === group.id ? 'selected' : ''}>
          ${escapeHtml(group.label)}
        </option>
      `,
      )
      .join('');
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
        '@vscode',
        'codicons',
        'dist',
        'codicon.css',
      ),
    );

    const groupOptions = this.getGroupsHtml(groups, groupItem, existing);
    const escapedLabel = existing ? escapeHtml(existing.label) : '';
    const escapedCommand = existing ? escapeHtml(existing.customCommand) : '';
    const escapedNotes = existing?.notes ? escapeHtml(existing.notes) : '';
    const selectedIcon = existing?.icon ?? 'play';
    const tmReuse = (existing?.terminalMode ?? 'reuse') === 'reuse';

    const iconGrid = ALLICONS.map(
      (name) => `
      <div class="icon-item ${name === selectedIcon ? 'selected' : ''}"
           data-icon="${name}"
           title="${name}"
           onclick="selectIcon('${name}')">
        <i class="codicon codicon-${name}"></i>
      </div>`,
    ).join('');

    const scopeField = !existing
      ? `
        <div class="field">
          <label>Save to</label>
          <div class="pill-group">
            <input type="radio" name="scope" id="scope-project" value="project" checked/>
            <label for="scope-project">Project</label>
            <input type="radio" name="scope" id="scope-global" value="global"/>
            <label for="scope-global">Global</label>
          </div>
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
          *, *::before, *::after { box-sizing: border-box; }

          body {
            margin: 0;
            padding: 24px 28px 32px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size, 13px);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            max-width: 560px;
          }

          /* ── sections ── */
          .section { margin-bottom: 24px; }
          .section-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            color: var(--vscode-descriptionForeground);
            padding-bottom: 8px;
            margin-bottom: 14px;
            border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent));
          }

          /* ── fields ── */
          .field { margin-bottom: 14px; }
          .field:last-child { margin-bottom: 0; }
          label {
            display: block;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
          }

          /* ── text inputs ── */
          input[type="text"] {
            width: 100%;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, transparent);
            padding: 6px 8px;
            font-size: 13px;
            font-family: var(--vscode-font-family);
            border-radius: 2px;
            outline: none;
          }
          input[type="text"]:focus { border-color: var(--vscode-focusBorder); }
          input[type="text"].error { border-color: var(--vscode-inputValidation-errorBorder); }

          /* ── select ── */
          select {
            width: 100%;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, transparent);
            padding: 6px 8px;
            font-size: 13px;
            font-family: var(--vscode-font-family);
            border-radius: 2px;
            outline: none;
            cursor: pointer;
            appearance: none;
          }
          select:focus { border-color: var(--vscode-focusBorder); }
          option {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
          }

          /* ── error messages ── */
          .error-msg {
            font-size: 11px;
            color: var(--vscode-inputValidation-errorForeground, #f48771);
            margin-top: 5px;
            display: none;
          }
          .error-msg.visible { display: block; }

          /* ── icon trigger button ── */
          .icon-trigger {
            display: flex;
            align-items: center;
            gap: 7px;
            width: 100%;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, transparent);
            padding: 6px 8px;
            font-size: 13px;
            font-family: var(--vscode-font-family);
            border-radius: 2px;
            cursor: pointer;
            text-align: left;
          }
          .icon-trigger:hover,
          .icon-trigger:focus { border-color: var(--vscode-focusBorder); outline: none; }
          .icon-trigger .chevron {
            margin-left: auto;
            font-size: 12px;
            opacity: 0.55;
            transition: transform 0.15s ease;
          }
          .icon-trigger.open .chevron { transform: rotate(180deg); }

          /* ── icon picker panel ── */
          .icon-picker {
            display: none;
            margin-top: 4px;
            border: 1px solid var(--vscode-input-border, transparent);
            border-radius: 2px;
            background: var(--vscode-input-background);
            overflow: hidden;
          }
          .icon-picker.open { display: block; }

          .icon-search-wrap {
            padding: 5px 6px;
            border-bottom: 1px solid var(--vscode-widget-border, transparent);
          }
          .icon-search-wrap input[type="text"] {
            border: none;
            background: transparent;
            padding: 3px 4px;
            font-size: 12px;
          }
          .icon-search-wrap input[type="text"]:focus { border-color: transparent; outline: none; }

          .icon-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
            gap: 2px;
            max-height: 156px;
            overflow-y: auto;
            padding: 6px;
          }
          .icon-item {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 3px;
            cursor: pointer;
            border: 1px solid transparent;
            font-size: 15px;
          }
          .icon-item:hover { background: var(--vscode-list-hoverBackground); }
          .icon-item.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
            border-color: var(--vscode-focusBorder);
          }

          /* ── pill toggle (terminal / scope) ── */
          .pill-group {
            display: flex;
            border: 1px solid var(--vscode-input-border, transparent);
            border-radius: 2px;
            overflow: hidden;
          }
          .pill-group input[type="radio"] { display: none; }
          .pill-group label {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 6px 10px;
            font-size: 12px;
            font-weight: 400;
            text-transform: none;
            letter-spacing: normal;
            cursor: pointer;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            margin: 0;
            user-select: none;
            transition: background 0.1s;
          }
          .pill-group label + input[type="radio"] + label {
            border-left: 1px solid var(--vscode-input-border, transparent);
          }
          .pill-group input[type="radio"]:checked + label {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }
          .pill-group label:hover { background: var(--vscode-list-hoverBackground); }
          .pill-group input[type="radio"]:checked + label:hover {
            background: var(--vscode-button-hoverBackground);
          }

          /* ── field hint ── */
          .field-hint {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 7px;
            min-height: 16px;
          }

          /* ── actions ── */
          .actions {
            display: flex;
            justify-content: space-between;
            margin-top: 28px;
          }
          button {
            padding: 6px 16px;
            font-size: 13px;
            font-family: var(--vscode-font-family);
            border: none;
            border-radius: 2px;
            cursor: pointer;
          }
          .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }
          .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
          .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
        </style>
      </head>
      <body>

        <!-- Identity -->
        <div class="section">
          <div class="section-title">Identity</div>

          <div class="field">
            <label for="label">Label</label>
            <input id="label" type="text" placeholder="e.g. Run server" value="${escapedLabel}" autofocus/>
            <div class="error-msg" id="label-error">Label is required</div>
          </div>

          <div class="field">
            <label for="notes">Description <span style="opacity:0.5; font-size:10px; font-weight:400; text-transform:none; letter-spacing:0">(optional)</span></label>
            <input id="notes" type="text" placeholder="e.g. Starts the dev server on port 8000" value="${escapedNotes}"/>
          </div>

          <div class="field">
            <label>Icon</label>
            <button type="button" class="icon-trigger" id="icon-trigger" onclick="togglePicker()">
              <i class="codicon codicon-${selectedIcon}" id="trigger-icon"></i>
              <span id="trigger-label">${selectedIcon}</span>
              <i class="codicon codicon-chevron-down chevron"></i>
            </button>
            <div class="icon-picker" id="icon-picker">
              <div class="icon-search-wrap">
                <input type="text" placeholder="Search icons…" oninput="filterIcons(this.value)" id="icon-search"/>
              </div>
              <div class="icon-grid" id="icon-grid">${iconGrid}</div>
            </div>
            <input type="hidden" id="icon" value="${selectedIcon}"/>
          </div>
        </div>

        <!-- Command -->
        <div class="section">
          <div class="section-title">Command</div>

          <div class="field">
            <label for="cmd">Shell command</label>
            <input id="cmd" type="text" placeholder="e.g. python manage.py runserver" value="${escapedCommand}"/>
            <div class="error-msg" id="cmd-error">Command is required</div>
          </div>
        </div>

        <!-- Settings -->
        <div class="section">
          <div class="section-title">Settings</div>

          <div class="field">
            <label>Terminal Behaviour</label>
            <div class="pill-group">
              <input type="radio" name="terminalMode" id="tm-reuse" value="reuse" ${tmReuse ? 'checked' : ''} onchange="updateTerminalHint()"/>
              <label for="tm-reuse">Reuse terminal</label>
              <input type="radio" name="terminalMode" id="tm-new" value="new" ${!tmReuse ? 'checked' : ''} onchange="updateTerminalHint()"/>
              <label for="tm-new">New terminal</label>
            </div>
            <div class="field-hint" id="terminal-hint"></div>
          </div>

          <div class="field">
            <label for="group">Group <span style="opacity:0.5; font-size:10px; font-weight:400; text-transform:none; letter-spacing:0">(optional)</span></label>
            <select id="group">
              <option value="">No group</option>
              ${groupOptions}
            </select>
          </div>

          ${scopeField}
        </div>

        <div class="actions">
          <button class="btn-secondary" onclick="cancel()">Cancel</button>
          <button class="btn-primary" onclick="submit()">${existing ? 'Save Changes' : 'Add Command'}</button>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          const terminalHints = {
            reuse: 'The terminal is created once and reused on every re-run. Useful for long-lived processes like dev servers.',
            new:   'A fresh terminal is opened each time the command runs. Useful for one-off commands or when you want to keep the output of previous runs.',
          };

          function updateTerminalHint() {
            const checked = document.querySelector('input[name="terminalMode"]:checked');
            const hint = document.getElementById('terminal-hint');
            if (checked && hint) { hint.textContent = terminalHints[checked.value] || ''; }
          }

          updateTerminalHint();

          function togglePicker() {
            const trigger = document.getElementById('icon-trigger');
            const picker  = document.getElementById('icon-picker');
            const opening = !picker.classList.contains('open');
            picker.classList.toggle('open', opening);
            trigger.classList.toggle('open', opening);
            if (opening) {
              document.getElementById('icon-search').focus();
            }
          }

          function selectIcon(name) {
            document.querySelectorAll('.icon-item.selected').forEach(el => el.classList.remove('selected'));
            const el = document.querySelector('[data-icon="' + name + '"]');
            if (el) { el.classList.add('selected'); }
            document.getElementById('icon').value = name;
            document.getElementById('trigger-icon').className = 'codicon codicon-' + name;
            document.getElementById('trigger-label').textContent = name;
            document.getElementById('icon-picker').classList.remove('open');
            document.getElementById('icon-trigger').classList.remove('open');
          }

          function filterIcons(query) {
            const q = query.toLowerCase();
            document.querySelectorAll('.icon-item').forEach(el => {
              el.style.display = el.dataset.icon.includes(q) ? 'flex' : 'none';
            });
          }

          // Close picker when clicking outside
          document.addEventListener('click', e => {
            const trigger = document.getElementById('icon-trigger');
            const picker  = document.getElementById('icon-picker');
            if (!trigger.contains(e.target) && !picker.contains(e.target)) {
              picker.classList.remove('open');
              trigger.classList.remove('open');
            }
          });

          function validate() {
            let valid = true;
            const label      = document.getElementById('label');
            const cmd        = document.getElementById('cmd');
            const labelError = document.getElementById('label-error');
            const cmdError   = document.getElementById('cmd-error');

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
            if (!validate()) { return; }
            const tm    = document.querySelector('input[name="terminalMode"]:checked');
            const scope = document.querySelector('input[name="scope"]:checked');
            vscode.postMessage({
              type:          'submit',
              label:         document.getElementById('label').value.trim(),
              customCommand: document.getElementById('cmd').value.trim(),
              icon:          document.getElementById('icon').value,
              notes:         document.getElementById('notes').value.trim() || undefined,
              groupId:       document.getElementById('group').value || undefined,
              terminalMode:  tm    ? tm.value    : 'reuse',
              source:        scope ? scope.value : undefined,
            });
          }

          function cancel() {
            vscode.postMessage({ type: 'cancel' });
          }

          document.addEventListener('keydown', e => {
            const pickerOpen = document.getElementById('icon-picker').classList.contains('open');
            if (e.key === 'Enter' && !pickerOpen) { submit(); }
            if (e.key === 'Escape') {
              if (pickerOpen) {
                document.getElementById('icon-picker').classList.remove('open');
                document.getElementById('icon-trigger').classList.remove('open');
              } else {
                cancel();
              }
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}
