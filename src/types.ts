export interface QuickRunCommand {
  id?: string;
  label: string;
  customCommand: string;
  groupId?: string;
}

export interface QuickRunGroup {
  id?: string;
  label: string;
  icon?: string;
}
