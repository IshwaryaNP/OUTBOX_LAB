import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

// In-memory cache of transporters per sender email
const transporterCache = new Map<string, nodemailer.Transporter>();

export async function createEtherealAccount(): Promise<SmtpConfig> {
  const testAccount = await nodemailer.createTestAccount();
  return {
    host: 'smtp.ethereal.email',
    port: 587,
    user: testAccount.user,
    pass: testAccount.pass,
  };
}

export function getOrCreateTransporter(config: SmtpConfig): nodemailer.Transporter {
  const cacheKey = `${config.user}@${config.host}:${config.port}`;
  if (!transporterCache.has(cacheKey)) {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    transporterCache.set(cacheKey, transporter);
  }
  return transporterCache.get(cacheKey)!;
}

export async function sendEmailViaSmtp(options: {
  senderConfig: SmtpConfig;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
}) {
  const transporter = getOrCreateTransporter(options.senderConfig);

  const info = await transporter.sendMail({
    from: `"${options.fromName}" <${options.fromEmail}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return {
    messageId: info.messageId,
    previewUrl: previewUrl || undefined,
  };
}

