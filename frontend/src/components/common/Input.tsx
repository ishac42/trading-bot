import React from 'react'
import {
  TextField,
  InputAdornment,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/system'
import { RequiredIndicator } from './Input.styles'

type TextFieldProps = React.ComponentProps<typeof TextField>

export interface InputProps extends Omit<TextFieldProps, 'variant'> {
  required?: boolean
  showRequiredIndicator?: boolean
  sx?: SxProps<Theme>
}

/**
 * Input Component
 * 
 * Extended MUI TextField with validation styling and required field indicator.
 * 
 * @example
 * ```tsx
 * <Input
 *   label="Bot Name"
 *   required
 *   error={!!errors.name}
 *   helperText={errors.name}
 * />
 * ```
 */
export const Input: React.FC<InputProps> = ({
  required = false,
  showRequiredIndicator = true,
  label,
  error,
  helperText,
  sx,
  ...props
}) => {
  // MUI TextField automatically adds asterisk when required=true
  // We only add our custom indicator if showRequiredIndicator is true
  // and we want to show it explicitly (though MUI will also show it)
  const displayLabel = label

  return (
    <TextField
      label={displayLabel}
      required={required && showRequiredIndicator}
      error={error}
      helperText={helperText}
      variant="outlined"
      fullWidth
      sx={{
        '& .MuiOutlinedInput-root': {
          '&:hover fieldset': {
            borderColor: error ? 'error.main' : 'primary.main',
          },
        },
        ...sx,
      }}
      {...props}
    />
  )
}
