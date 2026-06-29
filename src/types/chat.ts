export interface ChatRoom {
  id: string;
  participants: string[];          // [uid1, uid2]
  relatedPostTitle: string;
  lastMessage: string;
  lastMessageAt: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  text: string;
  createdAt: number;
}
