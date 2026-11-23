import React from 'react';
import { EmailRecord } from '@/types';
import { Clock, AlertCircle, ExternalLink, RefreshCw, Send, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface EmailTableProps {
  emails: EmailRecord[];
  type: 'scheduled' | 'sent';
  loading: boolean;
  onRefresh: () => void;
}

export const EmailTable: React.FC<EmailTableProps> = ({ emails, type, loading, onRefresh }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-6 h-6 text-brand-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading emails from server...</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
          {type === 'scheduled' ? <Clock className="w-6 h-6" /> : <Send className="w-6 h-6" />}
        </div>
        <h3 className="text-sm font-bold text-slate-700">
          No {type === 'scheduled' ? 'Scheduled' : 'Sent'} Emails Found
        </h3>
        <p className="text-xs text-slate-400 max-w-sm">
          {type === 'scheduled'
            ? 'You have no emails waiting to be dispatched. Click "Compose New Email" above to schedule a sequence.'
            : 'No dispatched emails have been logged yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-6">Recipient Lead</th>
              <th className="py-3.5 px-6">Subject</th>
              <th className="py-3.5 px-6">Sender Account</th>
              <th className="py-3.5 px-6">{type === 'scheduled' ? 'Scheduled Time' : 'Sent Time'}</th>
              <th className="py-3.5 px-6 text-center">Status</th>
              {type === 'sent' && <th className="py-3.5 px-6 text-right">Ethereal Preview</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {emails.map((email) => {
              const statusColors: Record<string, string> = {
                SCHEDULED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                PROCESSING: 'bg-amber-50 text-amber-700 border-amber-200',
                SENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
                RATE_LIMITED: 'bg-orange-50 text-orange-700 border-orange-200',
              };

              return (
                <tr key={email.id} className="hover:bg-slate-50/60 transition">
                  {/* Recipient */}
                  <td className="py-4 px-6 font-semibold text-slate-900">{email.recipient}</td>

                  {/* Subject */}
                  <td className="py-4 px-6 max-w-xs truncate text-slate-600" title={email.subject}>
                    {email.subject}
                  </td>

                  {/* Sender */}
                  <td className="py-4 px-6 text-slate-500 font-mono text-[11px]">
                    {email.sender?.email || 'Auto Assigned'}
                  </td>

                  {/* Time */}
                  <td className="py-4 px-6 text-slate-500 whitespace-nowrap">
                    {email.sentAt
                      ? format(new Date(email.sentAt), 'MMM dd, yyyy • hh:mm:ss a')
                      : email.scheduledFor
                      ? format(new Date(email.scheduledFor), 'MMM dd, yyyy • hh:mm:ss a')
                      : '-'}
                  </td>

                  {/* Status Badge */}
                  <td className="py-4 px-6 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        statusColors[email.status] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {email.status === 'SENT' && <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />}
                      {email.status === 'RATE_LIMITED' && <AlertCircle className="w-3 h-3 mr-1 text-orange-600" />}
                      {email.status}
                    </span>
                  </td>

                  {/* Ethereal SMTP Link */}
                  {type === 'sent' && (
                    <td className="py-4 px-6 text-right">
                      {email.etherealPreviewUrl ? (
                        <a
                          href={email.etherealPreviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                        >
                          <span>View Preview</span>
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

