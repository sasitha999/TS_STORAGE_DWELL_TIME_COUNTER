import { Box, Chip, Container, Paper, Stack, Tab, Tabs, Typography } from '@mui/material'
import { useState } from 'react'
import ExcelProcessorTab from './components/ExcelProcessorTab'
import ManualCalculatorTab from './components/ManualCalculatorTab'

function App() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <Container maxWidth={false} disableGutters sx={{ px: 3, py: 2, minHeight: '100vh' }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          minHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          background:
            'linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(236, 248, 255, 0.88))',
          backdropFilter: 'blur(4px)',
        }}
      >
        <Stack spacing={3} sx={{ height: '100%' }}>
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h3" component="h1" gutterBottom>
                TS STORAGE DWELL TIME CALCULATOR
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Calculator tools for manual date-based checks and Excel bulk processing.
              </Typography>
            </Box>
            <Chip
              color="info"
              label="JCT Billing"
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, fontWeight: 600 }}
            />
          </Stack>

          <Tabs
            value={activeTab}
            onChange={(_, nextValue: number) => setActiveTab(nextValue)}
            aria-label="Calculator tabs"
          >
            <Tab label="New Calculator" />
            <Tab label="Excel File Processor" />
          </Tabs>

          <Box sx={{ flex: 1, minHeight: 0 }}>
            {activeTab === 0 ? <ManualCalculatorTab /> : <ExcelProcessorTab />}
          </Box>
        </Stack>
      </Paper>
    </Container>
  )
}

export default App
