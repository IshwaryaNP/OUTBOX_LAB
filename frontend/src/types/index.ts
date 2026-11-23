export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  slackConnected?: boolean;
}

export interface EmailRecord {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledFor: string;
  sentAt?: string | null;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';
  etherealPreviewUrl?: string;
  errorMessage?: string;
  sender?: {
    name: string;
    email: string;
  };
}

