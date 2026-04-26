import { defineStore } from "pinia";

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
