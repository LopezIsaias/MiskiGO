// Dispatch cutoffs: Monday 12:00 PM Lima (→ Tuesday delivery)
//                   Thursday 12:00 PM Lima (→ Friday delivery)
// Lima is UTC-5 year-round (no DST)

const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000

export interface CutoffOption {
  label: string
  isoString: string
}

function nextWeekday(from: Date, targetDay: number): Date {
  // Returns the next occurrence of targetDay (0=Sun … 6=Sat) at or after `from`
  const d = new Date(from)
  const diff = (targetDay - d.getDay() + 7) % 7
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff))
  return d
}

function cutoffDate(weekday: number, fromNow: Date): Date {
  // Returns the UTC timestamp of the next [weekday] 12:00 PM Lima
  const next = nextWeekday(fromNow, weekday)
  // Set time to 12:00:00 Lima = 17:00:00 UTC
  const d = new Date(Date.UTC(next.getFullYear(), next.getMonth(), next.getDate(), 17, 0, 0, 0))
  return d
}

const DISPATCH_DAY_LABELS: Record<number, { dispatch: string; cutoff: string }> = {
  1: { cutoff: 'lunes', dispatch: 'martes' },   // Monday cutoff → Tuesday dispatch
  4: { cutoff: 'jueves', dispatch: 'viernes' }, // Thursday cutoff → Friday dispatch
}

function formatLimaDate(utcDate: Date): string {
  const lima = new Date(utcDate.getTime() + LIMA_OFFSET_MS)
  const day = lima.getUTCDate().toString().padStart(2, '0')
  const month = (lima.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${day}/${month}`
}

export function getNextCutoffs(count = 4): CutoffOption[] {
  const now = new Date()
  const options: CutoffOption[] = []
  const seen = new Set<string>()

  // Generate candidate cutoffs: next 4 weeks for Mon and Thu
  for (let week = 0; week < count; week++) {
    for (const weekday of [1, 4]) {
      const base = new Date(now)
      base.setDate(base.getDate() + week * 7)
      const cutoff = cutoffDate(weekday, base)

      if (cutoff <= now) continue
      if (seen.has(cutoff.toISOString())) continue
      seen.add(cutoff.toISOString())

      const info = DISPATCH_DAY_LABELS[weekday]
      const cutoffStr = formatLimaDate(cutoff)
      options.push({
        label: `Despacho del ${info.dispatch} — corte ${info.cutoff} ${cutoffStr} 12:00 PM`,
        isoString: cutoff.toISOString(),
      })
    }
  }

  return options.sort((a, b) => a.isoString.localeCompare(b.isoString)).slice(0, count)
}
