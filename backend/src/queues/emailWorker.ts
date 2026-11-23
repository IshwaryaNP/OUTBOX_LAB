import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData } from './emailQueue.js';
import { redisConnection } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { sendEmailViaSmtp } from '../lib/mailer.js';
import { RateLimiter } from '../lib/rateLimiter.js';
import { sendSlackRateLimitAlert } from '../lib/slack.js';
import { indexEmail } from '../lib/elasticsearch.js';
import { config } from '../config/index.js';

export function startEmailWorker() {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailJobId, recipient, subject, body, senderId, userId, hourlyLimit, delayBetweenEmailsMs } = job.data;
      console.log(`[Worker] Processing Job ${job.id} for EmailRecord ${emailJobId} -> ${recipient}`);

      // 1. Fetch Email and Sender from database
      const emailRecord = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
        include: { sender: true },
      });

      if (!emailRecord) {
        console.warn(`[Worker] EmailJob ${emailJobId} no longer exists. Skipping.`);
        return;
      }

      // Idempotency: Skip if already marked as SENT
      if (emailRecord.status === 'SENT') {
        console.log(`[Worker] EmailJob ${emailJobId} is already marked as SENT. Skipping.`);
        return;
      }

      const sender = emailRecord.sender;
      if (!sender) {
        throw new Error(`Sender account not found for job ${emailJobId}`);
      }

      // 2. Check Hourly Rate Limit
      const effectiveHourlyLimit = hourlyLimit || sender.hourlyLimit || config.worker.defaultHourlyLimit;
      const rateLimitCheck = await RateLimiter.checkAndIncrement(sender.id, effectiveHourlyLimit);

      if (!rateLimitCheck.allowed) {
        console.warn(
          `[Worker] Sender ${sender.email} reached hourly limit (${rateLimitCheck.currentCount}/${effectiveHourlyLimit}). Rescheduling.`
        );

        // Update status in DB
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'RATE_LIMITED',
            scheduledFor: rateLimitCheck.resetAt,
          },
        });

        // Trigger Slack Notification once per window
        const shouldNotify = await RateLimiter.shouldNotifySlack(sender.id);
        if (shouldNotify) {
          await sendSlackRateLimitAlert({
            userId,
            senderEmail: sender.email,
            hourlyLimit: effectiveHourlyLimit,
            currentCount: rateLimitCheck.currentCount,
            nextAvailableWindow: rateLimitCheck.resetAt,
          });
        }

        // Reschedule job into next available hour window
        await job.moveToDelayed(Date.now() + rateLimitCheck.msUntilReset, job.token);
        return;
      }

      // 3. Mark as PROCESSING in DB
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: 'PROCESSING' },
      });

      try {
        // 4. Send Email via Ethereal SMTP
        const sendResult = await sendEmailViaSmtp({
          senderConfig: {
            host: sender.smtpHost,
            port: sender.smtpPort,
            user: sender.smtpUser,
            pass: sender.smtpPass,
          },
          fromName: sender.name,
          fromEmail: sender.email,
          to: recipient,
          subject,
          html: body,
        });

        const sentAt = new Date();

        // 5. Update DB record to SENT
        const updatedEmail = await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'SENT',
            sentAt,
            etherealPreviewUrl: sendResult.previewUrl,
          },
        });

        console.log(`[Worker] Email sent to ${recipient}! Ethereal preview: ${sendResult.previewUrl || 'N/A'}`);

        // 6. Index into Elasticsearch
        await indexEmail({
          id: updatedEmail.id,
          recipient: updatedEmail.recipient,
          subject: updatedEmail.subject,
          body: updatedEmail.body,
          status: 'SENT',
          scheduledFor: updatedEmail.scheduledFor,
          sentAt: updatedEmail.sentAt,
          createdAt: updatedEmail.createdAt,
          senderEmail: sender.email,
        });

        // 7. Enforce configurable delay between each send (mimics provider throttling)
        const delayMs = Math.max(delayBetweenEmailsMs || config.worker.minDelayMs, 1000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        return { success: true, previewUrl: sendResult.previewUrl };
      } catch (sendError: any) {
        console.error(`[Worker] Error sending email ${emailJobId}:`, sendError.message);

        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'FAILED',
            errorMessage: sendError.message,
            attempts: { increment: 1 },
          },
        });

        throw sendError; // Triggers BullMQ retry backoff
      }
    },
    {
      connection: redisConnection,
      concurrency: config.worker.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[BullMQ Worker Error]:', err.message);
  });

  return worker;
}

