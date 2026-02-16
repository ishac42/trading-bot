import { styled } from '@mui/material/styles'

export const RequiredIndicator = styled('span')(({ theme }) => ({
  color: theme.palette.error.main,
  marginLeft: theme.spacing(0.5),
  fontWeight: 'bold',
}))
