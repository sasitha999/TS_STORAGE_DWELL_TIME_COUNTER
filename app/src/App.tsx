import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { saveAs } from 'file-saver'
import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'

type ExcelRow = Record<string, string | number | boolean | null>

const COMPUTED_COLUMN_NAME = 'DummyComputedValue'
const MAX_PREVIEW_ROWS = 8

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = Number(value.trim())
    if (Number.isFinite(normalized)) {
      return normalized
    }
  }

  return null
}

function getDummyComputedValue(row: ExcelRow, rowIndex: number): number {
  const numericValues = Object.values(row)
    .map((value) => toNumber(value))
    .filter((value): value is number => value !== null)

  const baseline =
    numericValues.length > 0
      ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
      : rowIndex + 1

  return Number((baseline * 1.27 + 5).toFixed(2))
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null)
  const [downloadFileName, setDownloadFileName] = useState('updated.xlsx')
  const [previewRows, setPreviewRows] = useState<ExcelRow[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const previewColumns = useMemo(() => {
    if (previewRows.length === 0) {
      return []
    }

    return Object.keys(previewRows[0])
  }, [previewRows])

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    setSelectedFile(file)
    setProcessedBlob(null)
    setPreviewRows([])
    setErrorMessage('')

    if (!file) {
      return
    }

    const hasExcelExtension = /\.(xlsx|xls)$/i.test(file.name)

    if (!hasExcelExtension) {
      setSelectedFile(null)
      setErrorMessage('Please select a valid .xlsx or .xls file.')
      return
    }

    const generatedName = file.name.replace(/\.(xlsx|xls)$/i, '_updated.xlsx')
    setDownloadFileName(generatedName)
  }

  const handleProcessFile = async () => {
    if (!selectedFile) {
      setErrorMessage('Select an Excel file before processing.')
      return
    }

    try {
      setIsProcessing(true)
      setErrorMessage('')

      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })

      if (workbook.SheetNames.length === 0) {
        throw new Error('The uploaded file does not contain any worksheet.')
      }

      const sourceSheetName = workbook.SheetNames[0]
      const sourceSheet = workbook.Sheets[sourceSheetName]

      const parsedRows = XLSX.utils.sheet_to_json<ExcelRow>(sourceSheet, {
        defval: '',
      })

      if (parsedRows.length === 0) {
        throw new Error('The first worksheet is empty. Add at least one data row.')
      }

      const transformedRows = parsedRows.map((row, index) => ({
        ...row,
        [COMPUTED_COLUMN_NAME]: getDummyComputedValue(row, index),
      }))

      const outputSheet = XLSX.utils.json_to_sheet(transformedRows)
      const outputWorkbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(outputWorkbook, outputSheet, sourceSheetName)

      const outputData = XLSX.write(outputWorkbook, {
        bookType: 'xlsx',
        type: 'array',
      })

      const blob = new Blob([outputData], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      setProcessedBlob(blob)
      setPreviewRows(transformedRows.slice(0, MAX_PREVIEW_ROWS))
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to process the workbook. Please try another file.'
      setErrorMessage(message)
      setProcessedBlob(null)
      setPreviewRows([])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadFile = () => {
    if (!processedBlob) {
      return
    }

    saveAs(processedBlob, downloadFileName)
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 5 },
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          background:
            'linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(236, 248, 255, 0.88))',
          backdropFilter: 'blur(4px)',
        }}
      >
        <Stack spacing={3}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="h3" component="h1" gutterBottom>
                TS STORAGE DWELL TIME CALCULATOR
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Upload an Excel file with the following details, and download the
                updated file with the computed TS STORAGE DWELL TIME columns.
              </Typography>
            </Box>
            <Chip
              color="info"
              label="JCT Billing"
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, fontWeight: 600 }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button component="label" variant="outlined" startIcon={<CloudUploadRoundedIcon />}>
              Choose Excel File
              <input hidden type="file" accept=".xlsx,.xls" onChange={handleFileSelection} />
            </Button>

            <Button
              variant="contained"
              color="primary"
              startIcon={<AutoFixHighRoundedIcon />}
              onClick={handleProcessFile}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Add Computed Column'}
            </Button>

            <Button
              variant="contained"
              color="secondary"
              startIcon={<DownloadRoundedIcon />}
              onClick={handleDownloadFile}
              disabled={!processedBlob || isProcessing}
            >
              Download Updated File
            </Button>
          </Stack>

          {selectedFile && (
            <Typography variant="body2" color="text.secondary">
              Selected file: {selectedFile.name}
            </Typography>
          )}

          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          {!errorMessage && processedBlob && (
            <Alert severity="success">
              File processed successfully. Previewing first {previewRows.length} rows with the new
              {` ${COMPUTED_COLUMN_NAME} `}
              column.
            </Alert>
          )}

          {previewRows.length > 0 && (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ borderRadius: 2, overflowX: 'auto' }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {previewColumns.map((column) => (
                      <TableCell key={column} sx={{ fontWeight: 700 }}>
                        {column}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.map((row, rowIndex) => (
                    <TableRow key={`row-${rowIndex}`}>
                      {previewColumns.map((column) => (
                        <TableCell key={`${rowIndex}-${column}`}>
                          {String(row[column] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </Paper>
    </Container>
  )
}

export default App
