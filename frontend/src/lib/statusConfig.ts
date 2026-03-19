export const STATUS_CONFIG: Record<string, {
  label: string
  shortLabel: string
  bgClass: string
  textClass: string
  borderClass: string
  badgeClass: string
  order: number
}> = {
  A_ENTRY:   { label: 'A:エントリー',   shortLabel: 'A',  bgClass: 'bg-blue-500',    textClass: 'text-blue-700',    borderClass: 'border-blue-300',    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',    order: 1 },
  registered:{ label: 'A:エントリー',   shortLabel: 'A',  bgClass: 'bg-blue-500',    textClass: 'text-blue-700',    borderClass: 'border-blue-300',    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',    order: 1 },
  B_WAITING: { label: 'B:回答待ち',     shortLabel: 'B',  bgClass: 'bg-amber-500',   textClass: 'text-amber-700',   borderClass: 'border-amber-300',   badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',   order: 2 },
  C_WAITING: { label: 'C:回答待ち',     shortLabel: 'C',  bgClass: 'bg-purple-500',  textClass: 'text-purple-700',  borderClass: 'border-purple-300',  badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',  order: 3 },
  attended:  { label: '着座',           shortLabel: '着', bgClass: 'bg-emerald-500', textClass: 'text-emerald-700', borderClass: 'border-emerald-300', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', order: 4 },
  D_PASS:    { label: 'D:合格',         shortLabel: 'D',  bgClass: 'bg-green-500',   textClass: 'text-green-700',   borderClass: 'border-green-300',   badgeClass: 'bg-green-50 text-green-700 border-green-200',   order: 5 },
  E_FAIL:    { label: 'E:不合格',       shortLabel: 'E',  bgClass: 'bg-red-500',     textClass: 'text-red-700',     borderClass: 'border-red-300',     badgeClass: 'bg-red-50 text-red-700 border-red-200',     order: 6 },
  XA_CANCEL: { label: 'XA:キャンセル', shortLabel: 'XA', bgClass: 'bg-gray-400',    textClass: 'text-gray-600',    borderClass: 'border-gray-300',    badgeClass: 'bg-gray-50 text-gray-600 border-gray-200',    order: 7 },
  canceled:  { label: 'XA:キャンセル', shortLabel: 'XA', bgClass: 'bg-gray-400',    textClass: 'text-gray-600',    borderClass: 'border-gray-300',    badgeClass: 'bg-gray-50 text-gray-600 border-gray-200',    order: 7 },
}

export const getStatusLabel = (status?: string) =>
  STATUS_CONFIG[status ?? '']?.label ?? status ?? '-'

export const getStatusBadgeClass = (status?: string) =>
  STATUS_CONFIG[status ?? '']?.badgeClass ?? 'bg-gray-50 text-gray-600 border-gray-200'

export const getStatusBgClass = (status?: string) =>
  STATUS_CONFIG[status ?? '']?.bgClass ?? 'bg-gray-400'
