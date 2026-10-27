import * as vscode from 'vscode';

export const REPO_URL = 'https://github.com/Paraaa/QuickRun';
export const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;

const LAST_VERSION_KEY = 'quickrun.lastVersion';
const DISABLED_KEY = 'quickrun.whatsNewDisabled';

// Synced via Settings Sync so the notification is not repeated on every machine.
export const WHATS_NEW_STATE_KEYS = [LAST_VERSION_KEY, DISABLED_KEY];

const WHATS_NEW = "What's New";
const STAR = 'Star on GitHub';
const DONT_SHOW_AGAIN = "Don't Show Again";

// Only minor and major updates are worth interrupting for; patch releases are bug fixes.
// A fresh install (no previous version) is not an update.
export function isFeatureUpdate(previous: string | undefined, current: string): boolean {
  if (!previous) {
    return false;
  }
  const [prevMajor, prevMinor] = previous.split('.').map(Number);
  const [curMajor, curMinor] = current.split('.').map(Number);
  if ([prevMajor, prevMinor, curMajor, curMinor].some(Number.isNaN)) {
    return false;
  }
  return curMajor > prevMajor || (curMajor === prevMajor && curMinor > prevMinor);
}

export async function showWhatsNew(state: vscode.Memento, version: string): Promise<void> {
  const previous = state.get<string>(LAST_VERSION_KEY);
  await state.update(LAST_VERSION_KEY, version);

  if (!isFeatureUpdate(previous, version) || state.get<boolean>(DISABLED_KEY)) {
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    `QuickRun was updated to v${version}.`,
    WHATS_NEW,
    STAR,
    DONT_SHOW_AGAIN,
  );

  if (choice === WHATS_NEW) {
    await vscode.env.openExternal(vscode.Uri.parse(CHANGELOG_URL));
  } else if (choice === STAR) {
    await vscode.env.openExternal(vscode.Uri.parse(REPO_URL));
  } else if (choice === DONT_SHOW_AGAIN) {
    await state.update(DISABLED_KEY, true);
  }
}
