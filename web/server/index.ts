import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createCurriculumRouter } from './curriculum/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const WEB_ROOT = path.resolve(__dirname, '..');
const CURRICULUM_DIR = path.join(REPO_ROOT, 'curriculum');
const ASSETS_DIR = path.join(REPO_ROOT, 'mobile', 'assets');
const PORT = 4701;

async function main(): Promise<void> {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, curriculumDir: CURRICULUM_DIR });
  });

  app.use('/api', express.json({ limit: '2mb' }), createCurriculumRouter(REPO_ROOT, WEB_ROOT));

  app.use('/assets', express.static(ASSETS_DIR));

  if (!isProduction) {
    const vite = await createViteServer({
      configFile: path.join(WEB_ROOT, 'vite.config.ts'),
      root: WEB_ROOT,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(WEB_ROOT, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Curriculum Studio → http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
