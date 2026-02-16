import { Box, Tabs, Tab, useMediaQuery, useTheme, Drawer, IconButton, List, ListItem, ListItemButton, ListItemText } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import MenuIcon from '@mui/icons-material/Menu'

const navItems = [
  { label: 'Dashboard', path: '/' },
  { label: 'Bots', path: '/bots' },
  { label: 'Positions', path: '/positions' },
  { label: 'Trades', path: '/trades' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Theme Preview', path: '/theme-preview' },
]

const Navigation = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [value, setValue] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const currentIndex = navItems.findIndex((item) => item.path === location.pathname)
    if (currentIndex !== -1) {
      setValue(currentIndex)
    }
  }, [location.pathname])

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      setValue(newValue)
      navigate(navItems[newValue].path)
      if (isMobile) {
        setMobileOpen(false)
      }
    },
    [navigate, isMobile]
  )

  const handleDrawerToggle = useCallback(() => {
    setMobileOpen((prev) => !prev)
  }, [])

  // Mobile drawer content
  const drawerContent = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center', pt: 2 }}>
      <List>
        {navItems.map((item, index) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={index === value}
              onClick={() => handleChange({} as React.SyntheticEvent, index)}
              sx={{
                textAlign: 'center',
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              }}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      {isMobile ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', px: { xs: 1, sm: 2 }, py: 1 }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
              <Tabs
                value={value}
                onChange={handleChange}
                aria-label="navigation tabs"
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  '& .MuiTab-root': {
                    minWidth: 'auto',
                    px: { xs: 1, sm: 1.5 },
                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  },
                }}
              >
                {navItems.map((item) => (
                  <Tab key={item.path} label={item.label} />
                ))}
              </Tabs>
            </Box>
          </Box>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: 240,
              },
            }}
          >
            {drawerContent}
          </Drawer>
        </>
      ) : (
        <Tabs
          value={value}
          onChange={handleChange}
          aria-label="navigation tabs"
          sx={{
            '& .MuiTab-root': {
              minWidth: { sm: 100, md: 120 },
              fontSize: { sm: '0.875rem', md: '1rem' },
            },
          }}
        >
          {navItems.map((item) => (
            <Tab key={item.path} label={item.label} />
          ))}
        </Tabs>
      )}
    </Box>
  )
}

export default Navigation
