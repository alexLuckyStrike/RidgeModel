import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT, 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const RESULTS_DIR = path.resolve(DATA_DIR, 'results');
const VISION_DIR = path.resolve(ROOT, 'vision');

await fs.mkdir(UPLOADS_DIR, { recursive: true });
await fs.mkdir(RESULTS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const sessionId = req.sessionId;
      const dest = path.join(UPLOADS_DIR, sessionId);
      await fs.mkdir(dest, { recursive: true });
      cb(null, dest);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB
  }
});

// Attach sessionId to request
app.use((req, res, next) => {
  req.sessionId = req.headers['x-session-id'] || nanoid(10);
  res.setHeader('x-session-id', req.sessionId);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, sessionId: req.sessionId });
});

/**
 * Expected multipart fields:
 *  - scale2: 1 file
 *  - scale5: 1 file
 *  - rest2: multiple
 *  - rest5: multiple
 *  - load2: multiple
 *  - load5: multiple
 *  - workout: multiple (context photo)
 *  - text: multiple (OCR photo)
 */
app.post(
  '/api/analyze',
  upload.fields([
    { name: 'scale2', maxCount: 1 },
    { name: 'scale5', maxCount: 1 },
    { name: 'rest2', maxCount: 20 },
    { name: 'rest5', maxCount: 20 },
    { name: 'load2', maxCount: 20 },
    { name: 'load5', maxCount: 20 },
    { name: 'workout', maxCount: 20 },
    { name: 'text', maxCount: 20 }
  ]),
  async (req, res) => {
    try {
      const sessionId = req.sessionId;
      const files = req.files || {};

      const payload = {
        session_id: sessionId,
        scale2: files.scale2?.[0]?.path || null,
        scale5: files.scale5?.[0]?.path || null,
        rest2: (files.rest2 || []).map(f => f.path),
        rest5: (files.rest5 || []).map(f => f.path),
        load2: (files.load2 || []).map(f => f.path),
        load5: (files.load5 || []).map(f => f.path),
        workout: (files.workout || []).map(f => f.path),
        text: (files.text || []).map(f => f.path),
        results_dir: RESULTS_DIR
      };

      const py = process.env.PYTHON || 'python3';
      const script = path.join(VISION_DIR, 'analyze.py');

      const out = await runPython(py, script, payload);

      // Persist output to results folder
      const resultPath = path.join(RESULTS_DIR, `${sessionId}_result.json`);
      await fs.writeFile(resultPath, JSON.stringify(out, null, 2), 'utf-8');

      res.json({
        ok: true,
        sessionId,
        result: out,
        saved_to: resultPath
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: String(err?.message || err) });
    }
  }
);

function runPython(py, script, payload) {
  return new Promise((resolve, reject) => {
    const proc = spawn(py, [script], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString('utf-8')));
    proc.stderr.on('data', (d) => (stderr += d.toString('utf-8')));

    proc.on('error', reject);

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python exited with code ${code}. Stderr: ${stderr}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Failed to parse python output as JSON. Stdout: ${stdout}\nStderr: ${stderr}`));
      }
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`MVP CV backend listening on http://localhost:${PORT}`);
});
