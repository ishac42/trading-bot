import { AppBar, Toolbar, Typography, Box, IconButton } from '@mui/material'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'

const TopBar = () => {
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
          <Typography
            variant="body2"
            sx={{
              display: { xs: 'none', sm: 'block' },
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
            }}
          >
            🟢 Market OPEN
          </Typography>
          <IconButton color="inherit" size="small" aria-label="user menu">
            <AccountCircleIcon sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default TopBar
