#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { getPool } = require('./client');

const EPS = 1e-9;
const REQUIRED_ROW_FIELDS = ['V', 'P', 'R', 'creatinine', 'protein', 'myoglobin', 'ketones'];

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function asNumber(value, fieldPath, { allowNull = false } = {}) {
  if (value === null || value === undefined) {
    if (allowNull) {
      return null;
    }
    throw new Error(`Missing numeric value at "${fieldPath}"`);
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid numeric value at "${fieldPath}": ${value}`);
  }
  if (num < 0) {
    throw new Error(`Negative value is not allowed at "${fieldPath}": ${num}`);
  }
  return num;
}

function asPositiveInt(value, fieldPath) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`Expected positive integer at "${fieldPath}", got: ${value}`);
  }
  return num;
}

function numbersEqual(a, b) {
  return Math.abs(a - b) < EPS;
}

function normalizeAthlete(rawAthlete, index) {
  const ctx = `athletes[${index}]`;
  if (!rawAthlete || typeof rawAthlete !== 'object') {
    throw new Error(`${ctx} must be an object`);
  }

  const externalId = rawAthlete.id;
  if (typeof externalId !== 'string' || externalId.trim() === '') {
    throw new Error(`${ctx}.id must be a non-empty string`);
  }

  const fullName = rawAthlete.name;
  if (typeof fullName !== 'string' || fullName.trim() === '') {
    throw new Error(`${ctx}.name must be a non-empty string`);
  }

  const period = rawAthlete.period || {};
  const observationWeeks = asPositiveInt(period.observationWeeks, `${ctx}.period.observationWeeks`);
  const sessionsPerWeek = asPositiveInt(period.sessionsPerWeek, `${ctx}.period.sessionsPerWeek`);
  const startDate = period.startDate;
  const competitionDate = period.competitionDate;

  if (!isIsoDate(startDate) || !isIsoDate(competitionDate)) {
    throw new Error(`${ctx}.period.startDate and competitionDate must be YYYY-MM-DD`);
  }
  if (startDate >= competitionDate) {
    throw new Error(`${ctx}.period.startDate must be before competitionDate`);
  }

  const restBaselineRaw = rawAthlete.restBaseline || {};
  const restBaseline = {
    creatinine: asNumber(restBaselineRaw.creatinine, `${ctx}.restBaseline.creatinine`),
    protein: asNumber(restBaselineRaw.protein, `${ctx}.restBaseline.protein`),
    myoglobin: asNumber(restBaselineRaw.myoglobin, `${ctx}.restBaseline.myoglobin`),
    ketones: asNumber(restBaselineRaw.ketones, `${ctx}.restBaseline.ketones`),
  };

  const rowsRaw = rawAthlete.rows;
  if (!rowsRaw || typeof rowsRaw !== 'object' || Array.isArray(rowsRaw)) {
    throw new Error(`${ctx}.rows must be an object`);
  }

  if (!Object.prototype.hasOwnProperty.call(rowsRaw, '0-0')) {
    throw new Error(`${ctx}.rows must contain "0-0" baseline row`);
  }

  const baselineRow = rowsRaw['0-0'];
  for (const field of REQUIRED_ROW_FIELDS) {
    asNumber(baselineRow?.[field], `${ctx}.rows.0-0.${field}`);
  }

  if (
    !numbersEqual(asNumber(baselineRow.creatinine, `${ctx}.rows.0-0.creatinine`), restBaseline.creatinine) ||
    !numbersEqual(asNumber(baselineRow.protein, `${ctx}.rows.0-0.protein`), restBaseline.protein) ||
    !numbersEqual(asNumber(baselineRow.myoglobin, `${ctx}.rows.0-0.myoglobin`), restBaseline.myoglobin) ||
    !numbersEqual(asNumber(baselineRow.ketones, `${ctx}.rows.0-0.ketones`), restBaseline.ketones)
  ) {
    throw new Error(`${ctx}.rows["0-0"] values must match restBaseline values`);
  }

  const sessions = [];
  const keys = Object.keys(rowsRaw);
  for (const rowKey of keys) {
    if (!/^\d+-\d+$/.test(rowKey)) {
      throw new Error(`${ctx}.rows key "${rowKey}" must match "week-session"`);
    }
    const [weekRaw, sessionRaw] = rowKey.split('-');
    const weekNo = Number(weekRaw);
    const sessionNo = Number(sessionRaw);
    const row = rowsRaw[rowKey];

    for (const field of REQUIRED_ROW_FIELDS) {
      asNumber(row?.[field], `${ctx}.rows.${rowKey}.${field}`);
    }

    if (weekNo === 0 && sessionNo === 0) {
      continue;
    }
    if (weekNo <= 0 || sessionNo <= 0) {
      throw new Error(`${ctx}.rows.${rowKey} has invalid week/session. Only "0-0" may use zeros`);
    }
    if (weekNo > observationWeeks) {
      throw new Error(`${ctx}.rows.${rowKey} week exceeds observationWeeks (${observationWeeks})`);
    }
    if (sessionNo > sessionsPerWeek) {
      throw new Error(`${ctx}.rows.${rowKey} session exceeds sessionsPerWeek (${sessionsPerWeek})`);
    }

    sessions.push({
      weekNo,
      sessionNo,
      v: asNumber(row.V, `${ctx}.rows.${rowKey}.V`),
      p: asNumber(row.P, `${ctx}.rows.${rowKey}.P`),
      r: asNumber(row.R, `${ctx}.rows.${rowKey}.R`),
      creatinine: asNumber(row.creatinine, `${ctx}.rows.${rowKey}.creatinine`, { allowNull: true }),
      protein: asNumber(row.protein, `${ctx}.rows.${rowKey}.protein`, { allowNull: true }),
      myoglobin: asNumber(row.myoglobin, `${ctx}.rows.${rowKey}.myoglobin`, { allowNull: true }),
      ketones: asNumber(row.ketones, `${ctx}.rows.${rowKey}.ketones`, { allowNull: true }),
    });
  }

  const expectedTrainingRows = observationWeeks * sessionsPerWeek;
  if (sessions.length !== expectedTrainingRows) {
    throw new Error(
      `${ctx}.rows has ${sessions.length} training rows, expected ${expectedTrainingRows} by period`
    );
  }

  sessions.sort((a, b) => a.weekNo - b.weekNo || a.sessionNo - b.sessionNo);

  return {
    externalId,
    fullName,
    weightCategoryPoints: asNumber(rawAthlete.weightClassKg, `${ctx}.weightClassKg`, {
      allowNull: true,
    }),
    period: {
      weeksCount: observationWeeks,
      sessionsPerWeek,
      startDate,
      competitionDate,
      benchPressPoints: asNumber(rawAthlete.benchKg, `${ctx}.benchKg`, { allowNull: true }),
      squatPoints: asNumber(rawAthlete.squatKg, `${ctx}.squatKg`, { allowNull: true }),
      deadliftPoints: asNumber(rawAthlete.deadliftKg, `${ctx}.deadliftKg`, { allowNull: true }),
      totalPoints: asNumber(rawAthlete.totalKg, `${ctx}.totalKg`, { allowNull: true }),
      sportRank: rawAthlete.rank ?? null,
    },
    restBaseline,
    sessions,
  };
}

function parseInput(rawData) {
  if (!Array.isArray(rawData)) {
    throw new Error('Input JSON root must be an array');
  }

  const seen = new Set();
  const athletes = rawData.map((item, idx) => normalizeAthlete(item, idx));
  for (const athlete of athletes) {
    if (seen.has(athlete.externalId)) {
      throw new Error(`Duplicate athlete id: ${athlete.externalId}`);
    }
    seen.add(athlete.externalId);
  }
  return athletes;
}

async function importData(athletes) {
  const pool = getPool();
  const client = await pool.connect();

  let insertedAthletes = 0;
  let insertedPeriods = 0;
  let insertedBaselines = 0;
  let insertedSessions = 0;

  try {
    await client.query('BEGIN');

    await client.query(
      `
        TRUNCATE TABLE
          training_sessions,
          rest_baselines,
          observation_periods,
          athletes
        RESTART IDENTITY CASCADE
      `
    );

    for (const athlete of athletes) {
      const athleteRes = await client.query(
        `
          INSERT INTO athletes (external_id, full_name, weight_category_points)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [athlete.externalId, athlete.fullName, athlete.weightCategoryPoints]
      );
      insertedAthletes += 1;
      const athleteId = athleteRes.rows[0].id;

      const periodRes = await client.query(
        `
          INSERT INTO observation_periods (
            athlete_id,
            weeks_count,
            sessions_per_week,
            start_date,
            competition_date,
            bench_press_points,
            squat_points,
            deadlift_points,
            total_points,
            sport_rank
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          RETURNING id
        `,
        [
          athleteId,
          athlete.period.weeksCount,
          athlete.period.sessionsPerWeek,
          athlete.period.startDate,
          athlete.period.competitionDate,
          athlete.period.benchPressPoints,
          athlete.period.squatPoints,
          athlete.period.deadliftPoints,
          athlete.period.totalPoints,
          athlete.period.sportRank,
        ]
      );
      insertedPeriods += 1;
      const periodId = periodRes.rows[0].id;

      await client.query(
        `
          INSERT INTO rest_baselines (
            period_id,
            creatinine_points,
            protein_points,
            myoglobin_points,
            ketones_points
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          periodId,
          athlete.restBaseline.creatinine,
          athlete.restBaseline.protein,
          athlete.restBaseline.myoglobin,
          athlete.restBaseline.ketones,
        ]
      );
      insertedBaselines += 1;

      for (const session of athlete.sessions) {
        await client.query(
          `
            INSERT INTO training_sessions (
              period_id,
              week_no,
              session_no,
              v_points,
              p_points,
              r_points,
              creatinine_points,
              protein_points,
              myoglobin_points,
              ketones_points
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          `,
          [
            periodId,
            session.weekNo,
            session.sessionNo,
            session.v,
            session.p,
            session.r,
            session.creatinine,
            session.protein,
            session.myoglobin,
            session.ketones,
          ]
        );
        insertedSessions += 1;
      }
    }

    await client.query('COMMIT');

    const verifyAthletes = await client.query(
      'SELECT COUNT(*)::int AS count FROM athletes'
    );
    const verifyPeriods = await client.query(
      'SELECT COUNT(*)::int AS count FROM observation_periods'
    );
    const verifyBaselines = await client.query(
      'SELECT COUNT(*)::int AS count FROM rest_baselines'
    );
    const verifySessions = await client.query(
      'SELECT COUNT(*)::int AS count FROM training_sessions'
    );

    return {
      inserted: {
        athletes: insertedAthletes,
        observation_periods: insertedPeriods,
        rest_baselines: insertedBaselines,
        training_sessions: insertedSessions,
      },
      verified: {
        athletes: verifyAthletes.rows[0].count,
        observation_periods: verifyPeriods.rows[0].count,
        rest_baselines: verifyBaselines.rows[0].count,
        training_sessions: verifySessions.rows[0].count,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const inputArg = process.argv[2] || 'MarkersPhis.json';
  const inputPath = path.resolve(process.cwd(), inputArg);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const data = JSON.parse(raw);
  const athletes = parseInput(data);

  const expectedSessions = athletes.reduce((sum, a) => sum + a.sessions.length, 0);
  console.log(
    `Validation passed: athletes=${athletes.length}, training_sessions=${expectedSessions}, source=${inputPath}`
  );

  const result = await importData(athletes);
  console.log('Import done:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(`Import failed: ${error.message}`);
  process.exit(1);
});
