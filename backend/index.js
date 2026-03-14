
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createPdf } = require('./pdfGenerator');
const { checkDbHealth } = require('./db/client');

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
