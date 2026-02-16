import { Box, Typography, Paper } from '@mui/material'

const Positions = () => {
  return (
    <Box>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          mb: { xs: 2, sm: 3 },
          fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
          fontWeight: 'bold',
        }}
      >
        Positions
      </Typography>
      <Paper
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          textAlign: 'center',
        }}
      >
        <Typography
          variant="body1"
          sx={{
            fontSize: { xs: '0.875rem', sm: '1rem' },
          }}
        >
          Positions page will be implemented in Sprint 4
        </Typography>
      </Paper>
    </Box>
  )
}

export default Positions
