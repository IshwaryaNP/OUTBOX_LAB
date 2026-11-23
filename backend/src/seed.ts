import { prisma } from './lib/prisma.js';
import { createEtherealAccount } from './lib/mailer.js';

async function seed() {
  console.log('[Seed] Seeding initial ReachInbox data...');

  // 1. Create Demo User
  const user = await prisma.user.upsert({
    where: { email: 'demo@reachinbox.test' },
    update: {},
    create: {
      email: 'demo@reachinbox.test',
      name: 'ReachInbox Demo User',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
  });

  console.log(`[Seed] Demo user created: ${user.email} (${user.id})`);

  // 2. Create Multiple Senders with Ethereal accounts
  const senderCount = await prisma.sender.count({ where: { userId: user.id } });
  if (senderCount < 2) {
    console.log('[Seed] Generating 2 fake Ethereal SMTP accounts for multi-sender testing...');
    for (let i = 1; i <= 2; i++) {
      const ethereal = await createEtherealAccount();
      const sender = await prisma.sender.create({
        data: {
          userId: user.id,
          name: `Growth Sender #${i}`,
          email: ethereal.user,
          smtpHost: ethereal.host,
          smtpPort: ethereal.port,
          smtpUser: ethereal.user,
          smtpPass: ethereal.pass,
          hourlyLimit: 100,
        },
      });
      console.log(`[Seed] Created Sender #${i}: ${sender.email}`);
    }
  }

  console.log('[Seed] Seeding finished successfully.');
}

seed()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

