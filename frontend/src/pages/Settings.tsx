import { useSearchParams } from 'react-router-dom'
import { Box, CircularProgress, Paper, Typography } from '@mui/material'
import SettingsSidebar from '@/components/settings/SettingsSidebar'
import { isSettingsSection } from '@/components/settings/settingsSections'
import type { SettingsSection } from '@/components/settings/settingsSections'
import BrokerConnection from '@/components/settings/BrokerConnection'
import NotificationSettings from '@/components/settings/NotificationSettings'
import DisplayPreferences from '@/components/settings/DisplayPreferences'
import AppearanceSettings from '@/components/settings/AppearanceSettings'
import DataManagement from '@/components/settings/DataManagement'
import ActivityLogPanel from '@/components/settings/ActivityLogPanel'
import UniverseFilters from '@/components/settings/UniverseFilters'
import UniversePreview from '@/components/settings/UniversePreview'
import SessionSettings from '@/components/settings/SessionSettings'
import FeedSettings from '@/components/settings/FeedSettings'
import RiskCaps from '@/components/settings/RiskCaps'
import AccountModeSettings from '@/components/settings/AccountModeSettings'
import { useSettings } from '@/hooks/useSettings'
import { useBook } from '@/hooks/useBook'

const CONTROL_SECTIONS: SettingsSection[] = ['universe', 'session', 'feed', 'risk', 'mode', 'appearance', 'activity']

const Settings = () => {
  const [params, setParams] = useSearchParams()
  const sectionParam = params.get('section')
  const activeSection: SettingsSection = isSettingsSection(sectionParam) ? sectionParam : 'universe'
  const book = useBook()

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

  const setSection = (section: SettingsSection) => {
    setParams({ section })
  }

  const renderSection = () => {
    const needsBrokerSettings = !CONTROL_SECTIONS.includes(activeSection)
    if (needsBrokerSettings && isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )
    }

    switch (activeSection) {
      case 'universe':
        return (
          <>
            <UniverseFilters filters={book.universe} />
            <UniversePreview snapshot={book.snapshot} />
          </>
        )
      case 'session':
        return <SessionSettings session={book.session} />
      case 'feed':
        return <FeedSettings feed={book.feed} feeTier={book.feeTier} />
      case 'risk':
        return <RiskCaps risk={book.risk} killSwitch={book.summary.kill_switch} />
      case 'mode':
        return <AccountModeSettings mode={book.mode} />
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
      case 'activity':
        return <ActivityLogPanel />
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
        <SettingsSidebar active={activeSection} onChange={setSection} />

        <Paper sx={{ flex: 1, p: { xs: 2, sm: 3 }, minHeight: 400 }}>
          {renderSection()}
        </Paper>
      </Box>
    </Box>
  )
}

export default Settings
