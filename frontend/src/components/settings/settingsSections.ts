export type SettingsSection =
  | 'universe'
  | 'session'
  | 'feed'
  | 'risk'
  | 'mode'
  | 'broker'
  | 'notifications'
  | 'display'
  | 'appearance'
  | 'data'
  | 'activity'

const SETTINGS_SECTIONS: SettingsSection[] = [
  'universe',
  'session',
  'feed',
  'risk',
  'mode',
  'broker',
  'notifications',
  'display',
  'appearance',
  'data',
  'activity',
]

export function isSettingsSection(value: string | null): value is SettingsSection {
  return SETTINGS_SECTIONS.includes(value as SettingsSection)
}
