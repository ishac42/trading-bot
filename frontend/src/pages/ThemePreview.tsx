import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Stack,
  Divider,
  TextField,
  Slider,
  InputAdornment,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useThemeContext } from '@/contexts/ThemeContext'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

const ThemePreview = () => {
  const theme = useTheme()
  const { themeSettings, updateThemeSettings, resetTheme } = useThemeContext()

  const handleColorChange = (path: string, value: string) => {
    if (path === 'palette.background.default') {
      updateThemeSettings({
        palette: {
          background: {
            default: value,
          },
        },
      })
    } else if (path === 'palette.background.paper') {
      updateThemeSettings({
        palette: {
          background: {
            paper: value,
          },
        },
      })
    } else if (path === 'palette.grey') {
      updateThemeSettings({
        palette: {
          grey: { 500: value },
        },
      })
    } else {
      const key = path.split('.')[1] as 'primary' | 'success' | 'warning' | 'error'
      updateThemeSettings({
        palette: {
          [key]: { main: value },
        },
      })
    }
  }

  const handleTypographyChange = (variant: string, property: 'fontSize' | 'fontWeight', value: string | number) => {
    updateThemeSettings({
      typography: {
        [variant]: {
          [property]: value,
        },
      },
    })
  }

  const handleSpacingChange = (value: number) => {
    updateThemeSettings({ spacing: value })
  }

  const handleBorderRadiusChange = (value: number) => {
    updateThemeSettings({
      shape: {
        borderRadius: value,
      },
    })
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h1" gutterBottom>
            Theme Customizer
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Customize your theme settings and see changes applied instantly across the entire website
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={resetTheme}
          sx={{ minWidth: 150 }}
        >
          Reset to Default
        </Button>
      </Box>

      {/* Color Palette */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h2" gutterBottom>
          Color Palette
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 0 }}>
            <Box
              sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                p: 2,
                borderRadius: 1,
                mb: 1,
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Primary
            </Box>
            <TextField
              fullWidth
              size="small"
              type="color"
              label="Primary Color"
              value={themeSettings.palette.primary.main}
              onChange={(e) => handleColorChange('palette.primary', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        bgcolor: themeSettings.palette.primary.main,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 0.5,
                      }}
                    />
                  </InputAdornment>
                ),
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {themeSettings.palette.primary.main}
            </Typography>
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 0 }}>
            <Box
              sx={{
                bgcolor: 'success.main',
                color: 'success.contrastText',
                p: 2,
                borderRadius: 1,
                mb: 1,
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Success
            </Box>
            <TextField
              fullWidth
              size="small"
              type="color"
              label="Success Color"
              value={themeSettings.palette.success.main}
              onChange={(e) => handleColorChange('palette.success', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        bgcolor: themeSettings.palette.success.main,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 0.5,
                      }}
                    />
                  </InputAdornment>
                ),
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {themeSettings.palette.success.main}
            </Typography>
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 0 }}>
            <Box
              sx={{
                bgcolor: 'warning.main',
                color: 'warning.contrastText',
                p: 2,
                borderRadius: 1,
                mb: 1,
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Warning
            </Box>
            <TextField
              fullWidth
              size="small"
              type="color"
              label="Warning Color"
              value={themeSettings.palette.warning.main}
              onChange={(e) => handleColorChange('palette.warning', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        bgcolor: themeSettings.palette.warning.main,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 0.5,
                      }}
                    />
                  </InputAdornment>
                ),
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {themeSettings.palette.warning.main}
            </Typography>
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 0 }}>
            <Box
              sx={{
                bgcolor: 'error.main',
                color: 'error.contrastText',
                p: 2,
                borderRadius: 1,
                mb: 1,
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Error
            </Box>
            <TextField
              fullWidth
              size="small"
              type="color"
              label="Error Color"
              value={themeSettings.palette.error.main}
              onChange={(e) => handleColorChange('palette.error', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        bgcolor: themeSettings.palette.error.main,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 0.5,
                      }}
                    />
                  </InputAdornment>
                ),
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {themeSettings.palette.error.main}
            </Typography>
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 0 }}>
            <Box
              sx={{
                bgcolor: 'grey.500',
                color: 'background.paper',
                p: 2,
                borderRadius: 1,
                mb: 1,
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Grey 500
            </Box>
            <TextField
              fullWidth
              size="small"
              type="color"
              label="Grey 500"
              value={themeSettings.palette.grey[500]}
              onChange={(e) => handleColorChange('palette.grey', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        bgcolor: themeSettings.palette.grey[500],
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 0.5,
                      }}
                    />
                  </InputAdornment>
                ),
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {themeSettings.palette.grey[500]}
            </Typography>
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 0 }}>
            <Box
              sx={{
                bgcolor: 'background.default',
                border: 1,
                borderColor: 'divider',
                p: 2,
                borderRadius: 1,
                mb: 1,
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Background Default
            </Box>
            <TextField
              fullWidth
              size="small"
              type="color"
              label="Background Default"
              value={themeSettings.palette.background.default}
              onChange={(e) => handleColorChange('palette.background.default', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        bgcolor: themeSettings.palette.background.default,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 0.5,
                      }}
                    />
                  </InputAdornment>
                ),
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {themeSettings.palette.background.default}
            </Typography>
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 0 }}>
            <Box
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                p: 2,
                borderRadius: 1,
                mb: 1,
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Background Paper
            </Box>
            <TextField
              fullWidth
              size="small"
              type="color"
              label="Background Paper"
              value={themeSettings.palette.background.paper}
              onChange={(e) => handleColorChange('palette.background.paper', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        bgcolor: themeSettings.palette.background.paper,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 0.5,
                      }}
                    />
                  </InputAdornment>
                ),
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {themeSettings.palette.background.paper}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Typography */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h2" gutterBottom>
          Typography
        </Typography>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h1" gutterBottom>
              Heading 1 (h1)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Font Size (px)"
                  type="number"
                  value={parseInt(themeSettings.typography.h1.fontSize)}
                  onChange={(e) =>
                    handleTypographyChange('h1', 'fontSize', `${e.target.value}px`)
                  }
                  inputProps={{ min: 12, max: 48 }}
                />
              </Box>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Font Weight"
                  select
                  SelectProps={{ native: true }}
                  value={themeSettings.typography.h1.fontWeight}
                  onChange={(e) =>
                    handleTypographyChange('h1', 'fontWeight', e.target.value)
                  }
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="300">Light (300)</option>
                  <option value="400">Regular (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">Semi-bold (600)</option>
                  <option value="700">Bold (700)</option                >
                </TextField>
              </Box>
            </Box>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h2" gutterBottom>
              Heading 2 (h2)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Font Size (px)"
                  type="number"
                  value={parseInt(themeSettings.typography.h2.fontSize)}
                  onChange={(e) =>
                    handleTypographyChange('h2', 'fontSize', `${e.target.value}px`)
                  }
                  inputProps={{ min: 12, max: 48 }}
                />
              </Box>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Font Weight"
                  select
                  SelectProps={{ native: true }}
                  value={themeSettings.typography.h2.fontWeight}
                  onChange={(e) =>
                    handleTypographyChange('h2', 'fontWeight', e.target.value)
                  }
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="300">Light (300)</option>
                  <option value="400">Regular (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">Semi-bold (600)</option>
                  <option value="700">Bold (700)</option                >
                </TextField>
              </Box>
            </Box>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h3" gutterBottom>
              Heading 3 (h3)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Font Size (px)"
                  type="number"
                  value={parseInt(themeSettings.typography.h3.fontSize)}
                  onChange={(e) =>
                    handleTypographyChange('h3', 'fontSize', `${e.target.value}px`)
                  }
                  inputProps={{ min: 12, max: 48 }}
                />
              </Box>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Font Weight"
                  select
                  SelectProps={{ native: true }}
                  value={themeSettings.typography.h3.fontWeight}
                  onChange={(e) =>
                    handleTypographyChange('h3', 'fontWeight', e.target.value)
                  }
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="300">Light (300)</option>
                  <option value="400">Regular (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">Semi-bold (600)</option>
                  <option value="700">Bold (700)</option                >
                </TextField>
              </Box>
            </Box>
          </Box>
          <Divider />
          <Box>
            <Typography variant="body1" gutterBottom>
              Body 1 (body1) - This is the default body text style.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Font Size (px)"
                  type="number"
                  value={parseInt(themeSettings.typography.body1.fontSize)}
                  onChange={(e) =>
                    handleTypographyChange('body1', 'fontSize', `${e.target.value}px`)
                  }
                  inputProps={{ min: 10, max: 24 }}
                />
              </Box>
            </Box>
          </Box>
          <Divider />
          <Box>
            <Typography variant="body2" gutterBottom>
              Body 2 (body2) - This is smaller body text.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Font Size (px)"
                  type="number"
                  value={parseInt(themeSettings.typography.body2.fontSize)}
                  onChange={(e) =>
                    handleTypographyChange('body2', 'fontSize', `${e.target.value}px`)
                  }
                  inputProps={{ min: 8, max: 20 }}
                />
              </Box>
            </Box>
          </Box>
        </Stack>
      </Paper>

      {/* Buttons Preview */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h2" gutterBottom>
          Buttons Preview
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Button variant="contained" color="primary">
            Primary Contained
          </Button>
          <Button variant="contained" color="success">
            Success Contained
          </Button>
          <Button variant="contained" color="warning">
            Warning Contained
          </Button>
          <Button variant="contained" color="error">
            Error Contained
          </Button>
          <Button variant="outlined" color="primary">
            Primary Outlined
          </Button>
          <Button variant="outlined" color="success">
            Success Outlined
          </Button>
          <Button variant="text" color="primary">
            Primary Text
          </Button>
          <Button variant="text" color="success">
            Success Text
          </Button>
        </Stack>
      </Paper>

      {/* Spacing */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h2" gutterBottom>
          Spacing
        </Typography>
        <Typography variant="body1" gutterBottom>
          Base spacing unit: {theme.spacing(1)} ({themeSettings.spacing}px)
        </Typography>
        <Box sx={{ mt: 3, px: 2 }}>
          <Typography variant="body2" gutterBottom>
            Spacing Base Unit (px)
          </Typography>
          <Slider
            value={themeSettings.spacing}
            onChange={(_, value) => handleSpacingChange(value as number)}
            min={4}
            max={16}
            step={1}
            marks
            valueLabelDisplay="auto"
          />
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          {[1, 2, 3, 4, 5].map((multiplier) => (
            <Box key={multiplier}>
              <Box
                sx={{
                  width: theme.spacing(multiplier),
                  height: theme.spacing(multiplier),
                  bgcolor: 'primary.main',
                  borderRadius: 0.5,
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, textAlign: 'center' }}>
                {multiplier}x
              </Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* Border Radius */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h2" gutterBottom>
          Border Radius
        </Typography>
        <Typography variant="body1" gutterBottom>
          Default border radius: {themeSettings.shape.borderRadius}px
        </Typography>
        <Box sx={{ mt: 3, px: 2 }}>
          <Typography variant="body2" gutterBottom>
            Border Radius (px)
          </Typography>
          <Slider
            value={themeSettings.shape.borderRadius}
            onChange={(_, value) => handleBorderRadiusChange(value as number)}
            min={0}
            max={24}
            step={1}
            marks
            valueLabelDisplay="auto"
          />
        </Box>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Box
            sx={{
              width: 100,
              height: 100,
              bgcolor: 'primary.main',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            Box
          </Box>
          <Chip label="Chip" color="primary" />
          <Button variant="contained" color="primary">
            Button
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}

export default ThemePreview
