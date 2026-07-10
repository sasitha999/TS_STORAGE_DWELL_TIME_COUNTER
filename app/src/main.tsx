import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const appTheme = createTheme({
  palette: {
    primary: {
      main: '#006d77',
    },
    secondary: {
      main: '#e07a5f',
    },
    background: {
      default: '#f0f7ff',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Poppins, Trebuchet MS, Segoe UI, sans-serif',
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
  },
  shape: {
    borderRadius: 14,
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
