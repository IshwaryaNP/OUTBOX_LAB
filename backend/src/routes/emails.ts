import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { emailQueue } from '../queues/emailQueue.js';
import { indexEmail, searchEmails } from '../lib/elasticsearch.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { config } from '../config/index.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// 1. Schedule New Emails (Batch or Single)
router.post('/schedule', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      recipients, // Array of email strings
      subject,
      body,
      scheduledStartTime, // ISO string or timestamp
      delayBetweenEmails = 2, // in seconds
      hourlyLimit = 200, // per sender
      senderId: customSenderId,
    } = req.body;

    const userId = req.user!.id;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient email is required.' });
    }
    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required.' });
    }

    // Get or assign sender
    let sender = customSenderId
      ? await prisma.sender.findUnique({ where: { id: customSenderId } })
      : await prisma.sender.findFirst({ where: { userId } });

    if (!sender) {
      // Pick any available sender
      sender = await prisma.sender.findFirst();
    }

    if (!sender) {
      return res.status(400).json({ error: 'No sender account found. Please configure a sender.' });
    }

    const startTime = scheduledStartTime ? new Date(scheduledStartTime).getTime() : Date.now();
    const delayStepMs = (delayBetweenEmails || config.worker.minDelayMs / 1000) * 1000;

    // Create Email Batch in DB
    const batch = await prisma.emailBatch.create({
      data: {
        userId,
        subject,
        body,
        totalEmails: recipients.length,
        delayBetweenEmails: Number(delayBetweenEmails),
        hourlyLimit: Number(hourlyLimit),
        scheduledStartTime: new Date(startTime),
      },
    });

    const scheduledJobs = [];

    // Schedule each email with calculated staggered delay
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim();
      if (!recipient) continue;

      // Stagger send time
      const targetSendTime = startTime + i * delayStepMs;
      const initialDelay = Math.max(0, targetSendTime - Date.now());

      // Create record in DB
      const emailRecord = await prisma.emailJob.create({
        data: {
          batchId: batch.id,
          senderId: sender.id,
          recipient,
          subject,
          body,
          scheduledFor: new Date(targetSendTime),
          status: 'SCHEDULED',
        },
      });

      // Add to BullMQ with idempotency Job ID
      const bullJob = await emailQueue.add(
        'send-email',
        {
          emailJobId: emailRecord.id,
          recipient,
          subject,
          body,
          senderId: sender.id,
          userId,
          hourlyLimit: Number(hourlyLimit),
          delayBetweenEmailsMs: delayStepMs,
        },
        {
          jobId: `email-${emailRecord.id}`, // Guaranteed idempotency
          delay: initialDelay,
        }
      );

      // Save bullJobId back to DB
      await prisma.emailJob.update({
        where: { id: emailRecord.id },
        data: { bullJobId: bullJob.id },
      });

      // Index in Elasticsearch
      await indexEmail({
        id: emailRecord.id,
        recipient: emailRecord.recipient,
        subject: emailRecord.subject,
        body: emailRecord.body,
        status: 'SCHEDULED',
        scheduledFor: emailRecord.scheduledFor,
        createdAt: emailRecord.createdAt,
        senderEmail: sender.email,
      });

      scheduledJobs.push({
        id: emailRecord.id,
        recipient,
        scheduledFor: emailRecord.scheduledFor,
      });
    }

    res.status(201).json({
      message: `Successfully scheduled ${scheduledJobs.length} emails.`,
      batchId: batch.id,
      scheduledEmails: scheduledJobs,
    });
  } catch (error: any) {
    console.error('[Schedule API Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to schedule emails' });
  }
});

// 2. Parse CSV / Text file of email leads
router.post('/parse-leads', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const content = req.file.buffer.toString('utf-8');
    // Extract valid emails via regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = content.match(emailRegex) || [];
    const uniqueEmails = Array.from(new Set(matches.map((e) => e.toLowerCase())));

    res.json({
      totalDetected: uniqueEmails.length,
      emails: uniqueEmails,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Scheduled Emails
router.get('/scheduled', authMiddleware, async (req, res) => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const where: any = {
      status: { in: ['SCHEDULED', 'RATE_LIMITED', 'PROCESSING'] },
    };

    if (search) {
      where.OR = [
        { recipient: { contains: String(search), mode: 'insensitive' } },
        { subject: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy: { scheduledFor: 'asc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: { sender: true },
      }),
      prisma.emailJob.count({ where }),
    ]);

    res.json({
      emails,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Sent Emails
router.get('/sent', authMiddleware, async (req, res) => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const where: any = {
      status: { in: ['SENT', 'FAILED'] },
    };

    if (search) {
      where.OR = [
        { recipient: { contains: String(search), mode: 'insensitive' } },
        { subject: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: { sender: true },
      }),
      prisma.emailJob.count({ where }),
    ]);

    res.json({
      emails,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Elasticsearch Full-Text Search
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q, status } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required.' });
    }

    const esResults = await searchEmails(String(q), status ? String(status) : undefined);

    if (esResults !== null) {
      return res.json({ source: 'elasticsearch', results: esResults });
    }

    // Graceful fallback to PostgreSQL search
    const fallbackResults = await prisma.emailJob.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        OR: [
          { recipient: { contains: String(q), mode: 'insensitive' } },
          { subject: { contains: String(q), mode: 'insensitive' } },
          { body: { contains: String(q), mode: 'insensitive' } },
        ],
      },
      orderBy: { scheduledFor: 'desc' },
      take: 50,
      include: { sender: true },
    });

    res.json({ source: 'database_fallback', results: fallbackResults });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

