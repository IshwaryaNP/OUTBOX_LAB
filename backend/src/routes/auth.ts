import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import { createEtherealAccount } from '../lib/mailer.js';

const router = Router();
const googleClient = new OAuth2Client(config.auth.googleClientId);

// Google Sign-In verification or Mock/Test Login
router.post('/google', async (req, res) => {
  try {
    const { credential, email: inputEmail, name: inputName } = req.body;
    let email = inputEmail;
    let name = inputName || 'ReachInbox User';
    let googleId = undefined;
    let avatar = undefined;

    if (credential && config.auth.googleClientId) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.auth.googleClientId,
      });
      const payload = ticket.getPayload();
      if (payload) {
        email = payload.email;
        name = payload.name || name;
        googleId = payload.sub;
        avatar = payload.picture;
      }
    }

    if (!email) {
      email = 'demo.user@reachinbox.test';
      name = 'ReachInbox Demo';
    }

    // Upsert user
    let user = await prisma.user.findUnique({
      where: { email },
      include: { slackIntegration: true, senders: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          googleId,
          avatar,
        },
        include: { slackIntegration: true, senders: true },
      });

      // Auto-provision an Ethereal Sender for the new user
      const ethereal = await createEtherealAccount();
      await prisma.sender.create({
        data: {
          userId: user.id,
          name: `${user.name} (Sender)`,
          email: ethereal.user,
          smtpHost: ethereal.host,
          smtpPort: ethereal.port,
          smtpUser: ethereal.user,
          smtpPass: ethereal.pass,
          hourlyLimit: config.worker.defaultHourlyLimit,
        },
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      config.auth.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        slackConnected: !!user.slackIntegration,
      },
    });
  } catch (error: any) {
    console.error('[Auth Error]:', error);
    res.status(500).json({ error: error.message || 'Authentication failed' });
  }
});

// Slack OAuth Callback or Webhook Connect
router.post('/slack/connect', async (req, res) => {
  try {
    const { userId, webhookUrl, channelName, accessToken, teamName } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const integration = await prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        webhookUrl: webhookUrl || undefined,
        accessToken: accessToken || undefined,
        channelName: channelName || '#email-alerts',
        teamName: teamName || 'Workspace',
      },
      create: {
        userId,
        webhookUrl,
        accessToken,
        channelName: channelName || '#email-alerts',
        teamName: teamName || 'Workspace',
      },
    });

    res.json({ success: true, integration });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/slack/disconnect/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await prisma.slackIntegration.deleteMany({
      where: { userId },
    });
    res.json({ success: true, message: 'Slack disconnected successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

