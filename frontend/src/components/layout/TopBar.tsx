import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  ListItemIcon,
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import { MarketStatusIndicator } from '@/components/common'
import { ConnectionStatusIndicator } from '@/components/common'
import { useMarketStatus } from '@/hooks/useMarketStatus'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const TopBar = () => {
  const { marketStatus, isLoading: isMarketStatusLoading } = useMarketStatus()
  const { isConnected } = useWebSocket()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleSettings = () => {
    handleMenuClose()
    navigate('/settings')
  }

  const handleLogout = () => {
    handleMenuClose()
    logout()
    navigate('/login')
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
            size="small"
            aria-label="user menu"
            aria-controls={open ? 'user-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            onClick={handleMenuClick}
          >
            <Avatar
              src={user?.avatar_url || undefined}
              alt={user?.name || 'User'}
              sx={{ width: 32, height: 32 }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            id="user-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleMenuClose}
            MenuListProps={{ 'aria-labelledby': 'user-menu-button' }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { minWidth: 200 } } }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2" noWrap>
                {user?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleSettings}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default TopBar
