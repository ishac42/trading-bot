import { useState } from 'react'
import { Box, Typography, CircularProgress, Paper } from '@mui/material'
import SettingsSidebar from '@/components/settings/SettingsSidebar'
import type { SettingsSection } from '@/components/settings/SettingsSidebar'
import BrokerConnection from '@/components/settings/BrokerConnection'
import NotificationSettings from '@/components/settings/NotificationSettings'
import DisplayPreferences from '@/components/settings/DisplayPreferences'
import AppearanceSettings from '@/components/settings/AppearanceSettings'
import DataManagement from '@/components/settings/DataManagement'
import { useSettings } from '@/hooks/useSettings'

const Settings = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('broker')

  const {
    settings,
    isLoading,
    dataStats,
    isLoadingStats,
    updateBroker,
    updateNotifications,
    updateDisplay,
    testBroker,
    exportTrades,
    exportPositions,
    clearTrades,
    resetSettings,
  } = useSettings()

  const renderSection = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )
    }

    switch (activeSection) {
      case 'broker':
        return (
          <BrokerConnection
            broker={settings?.broker}
            updateBroker={updateBroker}
            testBroker={testBroker}
          />
        )
      case 'notifications':
        return (
          <NotificationSettings
            notifications={settings?.notifications}
            updateNotifications={updateNotifications}
          />
        )
      case 'display':
        return (
          <DisplayPreferences
            display={settings?.display}
            updateDisplay={updateDisplay}
          />
        )
      case 'appearance':
        return <AppearanceSettings />
      case 'data':
        return (
          <DataManagement
            dataStats={dataStats}
            isLoadingStats={isLoadingStats}
            exportTrades={exportTrades}
            exportPositions={exportPositions}
            clearTrades={clearTrades}
            resetSettings={resetSettings}
          />
        )
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
        }}
      >
        <SettingsSidebar active={activeSection} onChange={setActiveSection} />

        <Paper sx={{ flex: 1, p: { xs: 2, sm: 3 }, minHeight: 400 }}>
          {renderSection()}
        </Paper>
      </Box>
    </Box>
  )
}

export default Settings
