export interface ChatRoom {
  id: string;
  participants: string[];          // [uid1, uid2]
  relatedPostTitle: string;
  lastMessage: string;
  lastSenderUid?: string;      // 最後の発言者（未読バッジ判定）
  lastRead?: Record<string, number>; // uid → 最後に読んだ時刻(ms)
  lastMessageAt: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  text: string;
  createdAt: number;
}
