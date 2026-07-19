export type ExcelRow = Record<string, string | number | boolean | null>

export type ContainerSize = 20 | 40 | 45

type TierName = 'firstTier' | 'secondTier' | 'thirdTier'

export const REQUIRED_COLUMNS = [
  'Unit Nbr',
  'Type ISO',
  'Category',
  'Frght Kind',
  'ITT_IB_Disch_Date_Time',
  'Time In',
  'Loaded',
]

export const COMPUTED_COLUMN_NAMES = {
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
} as const

const EMPTY_RATES: Record<TierName, Record<ContainerSize, number>> = {
  firstTier: { 20: 3, 40: 6, 45: 18 },
  secondTier: { 20: 7, 40: 14, 45: 18 },
  thirdTier: { 20: 21, 40: 42, 45: 52 },
}

const LADEN_RATES: Record<TierName, Record<ContainerSize, number>> = {
  firstTier: { 20: 7, 40: 14, 45: 18 },
  secondTier: { 20: 14, 40: 28, 45: 36 },
  thirdTier: { 20: 21, 40: 42, 45: 54 },
}

export const LINE_OPTIONS = [
  { label: 'Normal', value: 14 },
  { label: 'MSC', value: 45 },
  { label: 'CMA', value: 30 },
  { label: 'ELK', value: 30 },
]

export const DEFAULT_LINE_LABEL = 'Normal'
export const MAX_PREVIEW_ROWS = 8

export function parseDateString(dateStr: string): Date | null {
  const parts = dateStr.trim().split(' ')
  if (parts.length !== 2) return null

  const datePart = parts[0]
  const dateParts = datePart.split('-')
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

  const fullYear = year < 100 ? 2000 + year : year

  return new Date(fullYear, month, day, 0, 0, 0)
}

