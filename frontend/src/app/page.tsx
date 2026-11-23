'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { EmailTable } from '@/components/EmailTable';
import { ComposeModal } from '@/components/ComposeModal';
import { SlackModal } from '@/components/SlackModal';
import { User, EmailRecord } from '@/types';
import { fetchWithAuth } from '@/lib/api';
import { Search, Plus, Calendar, CheckSquare, RefreshCw, LogIn } from 'lucide-react';

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);

  // Initial authentication (or auto-login for demo)
  const handleAutoLogin = async (mockEmail?: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mockEmail || 'demo.user@reachinbox.test',
          name: 'ReachInbox Demo User',
        }),
      });
      const data = await res.json();
      localStorage.setItem('reachinbox_token', data.token);
      setUser(data.user);
    } catch (err) {
      console.error('Failed auto login:', err);
    }
  };

  useEffect(() => {
    handleAutoLogin();
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const searchRes = await fetchWithAuth(
          `/emails/search?q=${encodeURIComponent(searchQuery)}`
        );
        const results: EmailRecord[] = searchRes.results || [];
        setScheduledEmails(results.filter((e) => ['SCHEDULED', 'RATE_LIMITED', 'PROCESSING'].includes(e.status)));
        setSentEmails(results.filter((e) => ['SENT', 'FAILED'].includes(e.status)));
      } else {
        const [scheduledRes, sentRes] = await Promise.all([
          fetchWithAuth('/emails/scheduled?limit=50'),
          fetchWithAuth('/emails/sent?limit=50'),
        ]);
        setScheduledEmails(scheduledRes.emails || []);
        setSentEmails(sentRes.emails || []);
      }
    } catch (err) {
      console.error('Error fetching emails:', err);
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery]);

  useEffect(() => {
    loadData();
    // Auto polling every 10 seconds for real-time queue visibility
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleLogout = () => {
    localStorage.removeItem('reachinbox_token');
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
              Sign in with Google to manage and monitor cold email sequences with persistent BullMQ queues.
            </p>
            <button
              onClick={() => handleAutoLogin()}
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
