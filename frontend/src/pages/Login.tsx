import { Box, Typography, Paper, Alert } from '@mui/material'
import { GoogleLogin } from '@react-oauth/google'
import type { CredentialResponse } from '@react-oauth/google'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import ShowChartIcon from '@mui/icons-material/ShowChart'

const Login = () => {
  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const handleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      setError('No credential received from Google')
      return
    }

    try {
      setError(null)
      await loginWithGoogle(response.credential)
      navigate('/', { replace: true })
    } catch {
      setError('Authentication failed. Please try again.')
    }
  }

  const handleError = () => {
    setError('Google sign-in was cancelled or failed.')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, sm: 5 },
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          borderRadius: 3,
        }}
      >
        <Box sx={{ mb: 3 }}>
          <ShowChartIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Trading Bot
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Sign in to manage your trading bots, monitor positions, and track
            performance.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            size="large"
            width="320"
            text="signin_with"
            shape="rectangular"
            theme="outline"
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
          By signing in, you agree to let this application access your Google
          profile information (name, email, and profile picture).
        </Typography>
      </Paper>
    </Box>
  )
}

export default Login
