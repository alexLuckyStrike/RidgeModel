export type PlannedSession = {
  id: string;
  week: number;
  session: number;
  focus: string;
  model: string;
  V: number;
  P: number;
  R: number;
  workout: string;
  flag: "OK" | "Внимание";
};

export type PlannedWeek = {
  week: number;
  model: string;
  sessions: PlannedSession[];
};

export type Plan = {
  createdAt: string;
  competitionDate?: string;
  weeks: PlannedWeek[];
};

export type MarkerKey = "creatinine" | "protein" | "myoglobin";
export type Coeffs = { b0: number; b1: number; b2: number; b3: number };

export type VariantSettings = {
  /** global scaling for V */
  V: number;
  /** global scaling for P */
  P: number;
  /** wave amplitude multiplier */
  wave: number;
  /** which marker is used as control target when solving ΔR */
  control: MarkerKey;
  /** shift of target in ln-space */
  targetShiftLn: number;
  /** amplitude of target wave in ln-space */
  targetWaveLn: number;
  /** clamp range for R (minutes) */
  rMin: number;
  rMax: number;
};

export type PlanVariantId =
  | "balanced"
  | "volume"
  | "intensity"
  | "recovery"
  | "performance";

export type PlanVariant = {
  id: PlanVariantId;
  title: string;
  subtitle: string;
  explanationHtml: string;
};
