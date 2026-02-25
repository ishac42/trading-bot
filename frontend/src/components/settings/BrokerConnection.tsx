import { useState } from 'react'
import {
  Box,
  Typography,
  Link,
  TextField,
  Button,
  Alert,
  Chip,
  InputAdornment,
  IconButton,
  FormControlLabel,
  Switch,
  CircularProgress,
  Paper,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import type { BrokerSettingsResponse, BrokerTestResult } from '@/types'
import type { UseMutationResult } from '@tanstack/react-query'

interface BrokerConnectionProps {
  broker: BrokerSettingsResponse | undefined
  updateBroker: UseMutationResult<any, Error, any>
  testBroker: UseMutationResult<BrokerTestResult, Error, void>
}

const BrokerConnection = ({ broker, updateBroker, testBroker }: BrokerConnectionProps) => {
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [isPaper, setIsPaper] = useState(broker?.is_paper ?? true)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await updateBroker.mutateAsync({
      alpaca_api_key: apiKey,
      alpaca_secret_key: secretKey,
      base_url: isPaper
        ? 'https://paper-api.alpaca.markets'
        : 'https://api.alpaca.markets',
      is_paper: isPaper,
    })
    setApiKey('')
    setSecretKey('')
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleTest = () => {
    testBroker.mutate()
  }

  const testResult = testBroker.data

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Broker Connection
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure your Alpaca brokerage API credentials. These are stored
        securely and used to execute trades and fetch account data.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Go to{' '}
        <Link href="https://app.alpaca.markets/" target="_blank" rel="noopener noreferrer">
          Alpaca
        </Link>{' '}
        wesbiste to create an account and link here.
      </Typography>

      {/* Connection Status */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2">Status:</Typography>
        {broker?.is_connected ? (
          <Chip
            icon={<CheckCircleIcon />}
            label="Connected"
            color="success"
            size="small"
          />
        ) : (
          <Chip
            icon={<ErrorIcon />}
            label="Not Connected"
            color="default"
            size="small"
          />
        )}
        {broker?.last_verified && (
          <Typography variant="caption" color="text.secondary">
            Last verified: {new Date(broker.last_verified).toLocaleString()}
          </Typography>
        )}
      </Box>

      {/* API Keys */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <TextField
          label="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={broker?.alpaca_api_key_masked || 'Enter your Alpaca API key'}
          type={showApiKey ? 'text' : 'password'}
          fullWidth
          size="small"
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowApiKey(!showApiKey)}
                    edge="end"
                    size="small"
                  >
                    {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          label="Secret Key"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder={broker?.alpaca_secret_key_masked || 'Enter your Alpaca secret key'}
          type={showSecretKey ? 'text' : 'password'}
          fullWidth
          size="small"
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    edge="end"
                    size="small"
                  >
                    {showSecretKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {/* Paper/Live Toggle */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={isPaper}
              onChange={(e) => setIsPaper(e.target.checked)}
              color="primary"
            />
          }
          label={
            <Box>
              <Typography variant="subtitle2">
                Paper Trading {isPaper ? '(Active)' : '(Inactive)'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isPaper
                  ? 'Using simulated money — no real trades will be executed'
                  : 'WARNING: Live trading with real money'}
              </Typography>
            </Box>
          }
        />
        {!isPaper && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Live trading mode will execute real trades with real money. Make sure
            your risk management is properly configured.
          </Alert>
        )}
      </Paper>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={updateBroker.isPending || (!apiKey && !secretKey)}
        >
          {updateBroker.isPending ? <CircularProgress size={20} /> : 'Save Credentials'}
        </Button>
        <Button
          variant="outlined"
          onClick={handleTest}
          disabled={testBroker.isPending}
        >
          {testBroker.isPending ? <CircularProgress size={20} /> : 'Test Connection'}
        </Button>
      </Box>

      {/* Feedback */}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Credentials saved successfully.</Alert>}
      {updateBroker.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to save credentials. Please try again.</Alert>
      )}
      {testResult && (
        <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
          <Typography variant="subtitle2">{testResult.message}</Typography>
          {testResult.success && testResult.equity != null && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Account: {testResult.account_id} | Equity: $
              {testResult.equity?.toLocaleString()} | Buying Power: $
              {testResult.buying_power?.toLocaleString()}
            </Typography>
          )}
        </Alert>
      )}
    </Box>
  )
}

export default BrokerConnection
