// server.ts (entry) — Chạy API: `npm run dev` (tsx) hay `node dist/server.js` (prod).
// Env: PORT, VTC_CONF_DIR, VTC_CAPTURE_DIR, VTC_TSP_BIN.
import { createApi } from './api/server.js';
import { logger } from './core/logger.js';

const port = Number(process.env['PORT'] ?? 8080);
const api = createApi({ port });

const { port: bound } = await api.listen(port);
logger.info(`listening on :${bound} (conf=${process.env['VTC_CONF_DIR'] ?? 'storage/conf'})`);
