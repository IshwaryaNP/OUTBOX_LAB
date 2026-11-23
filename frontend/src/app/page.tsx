'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { EmailTable } from '@/components/EmailTable';
import { ComposeModal } from '@/components/ComposeModal';
import { SlackModal } from '@/components/SlackModal';
import { User, EmailRecord } from '@/types';
import { fetchWithAuth } from '@/lib/api';
import { Search, Plus, Calendar, CheckSquare, RefreshCw, LogIn } from 'lucide-react';

// Default initial demo user so dashboard loads immediately
const DEFAULT_USER: User = {
  id: 'demo-user-id',
  name: 'ReachInbox Recruiter',
  email: 'recruiter@reachinbox.test',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
  slackConnected: false,
};

// Seed demo emails so the dashboard displays data even without a live backend connection
const INITIAL_SCHEDULED: EmailRecord[] = [
  {
    id: 'sch-1',
    recipient: 'alex.rivera@techflow.io',
    subject: 'Transforming cold outreach with ReachInbox AI',
    body: 'Hi Alex, I saw your recent launch and thought you would love ReachInbox.',
    scheduledFor: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
    status: 'SCHEDULED',
    sender: { name: 'Growth Team', email: 'sender1@reachinbox.ethereal.email' },
  },
  {
    id: 'sch-2',
    recipient: 'sarah.chen@innovateai.com',
    subject: 'AI Sequence Optimization for InnovateAI',
    body: 'Hi Sarah, let us automate your prospecting pipeline.',
    scheduledFor: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
    status: 'SCHEDULED',
    sender: { name: 'Growth Team', email: 'sender2@reachinbox.ethereal.email' },
  },
  {
    id: 'sch-3',
    recipient: 'david.kim@nexusgrowth.co',
    subject: 'High-intent lead generation',
    body: 'Reaching out regarding your cold email delivery rates.',
    scheduledFor: new Date(Date.now() + 1000 * 60 * 120).toISOString(),
    status: 'RATE_LIMITED',
    sender: { name: 'Growth Team', email: 'sender1@reachinbox.ethereal.email' },
  },
];

const INITIAL_SENT: EmailRecord[] = [
  {
    id: 'sent-1',
    recipient: 'michael.scott@dundermifflin.com',
    subject: 'Exclusive cold email pilot for Dunder Mifflin',
    body: 'Automate your paper sales pipeline with intelligent AI sequences.',
    scheduledFor: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    sentAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    status: 'SENT',
    etherealPreviewUrl: 'https://ethereal.email/message/Zu304892jklsd',
    sender: { name: 'Growth Team', email: 'sender1@reachinbox.ethereal.email' },
  },
  {
    id: 'sent-2',
    recipient: 'elena.rostova@cloudscale.net',
    subject: 'Scaling outreach infrastructure 10x',
    body: 'Hi Elena, let us connect to talk about persistent email scheduling.',
    scheduledFor: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    sentAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    status: 'SENT',
    etherealPreviewUrl: 'https://ethereal.email/message/Yx109238asdfl',
    sender: { name: 'Growth Team', email: 'sender2@reachinbox.ethereal.email' },
  },
];

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(DEFAULT_USER);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>(INITIAL_SCHEDULED);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>(INITIAL_SENT);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);

  // Attempt backend login, but fallback seamlessly to local mock
  const handleLogin = async (mockEmail?: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mockEmail || 'recruiter@reachinbox.test',
          name: 'ReachInbox Recruiter',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('reachinbox_token', data.token);
        setUser(data.user);
        return;
      }
    } catch {
      // Backend not running remotely; proceed with default user
    }
    setUser(DEFAULT_USER);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        // Try backend search first
        try {
          const searchRes = await fetchWithAuth(`/emails/search?q=${encodeURIComponent(searchQuery)}`);
          if (searchRes?.results) {
            const results: EmailRecord[] = searchRes.results;
            setScheduledEmails(results.filter((e) => ['SCHEDULED', 'RATE_LIMITED', 'PROCESSING'].includes(e.status)));
            setSentEmails(results.filter((e) => ['SENT', 'FAILED'].includes(e.status)));
            return;
          }
        } catch {
          // Local filter fallback
        }
        setScheduledEmails((prev) =>
          prev.filter(
            (e) =>
              e.recipient.toLowerCase().includes(q) ||
              e.subject.toLowerCase().includes(q) ||
              e.body.toLowerCase().includes(q)
          )
        );
        setSentEmails((prev) =>
          prev.filter(
            (e) =>
              e.recipient.toLowerCase().includes(q) ||
              e.subject.toLowerCase().includes(q) ||
              e.body.toLowerCase().includes(q)
          )
        );
      } else {
        try {
          const [scheduledRes, sentRes] = await Promise.all([
            fetchWithAuth('/emails/scheduled?limit=50'),
            fetchWithAuth('/emails/sent?limit=50'),
          ]);
          if (scheduledRes?.emails) setScheduledEmails(scheduledRes.emails);
          if (sentRes?.emails) setSentEmails(sentRes.emails);
        } catch {
          // Keep mock emails visible
        }
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = () => {
    localStorage.removeItem('reachinbox_token');
    setUser(null);
  };

  const handleNewScheduledEmails = (newItems: EmailRecord[]) => {
    setScheduledEmails((prev) => [...newItems, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        user={user}
        onLogout={handleLogout}
        onConnectSlack={() => setIsSlackOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {!user ? (
          <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <LogIn className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Welcome to ReachInbox Scheduler</h2>
            <p className="text-xs text-slate-500">
              Sign in to manage and monitor cold email sequences with persistent BullMQ queues.
            </p>
            <button
              onClick={() => handleLogin()}
              className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition shadow-md"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Toolbar: Search + Compose Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              {/* Tabs */}
              <div className="flex items-center space-x-1 p-1 bg-slate-200/60 rounded-xl max-w-fit">
                <button
                  onClick={() => setActiveTab('scheduled')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                    activeTab === 'scheduled'
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Scheduled Emails</span>
                  <span className="ml-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600 font-mono">
                    {scheduledEmails.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('sent')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                    activeTab === 'sent'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Sent Emails</span>
                  <span className="ml-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600 font-mono">
                    {sentEmails.length}
                  </span>
                </button>
              </div>

              {/* Search & Actions */}
              <div className="flex items-center space-x-3">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search leads, subject, or body..."
                    className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  />
                </div>

                <button
                  onClick={() => loadData()}
                  title="Refresh"
                  className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={() => setIsComposeOpen(true)}
                  className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition shadow-md shadow-brand-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Compose New Email</span>
                </button>
              </div>
            </div>

            {/* Email List Table */}
            <EmailTable
              emails={activeTab === 'scheduled' ? scheduledEmails : sentEmails}
              type={activeTab}
              loading={loading}
              onRefresh={loadData}
            />
          </div>
        )}
      </main>

      {/* Compose & Schedule Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={loadData}
        onAddMockEmails={handleNewScheduledEmails}
      />

      {/* Slack Rate-Limit Alert Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        userId={user?.id}
        isAlreadyConnected={user?.slackConnected}
        onClose={() => setIsSlackOpen(false)}
        onSuccess={(connected) => {
          if (user) setUser({ ...user, slackConnected: connected });
        }}
      />
    </div>
  );
}
