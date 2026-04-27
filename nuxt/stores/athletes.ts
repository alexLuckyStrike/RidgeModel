import { defineStore } from "pinia";
import { useRuntimeConfig } from "nuxt/app";

export type Row = {
  V: number | null;
  P: number | null;
  R: number | null;
  creatinine: number | null;
  protein: number | null;
  myoglobin: number | null;
  ketones: number | null;
};

export type RestBaseline = {
  creatinine: number | null;
  protein: number | null;
  myoglobin: number | null;
  ketones: number | null;
};

export type Athlete = {
  id: string;
  name: string;
  period: {
    observationWeeks: number;
    sessionsPerWeek: number;
    startDate: string;
    competitionDate: string;
  };
  rows: Record<string, Row>;
  restBaseline: RestBaseline;
};

type DbRow = Partial<Record<keyof Row, unknown>>;

type DbAthlete = {
  id?: unknown;
  name?: unknown;
  period?: {
    observationWeeks?: unknown;
    sessionsPerWeek?: unknown;
    startDate?: unknown;
    competitionDate?: unknown;
  } | null;
  rows?: Record<string, DbRow> | null;
  restBaseline?: {
    creatinine?: unknown;
    protein?: unknown;
    myoglobin?: unknown;
    ketones?: unknown;
  } | null;
};

const createId = () => {
  try {
    const c = globalThis.crypto as Crypto | undefined;
    return c?.randomUUID
      ? c.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

const createAthlete = (index: number): Athlete => ({
  id: createId(),
  name: `Спортсмен ${index}`,
  period: {
    observationWeeks: 4,
    sessionsPerWeek: 3,
    startDate: new Date().toISOString().slice(0, 10),
    competitionDate: "",
  },
  rows: {},
  restBaseline: {
    creatinine: null,
    protein: null,
    myoglobin: null,
    ketones: null,
  },
});

const normalizeCount = (count: number) =>
  Math.max(1, Math.min(50, Math.floor(Number(count) || 1)));

const toNum = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const mapDbAthletes = (sourceList: DbAthlete[]): Athlete[] =>
  sourceList.map((source, idx) => {
    const rows: Record<string, Row> = {};
    for (const [key, row] of Object.entries(source?.rows || {})) {
      const r: DbRow = row || {};
      rows[key] = {
        V: toNum(r.V),
        P: toNum(r.P),
        R: toNum(r.R),
        creatinine: toNum(r.creatinine),
        protein: toNum(r.protein),
        myoglobin: toNum(r.myoglobin),
        ketones: toNum(r.ketones),
      };
    }

    return {
      id:
        typeof source?.id === "string" && source.id.trim()
          ? source.id
          : `db-athlete-${idx + 1}`,
      name:
        typeof source?.name === "string" && source.name.trim()
          ? source.name
          : `Спортсмен ${idx + 1}`,
      period: {
        observationWeeks: Number(source?.period?.observationWeeks) || 4,
        sessionsPerWeek: Number(source?.period?.sessionsPerWeek) || 3,
        startDate:
          (typeof source?.period?.startDate === "string" &&
            source.period.startDate) ||
          new Date().toISOString().slice(0, 10),
        competitionDate:
          (typeof source?.period?.competitionDate === "string" &&
            source.period.competitionDate) ||
          "",
      },
      rows,
      restBaseline: {
        creatinine: toNum(source?.restBaseline?.creatinine),
        protein: toNum(source?.restBaseline?.protein),
        myoglobin: toNum(source?.restBaseline?.myoglobin),
        ketones: toNum(source?.restBaseline?.ketones),
      },
    };
  });

export const useAthletesStore = defineStore("athletes", {
  state: () => ({
    athletes: [createAthlete(1)] as Athlete[],
  }),
  actions: {
    setAthleteCount(count: number) {
      const target = normalizeCount(count);
      if (this.athletes.length > target) {
        this.athletes.splice(target);
      } else {
        for (let i = this.athletes.length; i < target; i += 1) {
          this.athletes.push(createAthlete(i + 1));
        }
      }
      this.athletes.forEach((athlete, idx) => {
        athlete.name = `Спортсмен ${idx + 1}`;
      });
    },

    setAthletes(payload: Athlete[]) {
      if (!Array.isArray(payload) || payload.length === 0) {
        this.athletes = [createAthlete(1)];
        return;
      }
      this.athletes = payload.map((item, idx) => ({
        id: item.id || createId(),
        name: item.name || `Спортсмен ${idx + 1}`,
        period: item.period || {
          observationWeeks: 4,
          sessionsPerWeek: 3,
          startDate: new Date().toISOString().slice(0, 10),
          competitionDate: "",
        },
        rows: item.rows || {},
        restBaseline: item.restBaseline || {
          creatinine: null,
          protein: null,
          myoglobin: null,
          ketones: null,
        },
      }));
      this.setAthleteCount(this.athletes.length);
    },

    async fetchAllAthletesFromDb(backendBaseArg?: string) {
      let backendBase = backendBaseArg;
      if (!backendBase) {
        try {
          const config = useRuntimeConfig();
          if (
            typeof config.public.backendBase === "string" &&
            config.public.backendBase.trim()
          ) {
            backendBase = config.public.backendBase;
          }
        } catch {
          // noop
        }
      }

      const base = backendBase || "http://localhost:3001";

      try {
        const response = await fetch(`${base}/api/db/getAllAthletes`, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(
            "fetchAllAthletesFromDb HTTP error:",
            response.status,
            text,
          );
          return [];
        }

        const json = await response.json();
        const sourceList = Array.isArray(json) ? (json as DbAthlete[]) : [];
        const mapped = mapDbAthletes(sourceList);
        this.setAthletes(mapped);
        return this.athletes;
      } catch (error) {
        console.error("fetchAllAthletesFromDb failed:", error);
        return [];
      }
    },

    removeAthlete(id: string) {
      if (this.athletes.length <= 1) return;
      const idx = this.athletes.findIndex((a) => a.id === id);
      if (idx === -1) return;
      this.athletes.splice(idx, 1);
      this.athletes.forEach((a, i) => {
        a.name = `Спортсмен ${i + 1}`;
      });
    },
  },
});
