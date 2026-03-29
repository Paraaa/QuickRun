import * as vscode from 'vscode';
import { QuickRunCommand } from './types';

export class AddCommandPanel {
  private static currentPanel: AddCommandPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static open(context: vscode.ExtensionContext, onSubmit: (data: QuickRunCommand) => void): void {
    if (AddCommandPanel.currentPanel) {
      AddCommandPanel.currentPanel.panel.reveal();
      return;
    }
    AddCommandPanel.currentPanel = new AddCommandPanel(context, onSubmit);
  }

  private constructor(context: vscode.ExtensionContext, onSubmit: (data: QuickRunCommand) => void) {
    this.panel = vscode.window.createWebviewPanel(
      'quickrunAddCommand',
      'Add Command',
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    this.panel.webview.html = this.getHtml();

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case 'submit':
            onSubmit({ label: message.label, customCommand: message.cmd });
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
    AddCommandPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  private getHtml(): string {
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
          <input id="label" type="text" placeholder="e.g. Run server" autofocus/>
          <span class="error-msg" id="label-error">Label is required</span>
        </div>
        <div class="field">
          <label for="cmd">Command</label>
          <input id="cmd" type="text" placeholder="e.g. python manage.py runserver"/>
          <span class="error-msg" id="cmd-error">Command is required</span>
        </div>
        <div class="actions">
          <button class="btn-primary" onclick="submit()">Add Command</button>
          <button class="btn-secondary" onclick="cancel()">Cancel</button>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

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
            vscode.postMessage({
              type: 'submit',
              label: document.getElementById('label').value.trim(),
              cmd: document.getElementById('cmd').value.trim(),
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
