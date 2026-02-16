import React from 'react'
import {
  Card as MuiCard,
  CardContent,
  CardHeader,
  CardActions,
  Typography,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/system'

export type CardVariant = 'outlined' | 'elevated' | 'flat'

export interface CardProps {
  title?: string
  children: React.ReactNode
  actions?: React.ReactNode
  elevation?: number
  variant?: CardVariant
  sx?: SxProps<Theme>
  onClick?: () => void
  className?: string
}

/**
 * Card Component
 * 
 * A reusable card component with consistent styling, optional title and actions.
 * 
 * @example
 * ```tsx
 * <Card title="Bot Status" actions={<Button>Edit</Button>}>
 *   Content here
 * </Card>
 * ```
 */
export const Card: React.FC<CardProps> = ({
  title,
  children,
  actions,
  elevation = 1,
  variant = 'elevated',
  sx,
  onClick,
  className,
}) => {
  const cardVariant = variant === 'outlined' ? 'outlined' : 'elevation'
  const cardElevation = variant === 'flat' ? 0 : elevation

  return (
    <MuiCard
      variant={cardVariant}
      elevation={cardElevation}
      onClick={onClick}
      className={className}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        ...(onClick && {
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: (theme) =>
              theme.shadows[variant === 'flat' ? 2 : elevation + 2],
          },
        }),
        ...sx,
      }}
    >
      {title && (
        <CardHeader
          title={
            <Typography variant="h3" component="h3">
              {title}
            </Typography>
          }
          sx={{
            paddingBottom: 1,
          }}
        />
      )}
      <CardContent
        sx={{
          padding: 2,
          '&:last-child': {
            paddingBottom: 2,
          },
        }}
      >
        {children}
      </CardContent>
      {actions && (
        <CardActions
          sx={{
            padding: 2,
            paddingTop: 0,
            justifyContent: 'flex-end',
          }}
        >
          {actions}
        </CardActions>
      )}
    </MuiCard>
  )
}
