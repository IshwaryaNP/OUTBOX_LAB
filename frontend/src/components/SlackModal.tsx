import React, { useState } from 'react';
import { X, Slack, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';

interface SlackModalProps {
  isOpen: boolean;
  userId?: string;
  isAlreadyConnected?: boolean;
  onClose: () => void;
  onSuccess: (connected: boolean) => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  userId,
  isAlreadyConnected,
  onClose,
  onSuccess,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('#email-rate-limits');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.startsWith('https://hooks.slack.com/services/')) {
      setError('Please provide a valid incoming Slack Webhook URL starting with https://hooks.slack.com/services/');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await fetchWithAuth('/auth/slack/connect', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          webhookUrl,
          channelName,
        }),
      });

      onSuccess(true);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to connect Slack');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      await fetchWithAuth(`/auth/slack/disconnect/${userId}`, {
        method: 'DELETE',
      });
      onSuccess(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect Slack');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Slack className="w-5 h-5 text-[#E01E5A]" />
            <h2 className="text-base font-bold text-slate-800">Slack Integration</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Connect your Slack workspace so ReachInbox can automatically alert your team the moment a sender hits their hourly limit.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isAlreadyConnected ? (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 space-y-3">
              <div className="flex items-center space-x-2 text-sm font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Slack is currently connected!</span>
              </div>
              <p className="text-xs text-emerald-700">
                Rate-limit notifications are active and being delivered to your configured channel.
              </p>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition"
              >
                Disconnect Slack
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Incoming Webhook URL
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Channel Name</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition flex items-center justify-center space-x-2 shadow-md"
              >
                <Slack className="w-4 h-4" />
                <span>{loading ? 'Connecting...' : 'Authorize & Connect Slack'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

