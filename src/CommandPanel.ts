import * as vscode from 'vscode';
import { ALLICONS, GROUP_COLORS, escapeHtml } from './utils';
import { ConfigScope, QuickRunCommand, QuickRunGroup } from './types';
import { GroupItem } from './GroupItem';

export type CreateGroup = (label: string, source: ConfigScope, color?: string) => Promise<string>;

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
    onCreateGroup: CreateGroup,
  ): void {
    const current = CommandPanel.currentPanel;
    if (current) {
      // Re-opening the same command keeps any unsaved input; anything else re-renders.
      const sameCommand = existing
        ? current.existing?.id === existing.id
        : !current.existing && !groupItem;
      if (!sameCommand) {
        current.render(existing, groups, groupItem, onSubmit, onCreateGroup);
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
      onCreateGroup,
    );
  }

  private existing: QuickRunCommand | undefined;
  private onSubmit: (data: QuickRunCommand) => void;
  private onCreateGroup: CreateGroup;

  private constructor(
    private readonly extensionUri: vscode.Uri,
    existing: QuickRunCommand | undefined,
    groups: QuickRunGroup[],
    groupItem: GroupItem | undefined,
    onSubmit: (data: QuickRunCommand) => void,
    onCreateGroup: CreateGroup,
  ) {
    this.existing = existing;
    this.onSubmit = onSubmit;
    this.onCreateGroup = onCreateGroup;
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

    this.render(existing, groups, groupItem, onSubmit, onCreateGroup);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'submit': {
            const existing = this.existing;
            const source: ConfigScope = existing
              ? existing.source
              : message.source === 'global'
                ? 'global'
                : 'project';
            // A group typed into "+ New group…" is only created on save, so cancelling leaves no empty group.
            const groupId = message.newGroupLabel
              ? await this.onCreateGroup(
                  message.newGroupLabel,
                  source,
                  message.newGroupColor || undefined,
                )
              : message?.groupId || undefined;
            this.onSubmit({
              id: existing?.id ?? '',
              label: message.label,
              customCommand: message.customCommand,
              icon: message?.icon || 'play',
              notes: message?.notes || undefined,
              groupId,
              terminalMode: message.terminalMode === 'new' ? 'new' : 'reuse',
              source,
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
    onCreateGroup: CreateGroup,
  ): void {
    this.existing = existing;
    this.onSubmit = onSubmit;
    this.onCreateGroup = onCreateGroup;
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

    const scopeSetting = !existing
      ? `
        <div class="setting">
          <div class="setting-title" id="scope-title">Save to</div>
          <div class="cards" role="radiogroup" aria-labelledby="scope-title">
            <label class="card">
              <input type="radio" name="scope" value="project" checked/>
              <span class="card-title"><i class="codicon codicon-folder"></i>Project</span>
              <span class="card-desc">.vscode/quickrun.json, share it with your team via git.</span>
            </label>
            <label class="card">
              <input type="radio" name="scope" value="global"/>
              <span class="card-title"><i class="codicon codicon-globe"></i>Global</span>
              <span class="card-desc">Your user settings, available in every workspace.</span>
            </label>
          </div>
        </div>`
      : '';

    const colorSwatches = [{ name: 'Default', value: '' }, ...GROUP_COLORS]
      .map(
        (c) => `
        <label class="swatch" title="${c.name}">
          <input type="radio" name="groupColor" value="${c.value}" aria-label="${c.name}" ${c.value ? '' : 'checked'}/>
          <i class="codicon codicon-folder" ${c.value ? `style="color: var(--vscode-${c.value.replace('.', '-')})"` : ''}></i>
        </label>`,
      )
      .join('');

    // Keep "More options" open when editing a command that already uses one of them.
    const moreOpen =
      !!existing && (!!existing.notes || !tmReuse || (existing.icon ?? 'play') !== 'play');

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
            padding: 20px 24px 32px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size, 13px);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            max-width: 640px;
          }

          /* ── settings-editor rows ── */
          .setting {
            padding: 10px 14px 12px;
            border-left: 2px solid transparent;
          }
          .setting:focus-within {
            border-left-color: var(--vscode-settings-focusedRowBorder, var(--vscode-focusBorder));
            background: var(--vscode-settings-focusedRowBackground, var(--vscode-list-hoverBackground));
          }
          .setting-title {
            display: block;
            font-weight: 600;
            margin-bottom: 3px;
          }
          .optional {
            font-weight: 400;
            color: var(--vscode-descriptionForeground);
          }
          .setting-desc {
            font-size: 12px;
            line-height: 1.45;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
          }
          .setting-desc code {
            font-family: var(--vscode-editor-font-family);
          }

          /* ── text inputs ── */
          input[type="text"], select {
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
          input[type="text"]:focus, select:focus { border-color: var(--vscode-focusBorder); }
          input[type="text"].error { border-color: var(--vscode-inputValidation-errorBorder); }

          select { cursor: pointer; appearance: none; padding-right: 28px; }
          option {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
          }
          .select-wrap { position: relative; }
          .select-wrap .codicon {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
            opacity: 0.6;
          }
          #new-group-fields { display: grid; gap: 8px; margin-top: 6px; }
          #new-group-fields[hidden] { display: none; }
          .swatches { display: flex; flex-wrap: wrap; gap: 4px; }
          .swatch {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border: 1px solid transparent;
            border-radius: 3px;
            cursor: pointer;
            font-size: 16px;
          }
          .swatch:hover { background: var(--vscode-list-hoverBackground); }
          .swatch input[type="radio"] {
            position: absolute;
            opacity: 0;
            width: 1px;
            height: 1px;
            margin: 0;
            pointer-events: none;
          }
          .swatch:has(input:checked) {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
          }
          .swatch:has(input:focus-visible) { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }

          /* ── terminal block (command) ── */
          .term {
            background: var(--vscode-terminal-background, var(--vscode-panel-background, var(--vscode-editor-background)));
            border: 1px solid var(--vscode-panel-border, var(--vscode-input-border, transparent));
            border-radius: 4px;
            overflow: hidden;
          }
          .term:focus-within { border-color: var(--vscode-focusBorder); }
          .term.error { border-color: var(--vscode-inputValidation-errorBorder); }
          .term-bar {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 5px 10px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--vscode-descriptionForeground);
            border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-input-border, transparent));
          }
          .term-bar .codicon { font-size: 13px; }
          .term-bar .term-mode { margin-left: auto; text-transform: none; letter-spacing: normal; }
          .term-line {
            display: flex;
            gap: 10px;
            align-items: flex-start;
            padding: 10px 12px 12px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size, 13px);
            line-height: 1.55;
          }
          .term-prompt {
            color: var(--vscode-terminal-ansiGreen, var(--vscode-terminal-foreground));
            user-select: none;
          }
          #cmd {
            flex: 1;
            min-width: 0;
            border: none;
            outline: none;
            resize: none;
            padding: 0;
            background: transparent;
            color: var(--vscode-terminal-foreground, var(--vscode-editor-foreground));
            font: inherit;
            field-sizing: content;
            min-height: 1.55em;
            max-height: 12em;
          }

          /* ── error messages ── */
          .error-msg {
            font-size: 11px;
            color: var(--vscode-inputValidation-errorForeground, #f48771);
            margin-top: 5px;
            display: none;
          }
          .error-msg.visible { display: block; }

          /* ── more options ── */
          .more {
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
            margin: 10px 0 4px;
            padding: 6px 14px;
            border: none;
            background: none;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            cursor: pointer;
          }
          .more::after {
            content: "";
            flex: 1;
            height: 1px;
            margin-left: 6px;
            background: var(--vscode-panel-border, var(--vscode-widget-border, transparent));
          }
          .more .codicon { transition: transform 0.15s ease; }
          .more[aria-expanded="true"] .codicon { transform: rotate(90deg); }
          .more:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }

          /* ── option cards (terminal / scope) ── */
          .cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 8px;
          }
          .card {
            position: relative;
            display: grid;
            gap: 3px;
            padding: 9px 12px;
            border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent));
            border-radius: 4px;
            background: var(--vscode-input-background);
            cursor: pointer;
          }
          .card:hover { background: var(--vscode-list-hoverBackground); }
          /* Visually hidden but still focusable, so arrow keys / Tab work. */
          .card input[type="radio"] {
            position: absolute;
            opacity: 0;
            width: 1px;
            height: 1px;
            margin: 0;
            pointer-events: none;
          }
          .card:has(input:checked) {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
            color: var(--vscode-list-activeSelectionForeground, inherit);
          }
          .card:has(input:focus-visible) {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 1px;
          }
          .card-title { display: flex; align-items: center; gap: 6px; font-weight: 600; }
          .card-desc { font-size: 12px; line-height: 1.4; opacity: 0.8; }

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

          /* ── actions ── */
          .actions {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 8px;
            margin-top: 20px;
            padding: 0 14px;
          }
          .shortcut {
            margin-right: auto;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
          }
          .actions button {
            padding: 6px 14px;
            font-size: 13px;
            font-family: var(--vscode-font-family);
            border: none;
            border-radius: 2px;
            cursor: pointer;
          }
          .actions button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
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

        <div class="setting">
          <label class="setting-title" for="cmd">Command</label>
          <div class="setting-desc">Runs from the workspace root. Use <code>(cd ./dir &amp;&amp; …)</code> for subfolders.</div>
          <div class="term" id="term">
            <div class="term-bar">
              <i class="codicon codicon-terminal"></i>
              <span>Shell</span>
              <span class="term-mode" id="term-mode"></span>
            </div>
            <div class="term-line">
              <span class="term-prompt" aria-hidden="true">❯</span>
              <textarea id="cmd" rows="1" spellcheck="false" placeholder="python manage.py runserver" autofocus>${escapedCommand}</textarea>
            </div>
          </div>
          <div class="error-msg" id="cmd-error">Enter the command to run.</div>
        </div>

        <div class="setting">
          <label class="setting-title" for="label">Label</label>
          <div class="setting-desc">Shown in the sidebar and as the terminal name.</div>
          <input id="label" type="text" placeholder="Run server" value="${escapedLabel}"/>
          <div class="error-msg" id="label-error">Enter a label.</div>
        </div>

        <div class="setting">
          <label class="setting-title" for="group">Group <span class="optional">· optional</span></label>
          <div class="setting-desc">Folder in the sidebar. Choose “+ New group…” to create one.</div>
          <div class="select-wrap">
            <select id="group">
              <option value="">No group</option>
              ${groupOptions}
              <option value="__new__">+ New group…</option>
            </select>
            <i class="codicon codicon-chevron-down"></i>
          </div>
          <div id="new-group-fields" hidden>
            <input id="new-group" type="text" placeholder="Group name" aria-label="New group name"/>
            <div class="swatches" role="radiogroup" aria-label="Group color">${colorSwatches}</div>
          </div>
          <div class="error-msg" id="group-error">Enter a name for the new group.</div>
        </div>

        <button type="button" class="more" id="more" aria-expanded="${moreOpen}" aria-controls="more-body">
          <i class="codicon codicon-chevron-right"></i>More options
        </button>

        <div id="more-body" ${moreOpen ? '' : 'hidden'}>
          <div class="setting">
            <label class="setting-title" for="notes">Description <span class="optional">· optional</span></label>
            <div class="setting-desc">Shown when you hover the command.</div>
            <input id="notes" type="text" placeholder="Starts the dev server on port 8000" value="${escapedNotes}"/>
          </div>

          <div class="setting">
            <div class="setting-title" id="icon-title">Icon</div>
            <div class="setting-desc">Shown next to the label in the sidebar.</div>
            <button type="button" class="icon-trigger" id="icon-trigger" onclick="togglePicker()" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="icon-title trigger-label">
              <i class="codicon codicon-${selectedIcon}" id="trigger-icon"></i>
              <span id="trigger-label">${selectedIcon}</span>
              <i class="codicon codicon-chevron-down chevron"></i>
            </button>
            <div class="icon-picker" id="icon-picker">
              <div class="icon-search-wrap">
                <input type="text" placeholder="Search icons…" oninput="filterIcons(this.value)" id="icon-search" aria-label="Search icons"/>
              </div>
              <div class="icon-grid" id="icon-grid" role="listbox" aria-label="Icons">${iconGrid}</div>
            </div>
            <input type="hidden" id="icon" value="${selectedIcon}"/>
          </div>

          <div class="setting">
            <div class="setting-title" id="tm-title">Terminal</div>
            <div class="cards" role="radiogroup" aria-labelledby="tm-title">
              <label class="card">
                <input type="radio" name="terminalMode" value="reuse" ${tmReuse ? 'checked' : ''}/>
                <span class="card-title"><i class="codicon codicon-refresh"></i>Reuse terminal</span>
                <span class="card-desc">One terminal, reused on every run.</span>
              </label>
              <label class="card">
                <input type="radio" name="terminalMode" value="new" ${!tmReuse ? 'checked' : ''}/>
                <span class="card-title"><i class="codicon codicon-add"></i>New each run</span>
                <span class="card-desc">Opens a fresh terminal every run, so earlier output stays.</span>
              </label>
            </div>
          </div>

          ${scopeSetting}
        </div>

        <div class="actions">
          <span class="shortcut">Enter to save · Shift+Enter for a new line</span>
          <button type="button" class="btn-secondary" onclick="cancel()">Cancel</button>
          <button type="button" class="btn-primary" onclick="submit()">${existing ? 'Save Changes' : 'Add Command'}</button>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          const terminalModes = { reuse: 'Reuses terminal', new: 'New terminal each run' };

          function updateTerminalMode() {
            const checked = document.querySelector('input[name="terminalMode"]:checked');
            document.getElementById('term-mode').textContent = terminalModes[checked ? checked.value : 'reuse'];
          }
          document.querySelectorAll('input[name="terminalMode"]').forEach(el => {
            el.addEventListener('change', updateTerminalMode);
          });
          updateTerminalMode();

          // Clicking anywhere in the terminal block focuses the command.
          document.getElementById('term').addEventListener('click', () => {
            document.getElementById('cmd').focus();
          });

          const more = document.getElementById('more');
          more.addEventListener('click', () => {
            const open = more.getAttribute('aria-expanded') !== 'true';
            more.setAttribute('aria-expanded', String(open));
            document.getElementById('more-body').hidden = !open;
          });

          const groupSelect = document.getElementById('group');
          const newGroup    = document.getElementById('new-group');
          const newGroupFields = document.getElementById('new-group-fields');
          let previousGroup = groupSelect.value;
          groupSelect.addEventListener('change', () => {
            const creating = groupSelect.value === '__new__';
            newGroupFields.hidden = !creating;
            if (creating) {
              newGroup.focus();
            } else {
              previousGroup = groupSelect.value;
              newGroup.value = '';
              setError(newGroup, 'group-error', false);
            }
          });
          // Escape in the new-group fields backs out of creating a group instead of closing the panel.
          newGroupFields.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              groupSelect.value = previousGroup;
              newGroup.value = '';
              newGroupFields.hidden = true;
              setError(newGroup, 'group-error', false);
              groupSelect.focus();
            }
          });

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

          function setError(input, errorId, invalid) {
            (input.id === 'cmd' ? document.getElementById('term') : input).classList.toggle('error', invalid);
            document.getElementById(errorId).classList.toggle('visible', invalid);
          }

          function validate() {
            const label = document.getElementById('label');
            const cmd   = document.getElementById('cmd');
            const labelMissing = !label.value.trim();
            const cmdMissing   = !cmd.value.trim();
            const groupMissing = groupSelect.value === '__new__' && !newGroup.value.trim();
            setError(cmd, 'cmd-error', cmdMissing);
            setError(label, 'label-error', labelMissing);
            setError(newGroup, 'group-error', groupMissing);
            const firstInvalid = cmdMissing ? cmd : labelMissing ? label : groupMissing ? newGroup : null;
            if (firstInvalid) { firstInvalid.focus(); }
            return !firstInvalid;
          }

          function submit() {
            if (!validate()) { return; }
            const tm       = document.querySelector('input[name="terminalMode"]:checked');
            const scope    = document.querySelector('input[name="scope"]:checked');
            const creating = groupSelect.value === '__new__';
            vscode.postMessage({
              type:          'submit',
              label:         document.getElementById('label').value.trim(),
              customCommand: document.getElementById('cmd').value.trim(),
              icon:          document.getElementById('icon').value,
              notes:         document.getElementById('notes').value.trim() || undefined,
              groupId:       creating ? undefined : groupSelect.value || undefined,
              newGroupLabel: creating ? newGroup.value.trim() : undefined,
              newGroupColor: creating ? (document.querySelector('input[name="groupColor"]:checked') || {}).value : undefined,
              terminalMode:  tm    ? tm.value    : 'reuse',
              source:        scope ? scope.value : undefined,
            });
          }

          function cancel() {
            vscode.postMessage({ type: 'cancel' });
          }

          document.addEventListener('keydown', e => {
            const pickerOpen = document.getElementById('icon-picker').classList.contains('open');
            // Enter submits only from the form's text fields; buttons keep their native behaviour.
            // In the command field Shift+Enter inserts a new line.
            const t = e.target;
            const isFormTextInput =
              (t instanceof HTMLInputElement && t.type === 'text' && t.id !== 'icon-search') ||
              (t instanceof HTMLTextAreaElement && !e.shiftKey);
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
