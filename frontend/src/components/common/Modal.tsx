import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/system'
import { Close as CloseIcon } from '@mui/icons-material'

export type ModalMaxWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  actions?: React.ReactNode
  maxWidth?: ModalMaxWidth
  fullScreen?: boolean
  closeOnBackdropClick?: boolean
  closeOnEscape?: boolean
  sx?: SxProps<Theme>
  contentSx?: SxProps<Theme>
}

/**
 * Modal Component
 * 
 * A reusable modal/dialog component with consistent styling.
 * 
 * @example
 * ```tsx
 * <Modal
 *   open={isOpen}
 *   onClose={handleClose}
 *   title="Confirm Delete"
 *   actions={<Button onClick={handleConfirm}>Delete</Button>}
 * >
 *   Are you sure you want to delete this bot?
 * </Modal>
 * ```
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullScreen = false,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  sx,
  contentSx,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const handleClose = (
    event: {},
    reason: 'backdropClick' | 'escapeKeyDown'
  ) => {
    if (reason === 'backdropClick' && !closeOnBackdropClick) {
      return
    }
    if (reason === 'escapeKeyDown' && !closeOnEscape) {
      return
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={fullScreen || isMobile}
      sx={sx}
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : 2,
        },
      }}
    >
      {title && (
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h2" component="h2">
            {title}
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              marginLeft: 2,
            }}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
      )}
      <DialogContent
        sx={{
          padding: 2,
          ...contentSx,
        }}
      >
        {children}
      </DialogContent>
      {actions && (
        <DialogActions
          sx={{
            padding: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            gap: 1,
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  )
}
