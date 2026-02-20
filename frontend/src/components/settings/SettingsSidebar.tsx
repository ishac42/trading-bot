import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  useMediaQuery,
  useTheme,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import NotificationsIcon from '@mui/icons-material/Notifications'
import DisplaySettingsIcon from '@mui/icons-material/DisplaySettings'
import PaletteIcon from '@mui/icons-material/Palette'
import StorageIcon from '@mui/icons-material/Storage'

export type SettingsSection =
  | 'broker'
  | 'notifications'
  | 'display'
  | 'appearance'
  | 'data'

interface SectionItem {
  id: SettingsSection
  label: string
  icon: React.ReactNode
}

const sections: SectionItem[] = [
  { id: 'broker', label: 'Broker Connection', icon: <VpnKeyIcon /> },
  { id: 'notifications', label: 'Notifications', icon: <NotificationsIcon /> },
  { id: 'display', label: 'Display', icon: <DisplaySettingsIcon /> },
  { id: 'appearance', label: 'Appearance', icon: <PaletteIcon /> },
  { id: 'data', label: 'Data Management', icon: <StorageIcon /> },
]

interface SettingsSidebarProps {
  active: SettingsSection
  onChange: (section: SettingsSection) => void
}

const SettingsSidebar = ({ active, onChange }: SettingsSidebarProps) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  if (isMobile) {
    return (
      <FormControl fullWidth sx={{ mb: 2 }}>
        <Select
          value={active}
          onChange={(e) => onChange(e.target.value as SettingsSection)}
          size="small"
        >
          {sections.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    )
  }

  return (
    <Paper sx={{ width: 240, flexShrink: 0 }}>
      <List disablePadding>
        {sections.map((s) => (
          <ListItemButton
            key={s.id}
            selected={active === s.id}
            onClick={() => onChange(s.id)}
            sx={{ py: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{s.icon}</ListItemIcon>
            <ListItemText primary={s.label} />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  )
}

export default SettingsSidebar
