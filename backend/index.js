
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createPdf } = require('./pdfGenerator');
const { checkDbHealth } = require('./db/client');
const pool = require('./db/db.js');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const NOTES_DIR = path.join(__dirname, 'content', 'notes');

// unified endpoint for Nuxt BFF
app.get('/content/:plug', (req, res) => {
  console.log("content", req.params)
  const file = path.join(NOTES_DIR, `${req.params.plug}.md`);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const content = fs.readFileSync(file, 'utf-8');
  res.send(content);
});

// legacy endpoint (kept)
app.get('/api/notes/:name', (req, res) => {
  console.log("notes:", req.params)
  const file = path.join(NOTES_DIR, `${req.params.name}.md`);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const content = fs.readFileSync(file, 'utf-8');
  res.json({ content });
});

app.get('/api/db/health', async (req, res) => {
  const health = await checkDbHealth();
  if (!health.ok) {
    return res.status(503).json(health);
  }
  res.json(health);
});

app.get('/api/db/getAllAthletes', async (req, res) => {
  try {
    const athletes = await pool.query(`
      WITH latest_period AS (
        SELECT
          op.*,
          ROW_NUMBER() OVER (
            PARTITION BY op.athlete_id
            ORDER BY op.start_date DESC, op.created_at DESC, op.id DESC
          ) AS rn
        FROM observation_periods op
      )
      SELECT
        COALESCE(a.external_id, a.id::text) AS id,
        a.full_name AS name,
        jsonb_build_object(
          'observationWeeks', lp.weeks_count,
          'sessionsPerWeek', lp.sessions_per_week,
          'startDate', lp.start_date,
          'competitionDate', lp.competition_date
        ) AS period,
        COALESCE(
          (
            SELECT jsonb_object_agg(
              ts.week_no::text || '-' || ts.session_no::text,
              jsonb_build_object(
                'V', ts.v_points,
                'P', ts.p_points,
                'R', ts.r_points,
                'creatinine', ts.creatinine_points,
                'protein', ts.protein_points,
                'myoglobin', ts.myoglobin_points,
                'ketones', ts.ketones_points
              )
            )
            FROM training_sessions ts
            WHERE ts.period_id = lp.id
          ),
          '{}'::jsonb
        ) AS rows,
        jsonb_build_object(
          'creatinine', rb.creatinine_points,
          'protein', rb.protein_points,
          'myoglobin', rb.myoglobin_points,
          'ketones', rb.ketones_points
        ) AS "restBaseline"
      FROM athletes a
      JOIN latest_period lp
        ON lp.athlete_id = a.id
       AND lp.rn = 1
      LEFT JOIN rest_baselines rb
        ON rb.period_id = lp.id
      ORDER BY a.id;
    `)

    console.log('athletes rows:', athletes.rowCount)
    res.json(athletes.rows)
  } catch (error) {
    console.error('getAllAthletes failed:', error)
    res.status(500).json({ error: 'Failed to load athletes' })
  }
})

app.post('/pdf', async (req, res) => {
  console.log('listen')
  try {
    const payload = req.body || {};
    const pdf = await createPdf(payload);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="plan.pdf"');
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log('Backend listening on ' + PORT));
