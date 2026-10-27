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
    const current = CommandPanel.currentPanel;
    if (current) {
      // Re-opening the same command keeps any unsaved input; anything else re-renders.
      const sameCommand = existing
        ? current.existing?.id === existing.id
        : !current.existing && !groupItem;
      if (!sameCommand) {
        current.render(existing, groups, groupItem, onSubmit);
      }
      current.panel.reveal();
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

  private existing: QuickRunCommand | undefined;
  private onSubmit: (data: QuickRunCommand) => void;

  private constructor(
    private readonly extensionUri: vscode.Uri,
    existing: QuickRunCommand | undefined,
    groups: QuickRunGroup[],
    groupItem: GroupItem | undefined,
    onSubmit: (data: QuickRunCommand) => void,
  ) {
    this.existing = existing;
    this.onSubmit = onSubmit;
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

    this.render(existing, groups, groupItem, onSubmit);

    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case 'submit': {
            const existing = this.existing;
            this.onSubmit({
              id: existing?.id ?? '',
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

  private render(
    existing: QuickRunCommand | undefined,
    groups: QuickRunGroup[],
    groupItem: GroupItem | undefined,
    onSubmit: (data: QuickRunCommand) => void,
  ): void {
    this.existing = existing;
    this.onSubmit = onSubmit;
    this.panel.title = existing ? 'Edit Command' : 'Add Command';
    this.panel.webview.html = this.getHtml(this.panel.webview, groups, groupItem, existing);
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

    // Roving tabindex: only the selected icon is a tab stop; arrow keys move within the grid.
    const iconGrid = ALLICONS.map(
      (name) => `
      <button type="button"
           class="icon-item ${name === selectedIcon ? 'selected' : ''}"
           role="option"
           aria-selected="${name === selectedIcon}"
           aria-label="${name}"
           tabindex="${name === selectedIcon ? '0' : '-1'}"
           data-icon="${name}"
           title="${name}"
           onclick="selectIcon('${name}')">
        <i class="codicon codicon-${name}"></i>
      </button>`,
    ).join('');

    const scopeField = !existing
      ? `
        <div class="field">
          <label>Save to</label>
          <div class="pill-group" role="radiogroup" aria-label="Save to">
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
            padding: 0;
            border-radius: 3px;
            cursor: pointer;
            border: 1px solid transparent;
            background: transparent;
            color: inherit;
            font-size: 15px;
          }
          .icon-item:hover { background: var(--vscode-list-hoverBackground); }
          .icon-item:focus-visible {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
          }
          .icon-item.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
            border-color: var(--vscode-focusBorder);
          }

          /* ── pill toggle (terminal / scope) ── */
          .pill-group {
            position: relative;
            display: flex;
            border: 1px solid var(--vscode-input-border, transparent);
            border-radius: 2px;
            overflow: hidden;
          }
          /* Visually hidden but still focusable, so arrow keys / Tab work. */
          .pill-group input[type="radio"] {
            position: absolute;
            opacity: 0;
            width: 1px;
            height: 1px;
            margin: 0;
            pointer-events: none;
          }
          .pill-group:focus-within {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 1px;
          }
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
            <button type="button" class="icon-trigger" id="icon-trigger" onclick="togglePicker()" aria-haspopup="listbox" aria-expanded="false">
              <i class="codicon codicon-${selectedIcon}" id="trigger-icon"></i>
              <span id="trigger-label">${selectedIcon}</span>
              <i class="codicon codicon-chevron-down chevron"></i>
            </button>
            <div class="icon-picker" id="icon-picker">
              <div class="icon-search-wrap">
                <input type="text" placeholder="Search icons…" oninput="filterIcons(this.value)" id="icon-search"/>
              </div>
              <div class="icon-grid" id="icon-grid" role="listbox" aria-label="Icons">${iconGrid}</div>
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
            <div class="pill-group" role="radiogroup" aria-label="Terminal behaviour">
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
          <button type="button" class="btn-secondary" onclick="cancel()">Cancel</button>
          <button type="button" class="btn-primary" onclick="submit()">${existing ? 'Save Changes' : 'Add Command'}</button>
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

          function setPickerOpen(open) {
            const trigger = document.getElementById('icon-trigger');
            document.getElementById('icon-picker').classList.toggle('open', open);
            trigger.classList.toggle('open', open);
            trigger.setAttribute('aria-expanded', String(open));
          }

          function togglePicker() {
            const opening = !document.getElementById('icon-picker').classList.contains('open');
            setPickerOpen(opening);
            if (opening) {
              document.getElementById('icon-search').focus();
            }
          }

          function closePicker() {
            setPickerOpen(false);
            document.getElementById('icon-trigger').focus();
          }

          function selectIcon(name) {
            document.querySelectorAll('.icon-item').forEach(el => {
              const selected = el.dataset.icon === name;
              el.classList.toggle('selected', selected);
              el.setAttribute('aria-selected', String(selected));
              el.tabIndex = selected ? 0 : -1;
            });
            document.getElementById('icon').value = name;
            document.getElementById('trigger-icon').className = 'codicon codicon-' + name;
            document.getElementById('trigger-label').textContent = name;
            closePicker();
          }

          function filterIcons(query) {
            const q = query.toLowerCase();
            document.querySelectorAll('.icon-item').forEach(el => {
              el.style.display = el.dataset.icon.includes(q) ? 'flex' : 'none';
            });
          }

          function visibleIcons() {
            return Array.from(document.querySelectorAll('.icon-item'))
              .filter(el => el.style.display !== 'none');
          }

          function focusIcon(el) {
            document.querySelectorAll('.icon-item').forEach(i => { i.tabIndex = -1; });
            el.tabIndex = 0;
            el.focus();
            el.scrollIntoView({ block: 'nearest' });
          }

          function gridColumns(items) {
            if (items.length < 2) { return 1; }
            const top = items[0].offsetTop;
            const idx = items.findIndex(el => el.offsetTop !== top);
            return idx === -1 ? items.length : idx;
          }

          // Down arrow in the search box jumps into the grid; Enter picks the first match.
          document.getElementById('icon-search').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const first = visibleIcons()[0];
              if (first) { selectIcon(first.dataset.icon); }
            }
            if (e.key === 'ArrowDown') {
              const items = visibleIcons();
              if (items.length) {
                e.preventDefault();
                focusIcon(items.find(el => el.classList.contains('selected')) || items[0]);
              }
            }
          });

          // Arrow keys / Home / End move focus within the grid; Enter/Space select (native button).
          document.getElementById('icon-grid').addEventListener('keydown', e => {
            const items = visibleIcons();
            const idx = items.indexOf(document.activeElement);
            if (idx === -1) { return; }
            const cols = gridColumns(items);
            let next = idx;
            switch (e.key) {
              case 'ArrowRight': next = idx + 1; break;
              case 'ArrowLeft':  next = idx - 1; break;
              case 'ArrowDown':  next = idx + cols; break;
              case 'ArrowUp':
                if (idx - cols < 0) {
                  e.preventDefault();
                  document.getElementById('icon-search').focus();
                  return;
                }
                next = idx - cols;
                break;
              case 'Home': next = 0; break;
              case 'End':  next = items.length - 1; break;
              default: return;
            }
            e.preventDefault();
            focusIcon(items[Math.max(0, Math.min(items.length - 1, next))]);
          });

          // Close picker when clicking outside
          document.addEventListener('click', e => {
            const trigger = document.getElementById('icon-trigger');
            const picker  = document.getElementById('icon-picker');
            if (!trigger.contains(e.target) && !picker.contains(e.target)) {
              setPickerOpen(false);
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
            // Enter submits only from the form's text inputs; buttons keep their native behaviour.
            const t = e.target;
            const isFormTextInput = t instanceof HTMLInputElement && t.type === 'text' && t.id !== 'icon-search';
            if (e.key === 'Enter' && isFormTextInput) {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape') {
              if (pickerOpen) {
                closePicker();
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
