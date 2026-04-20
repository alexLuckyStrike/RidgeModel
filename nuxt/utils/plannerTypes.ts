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
  pc1Predicted?: number;
  markersPredicted?: Partial<Record<MarkerKey, number>>;
  corridor?: CorridorCheck;
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

export type MarkerKey = "creatinine" | "protein" | "myoglobin" | "ketones";
export type Coeffs = { b0: number; b1: number; b2: number; b3: number };

export type VariantSettings = {
  /** доля доступного коридора, «съедаемая» за неделю */
  alphaWeek: number;
  /** стратегический акцент недели по рычагам [V, P, R] */
  accentShares: [number, number, number];
  /** как распределять недельную цель по тренировкам */
  sessionDistribution: "even" | "front" | "back" | "plateau-deload";
  /** control-маркер для fallback / отчетности */
  control: MarkerKey;
  /** clamp range for R (minutes) */
  rMin: number;
  rMax: number;
};

export type SessionTarget = {
  pc1Target: number;
  accentShares: [number, number, number];
};

export type CorridorCheck = {
  ok: boolean;
  violations: Array<{ marker: MarkerKey; predicted: number; low: number; high: number }>;
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

export type RidgeCoeffs = {
  beta: [number, number, number];
  lambda: number;
  r2: number;
};

export type PcaWeights = {
  weights: [number, number, number, number];
  means: [number, number, number, number];
  explainedRatio: number;
};

export type CompositeModel = {
  ridge: RidgeCoeffs;
  pca: PcaWeights;
};
