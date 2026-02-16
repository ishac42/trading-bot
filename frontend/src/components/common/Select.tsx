import React from 'react'
import {
  FormControl,
  InputLabel,
  Select as MuiSelect,
  MenuItem,
  FormHelperText,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/system'
import { RequiredIndicator } from './Input.styles'

type MuiSelectProps = React.ComponentProps<typeof MuiSelect>

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<MuiSelectProps, 'variant'> {
  label: string
  options: SelectOption[]
  required?: boolean
  showRequiredIndicator?: boolean
  error?: boolean
  helperText?: string
  placeholder?: string
  sx?: SxProps<Theme>
}

/**
 * Select Component
 * 
 * Extended MUI Select with consistent styling and error handling.
 * 
 * @example
 * ```tsx
 * <Select
 *   label="Symbol"
 *   options={symbols}
 *   value={selectedSymbol}
 *   onChange={handleChange}
 * />
 * ```
 */
export const Select: React.FC<SelectProps> = ({
  label,
  options,
  required = false,
  showRequiredIndicator = true,
  error = false,
  helperText,
  placeholder,
  value,
  sx,
  ...props
}) => {
  const displayLabel = required && showRequiredIndicator 
    ? (
        <>
          {label}
          <RequiredIndicator aria-label="required">*</RequiredIndicator>
        </>
      )
    : label

  const hasValue = value !== '' && value !== undefined && value !== null

  return (
    <FormControl fullWidth error={error} sx={sx}>
      <InputLabel id={`${label}-label`}>{displayLabel}</InputLabel>
      <MuiSelect
        labelId={`${label}-label`}
        label={displayLabel}
        value={value}
        displayEmpty={!!placeholder}
        {...props}
      >
        {placeholder && (
          <MenuItem value="" disabled>
            <em>{placeholder}</em>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </MenuItem>
        ))}
      </MuiSelect>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  )
}
