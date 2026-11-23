import { prisma } from '../lib/prisma.js';
import { emailQueue } from '../queues/emailQueue.js';

export async function recoverScheduledJobsOnStartup() {
  console.log('[Scheduler] Running startup recovery check for pending/scheduled emails...');
  try {
    // Find emails in SCHEDULED or RATE_LIMITED status
    const pendingEmails = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RATE_LIMITED'] },
      },
      include: {
        sender: true,
        batch: true,
      },
    });

    console.log(`[Scheduler] Found ${pendingEmails.length} pending emails in database.`);

    let rescheduledCount = 0;
    for (const email of pendingEmails) {
      if (!email.sender) continue;

      // Check if job is already waiting in BullMQ
      const existingJob = email.bullJobId ? await emailQueue.getJob(email.bullJobId) : null;
      if (existingJob) {
        // Job already registered in Redis queue
        continue;
      }

      const now = Date.now();
      const scheduledTime = new Date(email.scheduledFor).getTime();
      const delay = Math.max(0, scheduledTime - now);

      const job = await emailQueue.add(
        'send-email',
        {
          emailJobId: email.id,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          senderId: email.sender.id,
          userId: email.sender.userId,
          hourlyLimit: email.batch?.hourlyLimit || email.sender.hourlyLimit,
          delayBetweenEmailsMs: (email.batch?.delayBetweenEmails || 2) * 1000,
        },
        {
          jobId: `email-${email.id}`,
          delay,
        }
      );

      await prisma.emailJob.update({
        where: { id: email.id },
        data: { bullJobId: job.id },
      });

      rescheduledCount++;
    }

    console.log(`[Scheduler] Startup recovery complete: re-enqueued ${rescheduledCount} jobs.`);
  } catch (error: any) {
    console.error('[Scheduler] Error during recovery on startup:', error.message);
  }
}

