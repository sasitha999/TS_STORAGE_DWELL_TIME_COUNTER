import {
  Alert,
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
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import type { Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import {
  calculateComputedValues,
  COMPUTED_COLUMN_NAMES,
  DEFAULT_LINE_LABEL,
  LINE_OPTIONS,
} from '../utils/storageCalculator'
import type { ContainerSize } from '../utils/storageCalculator'

const FREIGHT_KIND_OPTIONS = [
  { label: 'FCL (Laden)', value: 'FCL' },
  { label: 'MTY/Other (Empty)', value: 'MTY' },
]

const CONTAINER_SIZES: ContainerSize[] = [20, 40, 45]

function ManualCalculatorTab() {
  const [selectedLine, setSelectedLine] = useState(DEFAULT_LINE_LABEL)
  const [freightKind, setFreightKind] = useState('FCL')
  const [containerSize, setContainerSize] = useState<ContainerSize>(20)
  const [dischargeDate, setDischargeDate] = useState<Dayjs | null>(null)
  const [timeInDate, setTimeInDate] = useState<Dayjs | null>(null)
  const [loadedDate, setLoadedDate] = useState<Dayjs | null>(null)
  const [dischargeDateError, setDischargeDateError] = useState(false)
  const [timeInDateError, setTimeInDateError] = useState(false)
  const [loadedDateError, setLoadedDateError] = useState(false)

  const parsedDischargeDate = dischargeDate?.isValid() ? dischargeDate.startOf('day').toDate() : null
  const parsedTimeInDate = timeInDate?.isValid() ? timeInDate.startOf('day').toDate() : null
  const parsedLoadedDate = loadedDate?.isValid() ? loadedDate.startOf('day').toDate() : null

  const dischargeDateInvalid = dischargeDateError
  const timeInDateInvalid = timeInDateError
  const loadedDateInvalid = loadedDateError
  const hasInvalidDateFormat = dischargeDateInvalid || timeInDateInvalid || loadedDateInvalid

  const selectedLineThreshold =
    LINE_OPTIONS.find((option) => option.label === selectedLine)?.value ?? LINE_OPTIONS[0].value

  const computedDetails = useMemo(() => {
    return calculateComputedValues({
      dischargeDate: parsedDischargeDate,
      timeInDate: parsedTimeInDate,
      loadedDate: parsedLoadedDate,
      freeThreshold: selectedLineThreshold,
      containerSize,
      laden: freightKind === 'FCL',
    })
  }, [containerSize, freightKind, parsedDischargeDate, parsedLoadedDate, parsedTimeInDate, selectedLineThreshold])

  const hasAllDates = Boolean(parsedDischargeDate && parsedTimeInDate && parsedLoadedDate)
  const totalBillableDaysCount =
    (computedDetails.firstTier ?? 0) +
    (computedDetails.secondTier ?? 0) +
    (computedDetails.thirdTier ?? 0)

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        Use this calculator to preview the same computed columns that are added to the Excel output.
      </Alert>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel id="manual-line-select-label">Select Line</InputLabel>
          <Select
            labelId="manual-line-select-label"
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

        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel id="manual-freight-kind-label">Freight Kind</InputLabel>
          <Select
            labelId="manual-freight-kind-label"
            value={freightKind}
            label="Freight Kind"
            onChange={(event) => setFreightKind(event.target.value)}
          >
            {FREIGHT_KIND_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel id="manual-container-size-label">Container Size</InputLabel>
          <Select
            labelId="manual-container-size-label"
            value={containerSize}
            label="Container Size"
            onChange={(event) => setContainerSize(Number(event.target.value) as ContainerSize)}
          >
            {CONTAINER_SIZES.map((size) => (
              <MenuItem key={size} value={size}>
                {size}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <DatePicker
            label="ITT_IB_Disch_Date_Time"
            format="YYYY/MM/DD"
            value={dischargeDate}
            onChange={(nextValue) => setDischargeDate(nextValue)}
            onError={(reason) => setDischargeDateError(Boolean(reason))}
            slotProps={{
              textField: {
                fullWidth: true,
                helperText: dischargeDateInvalid ? 'Invalid date. Use format YYYY/MM/DD (example: 2026/07/19)' : 'Example: 2026/07/19 (YYYY/MM/DD)',
                error: dischargeDateInvalid,
              },
            }}
          />
          <DatePicker
            label="Time In"
            format="YYYY/MM/DD"
            value={timeInDate}
            onChange={(nextValue) => setTimeInDate(nextValue)}
            onError={(reason) => setTimeInDateError(Boolean(reason))}
            slotProps={{
              textField: {
                fullWidth: true,
                helperText: timeInDateInvalid ? 'Invalid date. Use format YYYY/MM/DD (example: 2026/07/19)' : 'Example: 2026/07/19 (YYYY/MM/DD)',
                error: timeInDateInvalid,
              },
            }}
          />
          <DatePicker
            label="Loaded"
            format="YYYY/MM/DD"
            value={loadedDate}
            onChange={(nextValue) => setLoadedDate(nextValue)}
            onError={(reason) => setLoadedDateError(Boolean(reason))}
            slotProps={{
              textField: {
                fullWidth: true,
                helperText: loadedDateInvalid ? 'Invalid date. Use format YYYY/MM/DD (example: 2026/07/19)' : 'Example: 2026/07/19 (YYYY/MM/DD)',
                error: loadedDateInvalid,
              },
            }}
          />
        </Stack>
      </LocalizationProvider>

      {hasInvalidDateFormat && (
        <Alert severity="error">
          Invalid date format. Please type dates as YYYY/MM/DD (example: 2026/07/19) or pick from the calendar icon.
        </Alert>
      )}

      {!hasAllDates && (
        <Alert severity="warning">
          Select all three dates to calculate complete results.
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ alignItems: 'stretch' }}>
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, flex: '0 0 33%' }}>
          <Stack spacing={1.25}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>{COMPUTED_COLUMN_NAMES.DAYS_AT_PORT_COLOMBO}</Typography>
              <Typography>{String(computedDetails.daysAtPort ?? 'NA')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>{COMPUTED_COLUMN_NAMES.DAYS_AT_OTHER_TERMINALS}</Typography>
              <Typography>{String(computedDetails.daysAtOtherTerminals ?? 'NA')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 700 }}>{COMPUTED_COLUMN_NAMES.DAYS_AT_SLPA_TERMINAL}</Typography>
              <Typography>{String(computedDetails.daysAtSLPA ?? 'NA')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>Toatal Billable Days count</Typography>
              <Typography sx={{ fontWeight: 700 }}>{String(totalBillableDaysCount)}</Typography>
            </Stack>
          </Stack>
        </Paper>

        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto', flex: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Tier</TableCell>
                <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Day Count</TableCell>
                <TableCell sx={{ fontWeight: 700, minWidth: 220, whiteSpace: 'nowrap' }}>Date Range</TableCell>
                <TableCell sx={{ fontWeight: 700, minWidth: 160 }}>Rent (USD)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>1st Tier</TableCell>
                <TableCell>{String(computedDetails.firstTier ?? 'NA')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{computedDetails.firstTierDateRange}</TableCell>
                <TableCell>{String(computedDetails.firstTierRent ?? 'NA')}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>2nd Tier</TableCell>
                <TableCell>{String(computedDetails.secondTier ?? 'NA')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{computedDetails.secondTierDateRange}</TableCell>
                <TableCell>{String(computedDetails.secondTierRent ?? 'NA')}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>3rd Tier</TableCell>
                <TableCell>{String(computedDetails.thirdTier ?? 'NA')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{computedDetails.thirdTierDateRange}</TableCell>
                <TableCell>{String(computedDetails.thirdTierRent ?? 'NA')}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Total Rent</TableCell>
                <TableCell
                  colSpan={3}
                  sx={{ fontWeight: 800, fontSize: '1.1rem', textAlign: 'center', bgcolor: 'action.hover' }}
                >
                  {String(computedDetails.totalRent ?? 'NA')}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Includes: {COMPUTED_COLUMN_NAMES.DAYS_AT_PORT_COLOMBO}, {COMPUTED_COLUMN_NAMES.DAYS_AT_OTHER_TERMINALS}, {COMPUTED_COLUMN_NAMES.DAYS_AT_SLPA_TERMINAL}, {COMPUTED_COLUMN_NAMES.FIRST_TIER}, {COMPUTED_COLUMN_NAMES.SECOND_TIER}, {COMPUTED_COLUMN_NAMES.THIRD_TIER}, date ranges, and rent totals.
      </Typography>
    </Stack>
  )
}

export default ManualCalculatorTab
