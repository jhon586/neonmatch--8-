
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
  type?: 'text' | 'image' | 'dedication';
  attachmentUrl?: string;
  timestamp: number;
}

export interface MatchRequest {
  fromId: number;
  toId: number;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

export type AppView = 'onboarding' | 'dashboard' | 'chat';

export type EventStatus = 'open' | 'closed';
