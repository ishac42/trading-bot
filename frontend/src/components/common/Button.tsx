import React from 'react'
import {
  Button as MuiButton,
  CircularProgress,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/system'

type MuiButtonProps = React.ComponentProps<typeof MuiButton>

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text'
export type ButtonSize = 'small' | 'medium' | 'large'

export interface ButtonProps extends Omit<MuiButtonProps, 'variant' | 'color'> {
  variant?: ButtonVariant
  loading?: boolean
  fullWidth?: boolean
  sx?: SxProps<Theme>
}

const variantMap: Record<ButtonVariant, MuiButtonProps['variant']> = {
  primary: 'contained',
  secondary: 'outlined',
  danger: 'contained',
  text: 'text',
}

const colorMap: Record<ButtonVariant, MuiButtonProps['color']> = {
  primary: 'primary',
  secondary: 'primary',
  danger: 'error',
  text: 'inherit',
}

/**
 * Button Component
 * 
 * Extended MUI Button with custom variants and loading state.
 * 
 * @example
 * ```tsx
 * <Button variant="primary" loading={isLoading}>
 *   Save
 * </Button>
 * <Button variant="danger" startIcon={<DeleteIcon />}>
 *   Delete
 * </Button>
 * ```
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading = false,
  children,
  disabled,
  startIcon,
  endIcon,
  fullWidth,
  sx,
  ...props
}) => {
  const muiVariant = variantMap[variant]
  const muiColor = colorMap[variant]

  return (
    <MuiButton
      variant={muiVariant}
      color={muiColor}
      disabled={disabled || loading}
      startIcon={loading ? undefined : startIcon}
      endIcon={loading ? undefined : endIcon}
      fullWidth={fullWidth}
      sx={{
        textTransform: 'none',
        ...(variant === 'danger' && {
          backgroundColor: 'error.main',
          '&:hover': {
            backgroundColor: 'error.dark',
          },
        }),
        ...sx,
      }}
      {...props}
    >
      {loading ? (
        <>
          <CircularProgress size={16} sx={{ marginRight: 1 }} />
          {children}
        </>
      ) : (
        children
      )}
    </MuiButton>
  )
}
