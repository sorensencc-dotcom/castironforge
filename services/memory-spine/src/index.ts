import express from 'express';
import { queryRouter } from './routes/query.js';
import { editRouter } from './routes/edit.js';
import { adminRouter } from './routes/admin.js';
import { provenanceRouter } from './routes/provenance.js';
import { loadVersions } from './store/versions.js';

const app = express();
app.use(express.json());

app.use('/v1/memory/query', queryRouter);
app.use('/v1/memory/edit', editRouter);
app.use('/v1/memory/admin', adminRouter);
app.use('/v1/memory/provenance', provenanceRouter);

app.get('/health', (_req, res) => {
  const { active } = loadVersions();
  res.json({ status: 'ok', active_version: active, uptime_seconds: Math.floor(process.uptime()) });
});

const PORT = parseInt(process.env.MEMORY_SPINE_PORT ?? '3100', 10);
app.listen(PORT, () => {
  const { active } = loadVersions();
  console.log(`CIC Memory Spine listening on :${PORT} (active: ${active})`);
});
