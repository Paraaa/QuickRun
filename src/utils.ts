export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Group folder colors (theme color ids), shared by the Add Group quick pick and the command panel.
export const GROUP_COLORS = [
  { name: 'Red', value: 'charts.red' },
  { name: 'Orange', value: 'charts.orange' },
  { name: 'Yellow', value: 'charts.yellow' },
  { name: 'Green', value: 'charts.green' },
  { name: 'Blue', value: 'charts.blue' },
  { name: 'Purple', value: 'charts.purple' },
];

// Shown as a row under "Icon" in the command panel; the full grid opens with "Show all".
export const SUGGESTED_ICONS = [
  'play',
  'terminal',
  'beaker',
  'package',
  'rocket',
  'server',
  'database',
  'bug',
  'tools',
  'gear',
];

// All available codicons as a JS array
export const ALLICONS = [
  'play',
  'terminal',
  'zap',
  'gear',
  'server',
  'database',
  'cloud',
  'globe',
  'rocket',
  'beaker',
  'bug',
  'code',
  'file',
  'folder',
  'git-branch',
  'git-commit',
  'github',
  'heart',
  'home',
  'info',
  'key',
  'law',
  'light-bulb',
  'link',
  'list-ordered',
  'lock',
  'mail',
  'megaphone',
  'mention',
  'milestone',
  'mortar-board',
  'organization',
  'package',
  'paintcan',
  'pencil',
  'person',
  'pin',
  'plug',
  'pulse',
  'question',
  'quote',
  'refresh',
  'repo',
  'run',
  'save',
  'search',
  'settings',
  'shield',
  'sign-in',
  'sign-out',
  'sparkle',
  'star',
  'symbol-event',
  'sync',
  'tag',
  'tasklist',
  'tools',
  'trash',
  'unfold',
  'verified',
  'versions',
  'vm',
  'wand',
  'warning',
  'watch',
  'wrench',
];
