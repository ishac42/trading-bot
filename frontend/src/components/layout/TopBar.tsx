import { AppBar, Toolbar, Typography, Box, IconButton, Menu, MenuItem } from '@mui/material'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import { MarketStatusIndicator } from '@/components/common'
import { ConnectionStatusIndicator } from '@/components/common'
import { useMarketStatus } from '@/hooks/useMarketStatus'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useState } from 'react'

/**
 * TopBar Component
 * 
 * Application top bar with market status, connection status, and user menu.
 */
const TopBar = () => {
  const { marketStatus, isLoading: isMarketStatusLoading } = useMarketStatus()
  const { isConnected } = useWebSocket()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' },
          }}
        >
          Trading Bot
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 2 },
          }}
        >
          <ConnectionStatusIndicator isConnected={isConnected} />
          <MarketStatusIndicator 
            marketStatus={marketStatus} 
            isLoading={isMarketStatusLoading}
          />
          <IconButton 
            color="inherit" 
            size="small" 
            aria-label="user menu"
            aria-controls={open ? 'user-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            onClick={handleMenuClick}
          >
            <AccountCircleIcon sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
          </IconButton>
          <Menu
            id="user-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleMenuClose}
            MenuListProps={{
              'aria-labelledby': 'user-menu-button',
            }}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={handleMenuClose}>Profile</MenuItem>
            <MenuItem onClick={handleMenuClose}>Settings</MenuItem>
            <MenuItem onClick={handleMenuClose}>Logout</MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default TopBar
