import type { Athlete, Row } from '../../../../stores/athletes'

type DbRow = Partial<Record<keyof Row, unknown>>

type DbAthlete = {
  id?: unknown
  name?: unknown
  period?: {
    observationWeeks?: unknown
    sessionsPerWeek?: unknown
    startDate?: unknown
    competitionDate?: unknown
  } | null
  rows?: Record<string, DbRow> | null
  restBaseline?: {
    creatinine?: unknown
    protein?: unknown
    myoglobin?: unknown
    ketones?: unknown
  } | null
}

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}


// Функция собирает данные всех атлетов
async function getAllAthletes(backendBase: string): Promise<DbAthlete[] | null> {
  try {
    const response = await fetch(`${backendBase}/api/db/getAllAthletes`, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('getAllAthletes HTTP error:', response.status, text)
      return null
    }

    const json = await response.json()
    console.log("JSON:",json);
    return Array.isArray(json) ? (json as DbAthlete[]) : null
  } catch (error) {
    console.error('getAllAthletes failed:', error)
    return null
  }
}


//Функция подготавливает для стора
const mapAthletes = (sourceList: DbAthlete[]): Athlete[] => {
  return sourceList.map((source, idx) => {
    const rows: Record<string, Row> = {}
    for (const [k, row] of Object.entries(source?.rows || {})) {
      const r: DbRow = row || {}
      rows[k] = {
        V: toNum(r.V),
        P: toNum(r.P),
        R: toNum(r.R),
        creatinine: toNum(r.creatinine),
        protein: toNum(r.protein),
        myoglobin: toNum(r.myoglobin),
        ketones: toNum(r.ketones),
      }
    }

    return {
      id:
        typeof source?.id === 'string' && source.id.trim()
          ? source.id
          : `db-athlete-${idx + 1}`,
      name:
        typeof source?.name === 'string' && source.name.trim()
          ? source.name
          : `Спортсмен ${idx + 1}`,
      period: {
        observationWeeks: Number(source?.period?.observationWeeks) || 4,
        sessionsPerWeek: Number(source?.period?.sessionsPerWeek) || 3,
        startDate:
          (typeof source?.period?.startDate === 'string' && source.period.startDate) ||
          new Date().toISOString().slice(0, 10),
        competitionDate:
          (typeof source?.period?.competitionDate === 'string' && source.period.competitionDate) ||
          '',
      },
      rows,
      restBaseline: {
        creatinine: toNum(source?.restBaseline?.creatinine),
        protein: toNum(source?.restBaseline?.protein),
        myoglobin: toNum(source?.restBaseline?.myoglobin),
        ketones: toNum(source?.restBaseline?.ketones),
      },
    }
  })
}

export async function fillDemo(params: {
  backendBase: string
  applyLoadedAthletes: (athletes: Athlete[]) => void
}) {
  const sourceList = await getAllAthletes(params.backendBase)

  if (!sourceList || !sourceList.length) {
    console.warn('fillDemo: no athletes returned from DB')
    return
  }

  const mapped = mapAthletes(sourceList)
  
  console.log('mapped:',mapped);

  params.applyLoadedAthletes(mapped)
}
