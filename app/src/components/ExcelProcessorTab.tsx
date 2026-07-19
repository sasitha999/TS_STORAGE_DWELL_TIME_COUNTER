import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import {
  Alert,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import {
  applyComputedColumnsToRow,
  DEFAULT_LINE_LABEL,
  LINE_OPTIONS,
  MAX_PREVIEW_ROWS,
  REQUIRED_COLUMNS,
  validateExcelColumns,
} from '../utils/storageCalculator'
import type { ExcelRow } from '../utils/storageCalculator'

function trackDownloadClick(fileName: string, lineLabel: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
  if (!gtag) {
    return
  }

  gtag('event', 'file_download_click', {
    event_category: 'excel_processor',
    event_label: fileName,
    file_name: fileName,
    selected_line: lineLabel,
  })
}

function ExcelProcessorTab() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedLine, setSelectedLine] = useState<string>(DEFAULT_LINE_LABEL)
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null)
  const [downloadFileName, setDownloadFileName] = useState('updated.xlsx')
  const [previewRows, setPreviewRows] = useState<ExcelRow[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const selectedLineThreshold =
    LINE_OPTIONS.find((option) => option.label === selectedLine)?.value ?? LINE_OPTIONS[0].value

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

      const actualColumnNames = Object.keys(parsedRows[0])
      const validation = validateExcelColumns(actualColumnNames)
      if (!validation.valid) {
        throw new Error(validation.message)
      }

      const transformedRows = parsedRows.map((row) => applyComputedColumnsToRow(row, selectedLineThreshold))

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

    trackDownloadClick(downloadFileName, selectedLine)
    saveAs(processedBlob, downloadFileName)
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Button component="label" variant="outlined" startIcon={<CloudUploadRoundedIcon />}>
          Choose Excel File
          <input hidden type="file" accept=".xlsx,.xls" onChange={handleFileSelection} />
        </Button>

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel id="line-select-label">Select Line</InputLabel>
          <Select
            labelId="line-select-label"
            id="line-select"
            value={selectedLine}
            label="Select Line"
            onChange={(event) => setSelectedLine(event.target.value)}
          >
            {LINE_OPTIONS.map((option) => (
              <MenuItem key={option.label} value={option.label}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          color="primary"
          startIcon={<AutoFixHighRoundedIcon />}
          onClick={handleProcessFile}
          disabled={!selectedFile || isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Calculate'}
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

      <Alert severity="info">
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Required Columns (in order):
        </Typography>
        <Typography variant="body2">{REQUIRED_COLUMNS.join(' • ')}</Typography>
      </Alert>

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      {!errorMessage && processedBlob && (
        <Alert severity="success">
          File processed successfully. Previewing first {previewRows.length} rows with the new
          computed columns
        </Alert>
      )}

      {previewRows.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {previewColumns.map((column) => (
                  <TableCell
                    key={column}
                    sx={{
                      fontWeight: 700,
                      ...(column.includes('Date Range')
                        ? { minWidth: 220, whiteSpace: 'nowrap' }
                        : {}),
                    }}
                  >
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {previewRows.map((row, rowIndex) => (
                <TableRow key={`row-${rowIndex}`}>
                  {previewColumns.map((column) => (
                    <TableCell
                      key={`${rowIndex}-${column}`}
                      sx={
                        column.includes('Date Range')
                          ? { minWidth: 220, whiteSpace: 'nowrap' }
                          : undefined
                      }
                    >
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
  )
}

export default ExcelProcessorTab
