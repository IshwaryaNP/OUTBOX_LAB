import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ReachInbox Email Scheduler & Dashboard',
  description: 'Production-grade Email Scheduler built for Outbox Labs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 min-h-screen text-slate-900">{children}</body>
    </html>
  );
}
