import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { createTheme } from '@mui/material/styles'
import type { Theme, ThemeOptions } from '@mui/material/styles'

export interface ThemeSettings {
  palette: {
    primary: { main: string }
    success: { main: string }
    warning: { main: string }
    error: { main: string }
    grey: { 500: string }
    background: {
      default: string
      paper: string
    }
  }
  typography: {
    h1: { fontSize: string; fontWeight: string | number }
    h2: { fontSize: string; fontWeight: string | number }
    h3: { fontSize: string; fontWeight: string | number }
    body1: { fontSize: string }
    body2: { fontSize: string }
  }
  spacing: number
  shape: {
    borderRadius: number
  }
}

const defaultThemeSettings: ThemeSettings = {
  palette: {
    primary: { main: '#1976d2' },
    success: { main: '#4caf50' },
    warning: { main: '#ff9800' },
    error: { main: '#f44336' },
    grey: { 500: '#757575' },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    h1: { fontSize: '24px', fontWeight: 'bold' },
    h2: { fontSize: '20px', fontWeight: 'bold' },
    h3: { fontSize: '18px', fontWeight: 'bold' },
    body1: { fontSize: '14px' },
    body2: { fontSize: '12px' },
  },
  spacing: 8,
  shape: {
    borderRadius: 4,
  },
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

interface ThemeContextType {
  theme: Theme
  themeSettings: ThemeSettings
  updateThemeSettings: (settings: DeepPartial<ThemeSettings>) => void
  resetTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'trading-bot-theme-settings'

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    // Load from localStorage or use default
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved) {
        return { ...defaultThemeSettings, ...JSON.parse(saved) }
      }
    } catch (error) {
      console.error('Failed to load theme from localStorage:', error)
    }
    return defaultThemeSettings
  })

  // Save to localStorage whenever theme changes
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeSettings))
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error)
    }
  }, [themeSettings])

  const theme = useMemo(() => {
    const themeOptions: ThemeOptions = {
      palette: {
        primary: {
          main: themeSettings.palette.primary.main,
        },
        success: {
          main: themeSettings.palette.success.main,
        },
        warning: {
          main: themeSettings.palette.warning.main,
        },
        error: {
          main: themeSettings.palette.error.main,
        },
        grey: {
          500: themeSettings.palette.grey[500],
        },
        background: {
          default: themeSettings.palette.background.default,
          paper: themeSettings.palette.background.paper,
        },
      },
      typography: {
        fontFamily: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ].join(','),
        h1: {
          fontSize: themeSettings.typography.h1.fontSize,
          fontWeight: themeSettings.typography.h1.fontWeight,
        },
        h2: {
          fontSize: themeSettings.typography.h2.fontSize,
          fontWeight: themeSettings.typography.h2.fontWeight,
        },
        h3: {
          fontSize: themeSettings.typography.h3.fontSize,
          fontWeight: themeSettings.typography.h3.fontWeight,
        },
        body1: {
          fontSize: themeSettings.typography.body1.fontSize,
        },
        body2: {
          fontSize: themeSettings.typography.body2.fontSize,
        },
      },
      spacing: themeSettings.spacing,
      shape: {
        borderRadius: themeSettings.shape.borderRadius,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
            },
          },
        },
      },
    }

    return createTheme(themeOptions)
  }, [themeSettings])

  const updateThemeSettings = (updates: DeepPartial<ThemeSettings>) => {
    setThemeSettings((prev) => {
      const updated = { ...prev }
      
      if (updates.palette) {
        updated.palette = {
          ...prev.palette,
          ...(updates.palette.primary ? { primary: { ...prev.palette.primary, ...updates.palette.primary } } : {}),
          ...(updates.palette.success ? { success: { ...prev.palette.success, ...updates.palette.success } } : {}),
          ...(updates.palette.warning ? { warning: { ...prev.palette.warning, ...updates.palette.warning } } : {}),
          ...(updates.palette.error ? { error: { ...prev.palette.error, ...updates.palette.error } } : {}),
          background: {
            ...prev.palette.background,
            ...(updates.palette.background || {}),
          },
          grey: {
            ...prev.palette.grey,
            ...(updates.palette.grey || {}),
          },
        }
      }
      
      if (updates.typography) {
        updated.typography = {
          ...prev.typography,
          ...(updates.typography.h1 ? { h1: { ...prev.typography.h1, ...updates.typography.h1 } } : {}),
          ...(updates.typography.h2 ? { h2: { ...prev.typography.h2, ...updates.typography.h2 } } : {}),
          ...(updates.typography.h3 ? { h3: { ...prev.typography.h3, ...updates.typography.h3 } } : {}),
          ...(updates.typography.body1 ? { body1: { ...prev.typography.body1, ...updates.typography.body1 } } : {}),
          ...(updates.typography.body2 ? { body2: { ...prev.typography.body2, ...updates.typography.body2 } } : {}),
        }
      }
      
      if (updates.spacing !== undefined) {
        updated.spacing = updates.spacing
      }
      
      if (updates.shape) {
        updated.shape = {
          ...prev.shape,
          ...updates.shape,
        }
      }
      
      return updated
    })
  }

  const resetTheme = () => {
    setThemeSettings(defaultThemeSettings)
  }

  return (
    <ThemeContext.Provider value={{ theme, themeSettings, updateThemeSettings, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useThemeContext = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider')
  }
  return context
}
