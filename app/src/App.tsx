import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
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

type ExcelRow = Record<string, string | number | boolean | null>

const REQUIRED_COLUMNS = ['Unit Nbr', 'Type ISO', 'Category', 'Frght Kind', 'ITT_IB_Disch_Date_Time', 'Time In', 'Loaded']
const COMPUTED_COLUMN_NAMES = {
  DAYS_AT_PORT_COLOMBO: 'Days at port of Colombo',
  DAYS_AT_OTHER_TERMINALS: 'No of Days at other Terminals',
  DAYS_AT_SLPA_TERMINAL: 'No of Days at SLPA Terminals',
  FIRST_TIER: '1st Tier',
  SECOND_TIER: '2nd Tier',
  THIRD_TIER: '3rd Tier',
  FIRST_TIER_DATE_RANGE: '1st Tier Date Range',
  SECOND_TIER_DATE_RANGE: '2nd Tier Date Range',
  THIRD_TIER_DATE_RANGE: '3rd Tier Date Range',
  FIRST_TIER_RENT: '1st Tier Rent (USD)',
  SECOND_TIER_RENT: '2nd Tier Rent (USD)',
  THIRD_TIER_RENT: '3rd Tier Rent (USD)',
  TOTAL_RENT: 'Total Rent (USD)',
}

const EMPTY_RATES = {
  firstTier: { 20: 3, 40: 6, 45: 18 },
  secondTier: { 20: 7, 40: 14, 45: 18 },
  thirdTier: { 20: 21, 40: 42, 45: 52 },
}

const LADEN_RATES = {
  firstTier: { 20: 7, 40: 14, 45: 18 },
  secondTier: { 20: 14, 40: 28, 45: 36 },
  thirdTier: { 20: 21, 40: 42, 45: 54 },
}
const LINE_OPTIONS = [
  { label: 'Normal', value: 14 },
  { label: 'MSC', value: 45 },
  { label: 'CMA', value: 30 },
  { label: 'ELK', value: 30 },
]

const DEFAULT_LINE_LABEL = 'Normal'
const MAX_PREVIEW_ROWS = 8

function parseDateString(dateStr: string): Date | null {
  // Format: "26-Feb-14 0000" (YY-MMM-DD HHMM)
  // NOTE: Time portion is parsed but ignored - only date is used for calculation
  const parts = dateStr.trim().split(' ')
  if (parts.length !== 2) return null

  const datePart = parts[0] // "26-Feb-14"
  const dateParts = datePart.split('-') // ["26", "Feb", "14"]
  if (dateParts.length !== 3) return null

  const year = parseInt(dateParts[0], 10)
  const monthStr = dateParts[1]
  const day = parseInt(dateParts[2], 10)

  const months: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  }

  const month = months[monthStr]
  if (month === undefined) return null

  // YY format: convert to full year (26 -> 2026, 14 -> 2014)
  const fullYear = year < 100 ? 2000 + year : year

  // Return Date at midnight (00:00:00) - time portion is ignored
  return new Date(fullYear, month, day, 0, 0, 0)
}