export function calculateDaysAtPortFromDates(dischargeDate: Date, loadedDate: Date): number {
  const diffTime = Math.abs(loadedDate.getTime() - dischargeDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays + 1
}

export function calculateDaysAtOtherTerminalsFromDates(dischargeDate: Date, timeInDate: Date): number {
  const diffTime = Math.abs(timeInDate.getTime() - dischargeDate.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function calculateDaysAtPort(row: ExcelRow): number | null {
  const dischargeDate = row['ITT_IB_Disch_Date_Time']
  const loadedDate = row['Loaded']

  if (!dischargeDate || !loadedDate) return null

  const dateStart = parseDateString(String(dischargeDate))
  const dateEnd = parseDateString(String(loadedDate))

  if (!dateStart || !dateEnd) return null

  return calculateDaysAtPortFromDates(dateStart, dateEnd)
}

export function calculateDaysAtOtherTerminals(row: ExcelRow): number | null {
  const dischargeDate = row['ITT_IB_Disch_Date_Time']
  const timeInDate = row['Time In']

  if (!dischargeDate || !timeInDate) return null

  const dateStart = parseDateString(String(dischargeDate))
  const dateEnd = parseDateString(String(timeInDate))

  if (!dateStart || !dateEnd) return null

  return calculateDaysAtOtherTerminalsFromDates(dateStart, dateEnd)
}

export function calculateDaysAtSLPATerminal(daysAtPort: number | null, daysAtOtherTerminals: number | null): number | null {
  if (daysAtPort === null || daysAtOtherTerminals === null) return null
  return daysAtPort - daysAtOtherTerminals
}

export function getDateSections(
  fullDays: number,
  gateInDays: number,
  freeThreshold: number = 14,
): {
  freeSection: number
  firstTier: number
  secondTier: number
  thirdTier: number
} {
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
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${year}/${month}/${day}`
}

export function getTierDateRanges(
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

    const startDate = addDays(endCursor, -(days - 1))
    const range = `${formatDateForRange(startDate)} to ${formatDateForRange(endCursor)}`
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

export function getContainerSize(typeIso: unknown): ContainerSize | null {
  const normalized = String(typeIso ?? '').trim().toUpperCase()
  const firstChar = normalized.charAt(0)

  if (firstChar === '4') return 40
  if (firstChar === '2') return 20
  if (firstChar === '9' || firstChar === 'L') return 45

  return null
}

export function isLadenContainer(frghtKind: unknown): boolean {
  return String(frghtKind ?? '').trim().toUpperCase() === 'FCL'
}

export function calculateTierRent(
  tierDays: number | null,
  tierName: TierName,
  containerSize: ContainerSize | null,
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

export function validateExcelColumns(actualColumns: string[]): { valid: boolean; message?: string } {
  if (actualColumns.length !== REQUIRED_COLUMNS.length) {
    return {
      valid: false,
      message: `Invalid Excel file. Expected ${REQUIRED_COLUMNS.length} columns, found ${actualColumns.length}. Actual columns: ${actualColumns.join(', ')}`,
    }
  }

  const columnsMatch = REQUIRED_COLUMNS.every((col, index) => col === actualColumns[index])

  if (!columnsMatch) {
    return {
      valid: false,
      message: `Invalid Excel file. Columns must be in the following order: ${REQUIRED_COLUMNS.join(', ')}. Actual columns: ${actualColumns.join(', ')}`,
    }
  }

  return { valid: true }
}

export type ComputedValues = {
  daysAtPort: number | null
  daysAtOtherTerminals: number | null
  daysAtSLPA: number | null
  firstTier: number | null
  secondTier: number | null
  thirdTier: number | null
  firstTierDateRange: string
  secondTierDateRange: string
  thirdTierDateRange: string
  firstTierRent: number | null
  secondTierRent: number | null
  thirdTierRent: number | null
  totalRent: number
}

export function calculateComputedValues(input: {
  dischargeDate: Date | null
  timeInDate: Date | null
  loadedDate: Date | null
  freeThreshold: number
  containerSize: ContainerSize | null
  laden: boolean
}): ComputedValues {
  const { dischargeDate, timeInDate, loadedDate, freeThreshold, containerSize, laden } = input

  const daysAtPort = dischargeDate && loadedDate
    ? calculateDaysAtPortFromDates(dischargeDate, loadedDate)
    : null
  const daysAtOtherTerminals = dischargeDate && timeInDate
    ? calculateDaysAtOtherTerminalsFromDates(dischargeDate, timeInDate)
    : null
  const daysAtSLPA = calculateDaysAtSLPATerminal(daysAtPort, daysAtOtherTerminals)

  let firstTier: number | null = null
  let secondTier: number | null = null
  let thirdTier: number | null = null

  if (daysAtPort !== null && daysAtOtherTerminals !== null) {
    const tiers = getDateSections(daysAtPort, daysAtOtherTerminals, freeThreshold)
    firstTier = tiers.firstTier
    secondTier = tiers.secondTier
    thirdTier = tiers.thirdTier
  }

  const tierRanges = getTierDateRanges(loadedDate, firstTier, secondTier, thirdTier)
  const firstTierRent = calculateTierRent(firstTier, 'firstTier', containerSize, laden)
  const secondTierRent = calculateTierRent(secondTier, 'secondTier', containerSize, laden)
  const thirdTierRent = calculateTierRent(thirdTier, 'thirdTier', containerSize, laden)

  return {
    daysAtPort,
    daysAtOtherTerminals,
    daysAtSLPA,
    firstTier,
    secondTier,
    thirdTier,
    firstTierDateRange: tierRanges.firstTierDateRange,
    secondTierDateRange: tierRanges.secondTierDateRange,
    thirdTierDateRange: tierRanges.thirdTierDateRange,
    firstTierRent,
    secondTierRent,
    thirdTierRent,
    totalRent: (firstTierRent ?? 0) + (secondTierRent ?? 0) + (thirdTierRent ?? 0),
  }
}

export function getComputedColumns(details: ComputedValues): Record<string, string | number | null> {
  return {
    [COMPUTED_COLUMN_NAMES.DAYS_AT_PORT_COLOMBO]: details.daysAtPort,
    [COMPUTED_COLUMN_NAMES.DAYS_AT_OTHER_TERMINALS]: details.daysAtOtherTerminals,
    [COMPUTED_COLUMN_NAMES.DAYS_AT_SLPA_TERMINAL]: details.daysAtSLPA,
    [COMPUTED_COLUMN_NAMES.FIRST_TIER]: details.firstTier,
    [COMPUTED_COLUMN_NAMES.FIRST_TIER_DATE_RANGE]: details.firstTierDateRange,
    [COMPUTED_COLUMN_NAMES.SECOND_TIER]: details.secondTier,
    [COMPUTED_COLUMN_NAMES.SECOND_TIER_DATE_RANGE]: details.secondTierDateRange,
    [COMPUTED_COLUMN_NAMES.THIRD_TIER]: details.thirdTier,
    [COMPUTED_COLUMN_NAMES.THIRD_TIER_DATE_RANGE]: details.thirdTierDateRange,
    [COMPUTED_COLUMN_NAMES.FIRST_TIER_RENT]: details.firstTierRent,
    [COMPUTED_COLUMN_NAMES.SECOND_TIER_RENT]: details.secondTierRent,
    [COMPUTED_COLUMN_NAMES.THIRD_TIER_RENT]: details.thirdTierRent,
    [COMPUTED_COLUMN_NAMES.TOTAL_RENT]: details.totalRent,
  }
}

export function applyComputedColumnsToRow(row: ExcelRow, freeThreshold: number): ExcelRow {
  const details = calculateComputedValues({
    dischargeDate: parseDateString(String(row['ITT_IB_Disch_Date_Time'] ?? '')),
    timeInDate: parseDateString(String(row['Time In'] ?? '')),
    loadedDate: parseDateString(String(row['Loaded'] ?? '')),
    freeThreshold,
    containerSize: getContainerSize(row['Type ISO']),
    laden: isLadenContainer(row['Frght Kind']),
  })

  return {
    ...row,
    ...getComputedColumns(details),
  }
}
