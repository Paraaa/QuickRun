export type ConfigScope = 'project' | 'global';

export interface QuickRunCommand {
  id?: string;
  label: string;
  customCommand: string;
  icon?: string;
  groupId?: string;
  source: ConfigScope;
}

export interface QuickRunGroup {
  id?: string;
  label: string;
  icon?: string;
  source: ConfigScope;
}

// On-disk shape — no 'source' field
export interface QuickRunConfig {
  commands: Omit<QuickRunCommand, 'source'>[];
  groups: Omit<QuickRunGroup, 'source'>[];
}
