export interface UserProfile {
  uid: string;
  email: string;
  nickname: string;
  photoURL: string | null;
  friendIds: string[];
  createdAt: number;
}
