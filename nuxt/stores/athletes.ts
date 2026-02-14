import { defineStore } from "pinia";
import { ref } from "vue";

export type Row = {
  V: number | null;
  P: number | null;
  R: number | null;
  creatinine: number | null;
  protein: number | null;
  myoglobin: number | null;
};

export type RestBaseline = {
  creatinine: number | null;
  protein: number | null;
  myoglobin: number | null;
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
  },
});

const normalizeCount = (count: number) =>
  Math.max(1, Math.min(50, Math.floor(Number(count) || 1)));

export const useAthletesStore = defineStore("athletes", () => {
  const athletes = ref<Athlete[]>([createAthlete(1)]);

  const setAthleteCount = (count: number) => {
    const target = normalizeCount(count);
    if (athletes.value.length > target) {
      athletes.value.splice(target);
    } else {
      for (let i = athletes.value.length; i < target; i += 1) {
        athletes.value.push(createAthlete(i + 1));
      }
    }
    athletes.value.forEach((athlete, idx) => {
      athlete.name = `Спортсмен ${idx + 1}`;
    });
  };

  const setAthletes = (payload: Athlete[]) => {
    if (!Array.isArray(payload) || payload.length === 0) {
      athletes.value = [createAthlete(1)];
      return;
    }
    athletes.value = payload.map((item, idx) => ({
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
      },
    }));
    setAthleteCount(athletes.value.length);
  };

  const removeAthlete = (id: string) => {
    if (athletes.value.length <= 1) return;
    const idx = athletes.value.findIndex((a) => a.id === id);
    if (idx === -1) return;
    athletes.value.splice(idx, 1);
    athletes.value.forEach((a, i) => {
      a.name = `Спортсмен ${i + 1}`;
    });
  };

  return { athletes, setAthleteCount, setAthletes, removeAthlete };
});
