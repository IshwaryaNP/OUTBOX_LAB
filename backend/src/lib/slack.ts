import { prisma } from '../lib/prisma.js';

export async function sendSlackRateLimitAlert(params: {
  userId: string;
  senderEmail: string;
  hourlyLimit: number;
  currentCount: number;
  nextAvailableWindow: Date;
}) {
  try {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId: params.userId },
    });

    if (!integration) {
      // User hasn't connected Slack; do nothing (graceful)
      return;
    }

    const message = {
      text: `🚨 *ReachInbox Rate Limit Alert* for sender \`${params.senderEmail}\``,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Email Scheduler Rate Limit Exceeded',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n${params.senderEmail}`,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n${params.hourlyLimit} emails/hr`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\nThrottle active (${params.currentCount}/${params.hourlyLimit})`,
            },
            {
              type: 'mrkdwn',
              text: `*Next Window:*\n${params.nextAvailableWindow.toLocaleTimeString()}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Remaining jobs have been safely rescheduled into the next hour window without loss.',
            },
          ],
        },
      ],
    };

    if (integration.webhookUrl) {
      const response = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      console.log(`[Slack] Sent rate-limit alert via webhook. Status: ${response.status}`);
    } else if (integration.accessToken && integration.channelId) {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${integration.accessToken}`,
        },
        body: JSON.stringify({
          channel: integration.channelId,
          ...message,
        }),
      });
      const data = await response.json();
      console.log(`[Slack] Sent rate-limit alert via API:`, data);
    }
  } catch (err: any) {
    console.error('[Slack] Failed to send rate-limit alert:', err.message);
  }
}

