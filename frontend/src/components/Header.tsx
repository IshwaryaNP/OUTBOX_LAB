import React from 'react';
import { User } from '@/types';
import { LogOut, Send, Bell, ExternalLink } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onConnectSlack: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onConnectSlack }) => {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Send className="w-5 h-5 -rotate-45" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-brand-700 to-indigo-600 bg-clip-text text-transparent">
              ReachInbox<span className="text-brand-600 font-extrabold">.ai</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">Outbox Labs • Email Job Scheduler</p>
          </div>
        </div>

        {/* User profile & Slack integration button */}
        <div className="flex items-center space-x-4">
          <a
            href="http://localhost:5000/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            <span>Live BullMQ Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5 ml-1 text-slate-500" />
          </a>

          <button
            onClick={onConnectSlack}
            className={`flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
              user?.slackConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Bell className={`w-3.5 h-3.5 mr-1.5 ${user?.slackConnected ? 'text-emerald-600' : 'text-slate-400'}`} />
            {user?.slackConnected ? 'Slack Connected' : 'Connect Slack'}
          </button>

          {user && (
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-200">
              <img
                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-slate-300 object-cover"
              />
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-slate-800 leading-none">{user.name}</p>
                <p className="text-xs text-slate-500 truncate max-w-[140px] mt-0.5">{user.email}</p>
              </div>
              <button
                onClick={onLogout}
                title="Logout"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