function calculateDaysAtPort(row: ExcelRow): number | null {
  const dischargeDate = row['ITT_IB_Disch_Date_Time']
  const loadedDate = row['Loaded']

  if (!dischargeDate || !loadedDate) return null

  const dateStart = parseDateString(String(dischargeDate))
  const dateEnd = parseDateString(String(loadedDate))

  if (!dateStart || !dateEnd) return null

  // Calculate difference in full days only (time portion ignored, both dates at midnight)
  const diffTime = Math.abs(dateEnd.getTime() - dateStart.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  // Add 1 as per the Excel DATEDIF formula logic
  return diffDays + 1
}

function calculateDaysAtOtherTerminals(row: ExcelRow): number | null {
  const dischargeDate = row['ITT_IB_Disch_Date_Time']
  const timeInDate = row['Time In']

  if (!dischargeDate || !timeInDate) return null

  const dateStart = parseDateString(String(dischargeDate))
  const dateEnd = parseDateString(String(timeInDate))

  if (!dateStart || !dateEnd) return null

  // Calculate difference in full days only (time portion ignored, both dates at midnight)
  const diffTime = Math.abs(dateEnd.getTime() - dateStart.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  // No +1 for this calculation (matches Excel DATEDIF without modification)
  return diffDays
}

function calculateDaysAtSLPATerminal(daysAtPort: number | null, daysAtOtherTerminals: number | null): number | null {
  if (daysAtPort === null || daysAtOtherTerminals === null) return null
  return daysAtPort - daysAtOtherTerminals
}

function getDateSections(
  fullDays: number,
  gateInDays: number,
  freeThreshold: number = 14,
): {
  freeSection: number
  firstTier: number
  secondTier: number
  thirdTier: number
} {
  // Generic helper: amount of fullDays that falls inside (low, high],
  // discounted by whichever is larger — the tier's own start, or gateInDays.
  const tierAmount = (low: number, high: number) => {
    if (fullDays <= low) return 0
    return Math.max(0, Math.min(fullDays, high) - Math.max(gateInDays, low))
  }

  const firstTier = freeThreshold < 30 ? tierAmount(freeThreshold, 30) : 0
  const secondTier = freeThreshold < 45 ? tierAmount(Math.max(freeThreshold, 30), 45) : 0
  const thirdTier = tierAmount(Math.max(freeThreshold, 45), Infinity)

  return {
    freeSection: Math.min(fullDays, freeThreshold),
    firstTier,
    secondTier,
    thirdTier,
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDateForRange(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear())
  return `${year}/${month}/${day}`
}

function getTierDateRanges(
  loadedDate: Date | null,
  firstTier: number | null,
  secondTier: number | null,
  thirdTier: number | null,
): {
  firstTierDateRange: string
  secondTierDateRange: string
  thirdTierDateRange: string
} {
  if (!loadedDate) {
    return {
      firstTierDateRange: 'NA',
      secondTierDateRange: 'NA',
      thirdTierDateRange: 'NA',
    }
  }

  let endCursor = new Date(loadedDate)

  const buildRange = (tierDays: number | null): string => {
    const days = tierDays !== null ? Math.max(0, Math.trunc(tierDays)) : 0

    if (days <= 0) {
      return 'NA'
    }

    // Inclusive range for N days: start = end - (N - 1)
    const startDate = addDays(endCursor, -(days - 1))
    const range = `${formatDateForRange(startDate)} to ${formatDateForRange(endCursor)}`
    // Move next tier end to one day before this tier's start to avoid overlap.
    endCursor = addDays(startDate, -1)
    return range
  }

  const thirdTierDateRange = buildRange(thirdTier)
  const secondTierDateRange = buildRange(secondTier)
  const firstTierDateRange = buildRange(firstTier)

  return {
    firstTierDateRange,
    secondTierDateRange,
    thirdTierDateRange,
  }
}

function getContainerSize(typeIso: unknown): 20 | 40 | 45 | null {
  const normalized = String(typeIso ?? '').trim().toUpperCase()
  const firstChar = normalized.charAt(0)

  if (firstChar === '4') return 40
  if (firstChar === '2') return 20
  if (firstChar === '9' || firstChar === 'L') return 45

  return null
}

function isLadenContainer(frghtKind: unknown): boolean {
  return String(frghtKind ?? '').trim().toUpperCase() === 'FCL'
}

function calculateTierRent(
  tierDays: number | null,
  tierName: 'firstTier' | 'secondTier' | 'thirdTier',
  containerSize: 20 | 40 | 45 | null,
  laden: boolean,
): number | null {
  if (tierDays === null || containerSize === null) {
    return null
  }

  const roundedDays = Math.max(0, Math.trunc(tierDays))
  const rateTable = laden ? LADEN_RATES : EMPTY_RATES
  const dailyRate = rateTable[tierName][containerSize]

  return roundedDays * dailyRate
}

function validateExcelColumns(actualColumns: string[]): { valid: boolean; message?: string } {
  // Check if the number of columns matches
  if (actualColumns.length !== REQUIRED_COLUMNS.length) {
    return {
      valid: false,
      message: `Invalid Excel file. Expected ${REQUIRED_COLUMNS.length} columns, found ${actualColumns.length}. Actual columns: ${actualColumns.join(', ')}`,
    }
  }

  // Check if columns are in the correct order and have correct names
  const columnsMatch = REQUIRED_COLUMNS.every((col, index) => col === actualColumns[index])

  if (!columnsMatch) {
    return {
      valid: false,
      message: `Invalid Excel file. Columns must be in the following order: ${REQUIRED_COLUMNS.join(', ')}. Actual columns: ${actualColumns.join(', ')}`,
    }
  }

  return { valid: true }
}

function App() {
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

      // Validate column names
      const actualColumnNames = Object.keys(parsedRows[0])

      const validation = validateExcelColumns(actualColumnNames)
      if (!validation.valid) {
        throw new Error(validation.message)
      }

      const transformedRows = parsedRows.map((row) => {
        const daysAtPort = calculateDaysAtPort(row)
        const daysAtOtherTerminals = calculateDaysAtOtherTerminals(row)
        const daysAtSLPA = calculateDaysAtSLPATerminal(daysAtPort, daysAtOtherTerminals)
        const loadedDate = parseDateString(String(row['Loaded'] ?? ''))
        const containerSize = getContainerSize(row['Type ISO'])
        const laden = isLadenContainer(row['Frght Kind'])

        let firstTier: number | null = null
        let secondTier: number | null = null
        let thirdTier: number | null = null

        if (daysAtPort !== null && daysAtOtherTerminals !== null) {
          const tiers = getDateSections(daysAtPort, daysAtOtherTerminals, selectedLineThreshold)
          firstTier = tiers.firstTier
          secondTier = tiers.secondTier
          thirdTier = tiers.thirdTier
        }

        const tierRanges = getTierDateRanges(loadedDate, firstTier, secondTier, thirdTier)
        const firstTierRent = calculateTierRent(firstTier, 'firstTier', containerSize, laden)
        const secondTierRent = calculateTierRent(secondTier, 'secondTier', containerSize, laden)
        const thirdTierRent = calculateTierRent(thirdTier, 'thirdTier', containerSize, laden)
        const totalRent =
          (firstTierRent ?? 0) +
          (secondTierRent ?? 0) +
          (thirdTierRent ?? 0)

        return {
          ...row,
          [COMPUTED_COLUMN_NAMES.DAYS_AT_PORT_COLOMBO]: daysAtPort,
          [COMPUTED_COLUMN_NAMES.DAYS_AT_OTHER_TERMINALS]: daysAtOtherTerminals,
          [COMPUTED_COLUMN_NAMES.DAYS_AT_SLPA_TERMINAL]: daysAtSLPA,
          [COMPUTED_COLUMN_NAMES.FIRST_TIER]: firstTier,
          [COMPUTED_COLUMN_NAMES.FIRST_TIER_DATE_RANGE]: tierRanges.firstTierDateRange,
          [COMPUTED_COLUMN_NAMES.SECOND_TIER]: secondTier,
          [COMPUTED_COLUMN_NAMES.SECOND_TIER_DATE_RANGE]: tierRanges.secondTierDateRange,
          [COMPUTED_COLUMN_NAMES.THIRD_TIER]: thirdTier,
          [COMPUTED_COLUMN_NAMES.THIRD_TIER_DATE_RANGE]: tierRanges.thirdTierDateRange,
          [COMPUTED_COLUMN_NAMES.FIRST_TIER_RENT]: firstTierRent,
          [COMPUTED_COLUMN_NAMES.SECOND_TIER_RENT]: secondTierRent,
          [COMPUTED_COLUMN_NAMES.THIRD_TIER_RENT]: thirdTierRent,
          [COMPUTED_COLUMN_NAMES.TOTAL_RENT]: totalRent,
        }
      })

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
    <Container maxWidth={false} disableGutters sx={{ px: 3, py: 2, height: '100vh' }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          height: '100%',
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
          <Stack
            direction="row"
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

          <Stack direction="row" spacing={2}>
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
            <Typography variant="body2">
              {REQUIRED_COLUMNS.join(' • ')}
            </Typography>
          </Alert>

          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          {!errorMessage && processedBlob && (
            <Alert severity="success">
              File processed successfully. Previewing first {previewRows.length} rows with the new
              computed columns
            </Alert>
          )}

          {previewRows.length > 0 && (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ borderRadius: 2, overflowX: 'auto', flex: 1 }}
            >
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
      </Paper>
    </Container>
  )
}

export default App
