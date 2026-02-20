import {
  Box,
  Typography,
  Button,
  Slider,
  Paper,
  Chip,
  Alert,
} from '@mui/material'
import { useThemeContext } from '@/contexts/ThemeContext'

const colorFields = [
  { key: 'primary', label: 'Primary' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'error', label: 'Error' },
] as const

const bgFields = [
  { key: 'default', label: 'Background' },
  { key: 'paper', label: 'Paper / Card' },
] as const

const AppearanceSettings = () => {
  const { themeSettings, updateThemeSettings, resetTheme } = useThemeContext()

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Appearance
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Customize the look and feel of the application. Changes are applied
        instantly and saved to your browser.
      </Typography>

      {/* Brand Colors */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Brand Colors
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {colorFields.map(({ key, label }) => (
          <Paper
            key={key}
            variant="outlined"
            sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}
          >
            <input
              type="color"
              value={themeSettings.palette[key].main}
              onChange={(e) =>
                updateThemeSettings({
                  palette: { [key]: { main: e.target.value } },
                })
              }
              style={{
                width: 36,
                height: 36,
                border: 'none',
                cursor: 'pointer',
                borderRadius: 4,
              }}
            />
            <Typography variant="body2">{label}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Background Colors */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Background Colors
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {bgFields.map(({ key, label }) => (
          <Paper
            key={key}
            variant="outlined"
            sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}
          >
            <input
              type="color"
              value={themeSettings.palette.background[key]}
              onChange={(e) =>
                updateThemeSettings({
                  palette: { background: { [key]: e.target.value } },
                })
              }
              style={{
                width: 36,
                height: 36,
                border: 'none',
                cursor: 'pointer',
                borderRadius: 4,
              }}
            />
            <Typography variant="body2">{label}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Spacing */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Spacing ({themeSettings.spacing}px)
      </Typography>
      <Slider
        value={themeSettings.spacing}
        onChange={(_, val) => updateThemeSettings({ spacing: val as number })}
        min={4}
        max={16}
        step={1}
        marks
        sx={{ maxWidth: 300, mb: 3 }}
      />

      {/* Border Radius */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Border Radius ({themeSettings.shape.borderRadius}px)
      </Typography>
      <Slider
        value={themeSettings.shape.borderRadius}
        onChange={(_, val) =>
          updateThemeSettings({ shape: { borderRadius: val as number } })
        }
        min={0}
        max={24}
        step={1}
        marks
        sx={{ maxWidth: 300, mb: 3 }}
      />

      {/* Preview */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Preview
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Chip label="Primary" color="primary" />
          <Chip label="Success" color="success" />
          <Chip label="Warning" color="warning" />
          <Chip label="Error" color="error" />
        </Box>
        <Alert severity="info" sx={{ mb: 1 }}>
          This is an informational alert.
        </Alert>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" size="small">
            Contained
          </Button>
          <Button variant="outlined" size="small">
            Outlined
          </Button>
          <Button variant="text" size="small">
            Text
          </Button>
        </Box>
      </Paper>

      <Button variant="outlined" color="error" onClick={resetTheme}>
        Reset to Defaults
      </Button>
    </Box>
  )
}

export default AppearanceSettings
