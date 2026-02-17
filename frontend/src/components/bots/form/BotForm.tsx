import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Box,
  Divider,
  Alert,
  Typography,
} from '@mui/material'
import { Button, Modal } from '@/components/common'
import { BasicInfoSection } from './BasicInfoSection'
import { SymbolSelector } from './SymbolSelector'
import { TradingWindowSection } from './TradingWindowSection'
import { IndicatorConfigSection } from './IndicatorConfigSection'
import { RiskManagementSection } from './RiskManagementSection'
import { useLocalStorageForm } from '@/hooks/useLocalStorageForm'
import type { BotFormData, RiskManagement, Bot } from '@/types'

/** Default form data for a new bot */
const DEFAULT_FORM_DATA: BotFormData = {
  name: '',
  capital: 10000,
  trading_frequency: 60,
  symbols: [],
  start_hour: 9,
  start_minute: 30,
  end_hour: 12,
  end_minute: 0,
  indicators: {},
  risk_management: {
    stop_loss: 2.0,
    take_profit: 5.0,
    max_position_size: 10,
    max_daily_loss: 10,
    max_concurrent_positions: 3,
  },
}

interface BotFormProps {
  /** Existing bot data when editing (undefined for create) */
  initialData?: Bot
  /** Called when the form is submitted */
  onSubmit: (data: BotFormData) => Promise<void>
  /** Called when user cancels */
  onCancel: () => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
  /** Submit button label */
  submitLabel?: string
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Validate a single field and return an error string or empty string */
function validateField(
  field: string,
  formData: BotFormData
): string {
  switch (field) {
    case 'name':
      return formData.name.trim() ? '' : 'Bot name is required'
    case 'capital':
      return formData.capital > 0 ? '' : 'Capital must be greater than 0'
    case 'trading_frequency':
      return formData.trading_frequency >= 5
        ? ''
        : 'Frequency must be at least 5 seconds'
    case 'symbols':
      return formData.symbols.length > 0 ? '' : 'Select at least one symbol'
    case 'trading_window': {
      const startMin = formData.start_hour * 60 + formData.start_minute
      const endMin = formData.end_hour * 60 + formData.end_minute
      return endMin > startMin ? '' : 'End time must be after start time'
    }
    case 'indicators':
      return Object.keys(formData.indicators).length > 0
        ? ''
        : 'Select at least one indicator'
    case 'stop_loss':
      return formData.risk_management.stop_loss > 0
        ? ''
        : 'Must be greater than 0'
    case 'take_profit':
      return formData.risk_management.take_profit > 0
        ? ''
        : 'Must be greater than 0'
    case 'max_position_size': {
      const v = formData.risk_management.max_position_size
      return v > 0 && v <= 100 ? '' : 'Must be between 1% and 100%'
    }
    case 'max_daily_loss': {
      const v = formData.risk_management.max_daily_loss
      return v > 0 && v <= 100 ? '' : 'Must be between 1% and 100%'
    }
    case 'max_concurrent_positions':
      return (formData.risk_management.max_concurrent_positions ?? 0) >= 1
        ? ''
        : 'Must be at least 1'
    default:
      return ''
  }
}

/** Validate entire form, returning all errors */
function validateAll(formData: BotFormData): Record<string, string> {
  const fields = [
    'name',
    'capital',
    'trading_frequency',
    'symbols',
    'trading_window',
    'indicators',
    'stop_loss',
    'take_profit',
    'max_position_size',
    'max_daily_loss',
    'max_concurrent_positions',
  ]
  const errors: Record<string, string> = {}
  for (const f of fields) {
    const msg = validateField(f, formData)
    if (msg) errors[f] = msg
  }
  return errors
}

/**
 * BotForm – Full bot creation/editing form combining all sections.
 * Handles state management, real-time validation, auto-save to
 * localStorage, and an unsaved-changes confirmation modal.
 */
export const BotForm: React.FC<BotFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Save Bot',
}) => {
  // Build initial form data from existing bot or defaults
  const buildInitial = useCallback((): BotFormData => {
    if (!initialData) return { ...DEFAULT_FORM_DATA }
    return {
      name: initialData.name,
      capital: initialData.capital,
      trading_frequency: initialData.trading_frequency,
      symbols: [...initialData.symbols],
      start_hour: initialData.start_hour,
      start_minute: initialData.start_minute,
      end_hour: initialData.end_hour,
      end_minute: initialData.end_minute,
      indicators: JSON.parse(JSON.stringify(initialData.indicators)),
      risk_management: { ...initialData.risk_management },
    }
  }, [initialData])

  // Auto-save key: different for create vs edit
  const storageKey = initialData ? `bot-edit-${initialData.id}` : 'bot-create'

  const [formData, setFormData, clearSaved, hasSavedData] =
    useLocalStorageForm<BotFormData>(storageKey, buildInitial())

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [showRestoredBanner, setShowRestoredBanner] = useState(hasSavedData)

  // Track which fields the user has interacted with (for real-time validation)
  const touchedRef = useRef<Set<string>>(new Set())

  // Reset form when initialData changes (e.g. loading edit data)
  useEffect(() => {
    // Only reset if there's no saved data being restored
    if (!hasSavedData) {
      setFormData(buildInitial())
    }
    setErrors({})
    setIsDirty(false)
    touchedRef.current.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id])

  // ---- Real-time validation for touched fields ----

  const revalidateTouched = useCallback(
    (newData: BotFormData) => {
      const touched = touchedRef.current
      if (touched.size === 0) return
      setErrors((prev) => {
        const next = { ...prev }
        touched.forEach((field) => {
          const msg = validateField(field, newData)
          if (msg) {
            next[field] = msg
          } else {
            delete next[field]
          }
        })
        return next
      })
    },
    []
  )

  // ---- Field change handlers ----

  const handleBasicChange = useCallback(
    (field: string, value: string | number) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value }
        touchedRef.current.add(field)
        revalidateTouched(next)
        return next
      })
      setIsDirty(true)
    },
    [setFormData, revalidateTouched]
  )

  const handleSymbolsChange = useCallback(
    (symbols: string[]) => {
      setFormData((prev) => {
        const next = { ...prev, symbols }
        touchedRef.current.add('symbols')
        revalidateTouched(next)
        return next
      })
      setIsDirty(true)
    },
    [setFormData, revalidateTouched]
  )

  const handleTimeChange = useCallback(
    (field: string, value: number) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value }
        touchedRef.current.add('trading_window')
        revalidateTouched(next)
        return next
      })
      setIsDirty(true)
    },
    [setFormData, revalidateTouched]
  )

  const handleIndicatorsChange = useCallback(
    (indicators: Record<string, Record<string, number>>) => {
      setFormData((prev) => {
        const next = { ...prev, indicators }
        touchedRef.current.add('indicators')
        revalidateTouched(next)
        return next
      })
      setIsDirty(true)
    },
    [setFormData, revalidateTouched]
  )

  const handleRiskChange = useCallback(
    (field: keyof RiskManagement, value: number) => {
      setFormData((prev) => {
        const next = {
          ...prev,
          risk_management: { ...prev.risk_management, [field]: value },
        }
        touchedRef.current.add(field)
        revalidateTouched(next)
        return next
      })
      setIsDirty(true)
    },
    [setFormData, revalidateTouched]
  )

  // ---- Submit ----

  const handleSubmit = useCallback(async () => {
    setSubmitError(null)

    // Mark all fields as touched so validation shows everywhere
    const allFields = [
      'name', 'capital', 'trading_frequency', 'symbols',
      'trading_window', 'indicators', 'stop_loss',
      'take_profit', 'max_position_size', 'max_daily_loss', 'max_concurrent_positions',
    ]
    allFields.forEach((f) => touchedRef.current.add(f))

    const newErrors = validateAll(formData)
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    try {
      await onSubmit(formData)
      setIsDirty(false)
      clearSaved()
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save bot. Please try again.'
      )
    }
  }, [formData, onSubmit, clearSaved])

  // ---- Cancel with unsaved changes modal ----

  const handleCancel = useCallback(() => {
    if (isDirty) {
      setShowUnsavedModal(true)
    } else {
      clearSaved()
      onCancel()
    }
  }, [isDirty, onCancel, clearSaved])

  const handleDiscardAndLeave = useCallback(() => {
    setShowUnsavedModal(false)
    clearSaved()
    onCancel()
  }, [onCancel, clearSaved])

  // ---- Discard restored data ----

  const handleDiscardRestored = useCallback(() => {
    setFormData(buildInitial())
    clearSaved()
    setShowRestoredBanner(false)
    setIsDirty(false)
    touchedRef.current.clear()
    setErrors({})
  }, [buildInitial, clearSaved, setFormData])

  // Error count for the submit area
  const errorCount = useMemo(
    () => Object.keys(errors).length,
    [errors]
  )

  return (
    <Box>
      {/* Restored-data banner */}
      {showRestoredBanner && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          onClose={() => setShowRestoredBanner(false)}
          action={
            <Button variant="text" size="small" onClick={handleDiscardRestored}>
              Discard
            </Button>
          }
        >
          We restored your unsaved changes from a previous session.
        </Alert>
      )}

      {submitError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Section 1: Basic Info */}
        <BasicInfoSection
          name={formData.name}
          capital={formData.capital}
          tradingFrequency={formData.trading_frequency}
          errors={errors}
          onChange={handleBasicChange}
        />

        <Divider />

        {/* Section 2: Symbols */}
        <SymbolSelector
          symbols={formData.symbols}
          onChange={handleSymbolsChange}
          error={errors.symbols}
        />

        <Divider />

        {/* Section 3: Trading Window */}
        <TradingWindowSection
          startHour={formData.start_hour}
          startMinute={formData.start_minute}
          endHour={formData.end_hour}
          endMinute={formData.end_minute}
          errors={errors}
          onChange={handleTimeChange}
        />

        <Divider />

        {/* Section 4: Indicators */}
        <IndicatorConfigSection
          indicators={formData.indicators}
          onChange={handleIndicatorsChange}
          error={errors.indicators}
        />

        <Divider />

        {/* Section 5: Risk Management */}
        <RiskManagementSection
          riskManagement={formData.risk_management}
          errors={errors}
          onChange={handleRiskChange}
        />
      </Box>

      {/* Action Buttons */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mt: 4,
          pt: 3,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {/* Validation summary */}
        {errorCount > 0 && (
          <Typography variant="body2" color="error">
            {errorCount} validation {errorCount === 1 ? 'error' : 'errors'} remaining
          </Typography>
        )}

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
            ml: { sm: 'auto' },
          }}
        >
          <Button variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
          >
            {submitLabel}
          </Button>
        </Box>
      </Box>

      {/* Unsaved Changes Modal */}
      <Modal
        open={showUnsavedModal}
        onClose={() => setShowUnsavedModal(false)}
        title="Unsaved Changes"
        maxWidth="xs"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowUnsavedModal(false)}>
              Keep Editing
            </Button>
            <Button variant="danger" onClick={handleDiscardAndLeave}>
              Discard & Leave
            </Button>
          </>
        }
      >
        <Typography>
          You have unsaved changes. Are you sure you want to leave? Your changes will
          be lost.
        </Typography>
      </Modal>
    </Box>
  )
}
