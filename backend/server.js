const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = 5000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let emailsDb = [
  {
    id: 'seed-1',
    recipient: 'alex.rivera@techflow.io',
    subject: 'Transforming cold outreach with ReachInbox AI',
    body: 'Automate your lead workflows with persistent scheduling.',
    scheduledFor: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
    status: 'SCHEDULED',
    sender: { name: 'Growth Team', email: 'sender1@ethereal.email' },
  },
  {
    id: 'seed-2',
    recipient: 'sarah.chen@innovateai.com',
    subject: 'AI Sequence Optimization for InnovateAI',
    body: 'Prospecting and verification in a single prompt.',
    scheduledFor: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
    status: 'SCHEDULED',
    sender: { name: 'Growth Team', email: 'sender2@ethereal.email' },
  },
  {
    id: 'seed-3',
    recipient: 'michael.scott@dundermifflin.com',
    subject: 'Exclusive cold email pilot for Dunder Mifflin',
    body: 'Scale paper sales outreach with AI personalization.',
    scheduledFor: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    sentAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    status: 'SENT',
    etherealPreviewUrl: 'https://ethereal.email',
    sender: { name: 'Growth Team', email: 'sender1@ethereal.email' },
  },
];

let slackConfig = {};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), totalEmails: emailsDb.length });
});

app.post('/api/auth/google', (req, res) => {
  const { email, name } = req.body;
  res.json({
    token: 'reachinbox-mock-jwt-token-2026',
    user: {
      id: 'demo-user-id',
      email: email || 'recruiter@reachinbox.test',
      name: name || 'ReachInbox Recruiter',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      slackConnected: !!slackConfig.webhookUrl,
    },
  });
});

app.post('/api/auth/slack/connect', (req, res) => {
  const { webhookUrl, channelName } = req.body;
  slackConfig = { webhookUrl, channelName: channelName || '#email-alerts' };
  res.json({ success: true, slackConfig });
});

app.delete('/api/auth/slack/disconnect/:userId', (req, res) => {
  slackConfig = {};
  res.json({ success: true, message: 'Slack disconnected' });
});

app.post('/api/emails/parse-leads', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const content = req.file.buffer.toString('utf-8');
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = content.match(emailRegex) || [];
    const uniqueEmails = Array.from(new Set(matches.map((e) => e.toLowerCase())));

    res.json({
      totalDetected: uniqueEmails.length,
      emails: uniqueEmails,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/emails/schedule', (req, res) => {
  try {
    const { recipients, subject, body, scheduledStartTime, delayBetweenEmails = 2, hourlyLimit = 200 } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients list is required' });
    }

    const startTime = scheduledStartTime ? new Date(scheduledStartTime).getTime() : Date.now();
    const delayStepMs = Number(delayBetweenEmails) * 1000;
    const newItems = [];

    recipients.forEach((emailStr, idx) => {
      const email = emailStr.trim();
      if (!email) return;

      const targetTime = new Date(startTime + idx * delayStepMs).toISOString();
      const newEmail = {
        id: `job-${Date.now()}-${idx}`,
        recipient: email,
        subject,
        body,
        scheduledFor: targetTime,
        status: idx >= Number(hourlyLimit) ? 'RATE_LIMITED' : 'SCHEDULED',
        sender: { name: 'Growth Team', email: `sender${(idx % 2) + 1}@ethereal.email` },
      };
      newItems.push(newEmail);
      emailsDb.unshift(newEmail);
    });

    res.status(201).json({
      message: `Successfully scheduled ${newItems.length} emails.`,
      scheduledEmails: newItems,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/emails/scheduled', (req, res) => {
  const { search } = req.query;
  let items = emailsDb.filter((e) => ['SCHEDULED', 'RATE_LIMITED', 'PROCESSING'].includes(e.status));
  if (search) {
    const q = String(search).toLowerCase();
    items = items.filter((e) => e.recipient.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q));
  }
  res.json({ emails: items, total: items.length });
});

app.get('/api/emails/sent', (req, res) => {
  const { search } = req.query;
  let items = emailsDb.filter((e) => ['SENT', 'FAILED'].includes(e.status));
  if (search) {
    const q = String(search).toLowerCase();
    items = items.filter((e) => e.recipient.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q));
  }
  res.json({ emails: items, total: items.length });
});

app.get('/api/emails/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ results: emailsDb });
  const query = String(q).toLowerCase();
  const results = emailsDb.filter(
    (e) =>
      e.recipient.toLowerCase().includes(query) ||
      e.subject.toLowerCase().includes(query) ||
      e.body.toLowerCase().includes(query)
  );
  res.json({ source: 'database', results });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ReachInbox Scheduler Backend running on http://localhost:${PORT}`);
  console.log(`📡 Ready to receive file uploads and email scheduling`);
  console.log(`====================================================`);
});
