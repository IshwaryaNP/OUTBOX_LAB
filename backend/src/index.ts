import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';

import { config } from './config/index.js';
import { emailQueue } from './queues/emailQueue.js';
import { startEmailWorker } from './queues/emailWorker.js';
import { recoverScheduledJobsOnStartup } from './queues/recovery.js';
import { initElasticsearch } from './lib/elasticsearch.js';

import authRouter from './routes/auth.js';
import emailRouter from './routes/emails.js';

const app = express();

// Middleware
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bull-Board Queue Visibility Dashboard Setup
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/emails', emailRouter);

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    bullBoardUrl: '/admin/queues',
  });
});

// Start Server and Background Workers
const PORT = config.port;

app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🚀 ReachInbox Scheduler Backend running on port ${PORT}`);
  console.log(`📊 Bull-Board Dashboard: http://localhost:${PORT}/admin/queues`);
  console.log(`====================================================`);

  // Initialize Elasticsearch index
  await initElasticsearch();

  // Start BullMQ Worker
  startEmailWorker();

  // Run startup recovery to preserve jobs across restarts
  await recoverScheduledJobsOnStartup();
});

export default app;

