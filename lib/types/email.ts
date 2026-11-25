// Message Gmail (type d'API, distinct de Email local)
export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to?: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  unread: boolean;
  messageId?: string;
}

/** Fil Gmail complet : tous ses messages, du plus recent au plus ancien. */
export interface GmailThread {
  id: string;
  messages: GmailMessage[];
}

export interface Email {
  id: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  unread: boolean;
  triage?: {
    priority: "urgent" | "normal" | "low";
    needsReply: boolean;
    summary?: string;
  };
}

export interface EmailsData {
  emails: Email[];
}
