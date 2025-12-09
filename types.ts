
export interface User {
  id: number; // The "Number" (e.g., 39)
  name: string;
  bio: string;
  photoUrl: string | null;
  joinedAt: number;
}

export interface Message {
  id: string;
  senderId: number;
  receiverId: number;
  text: string;
  type?: 'text' | 'image' | 'dedication' | 'audio';
  attachmentUrl?: string;
  timestamp: number;
}

export interface MatchRequest {
  fromId: number;
  toId: number;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

export interface Report {
  id: string;
  reporterId: number;
  reportedId: number;
  reason: string;
  timestamp: number;
  status: 'pending' | 'resolved';
}

export type AppView = 'onboarding' | 'dashboard' | 'chat';

export type EventStatus = 'open' | 'closed';
