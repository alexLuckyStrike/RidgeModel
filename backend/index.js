
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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

app.post('/pdf', async (req, res) => {
  try {
    // пока просто проверяем, что данные доходят
    const payload = req.body;

    console.log('PDF payload received, size:',
      JSON.stringify(payload).length / 1024, 'kb'
    );

    // ВРЕМЕННАЯ ЗАГЛУШКА PDF
    // Отдаем пустой PDF, чтобы Nuxt не падал
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="plan.pdf"');

    // минимальный валидный PDF
    const emptyPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'
    );

    res.send(emptyPdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log('Backend listening on ' + PORT));
