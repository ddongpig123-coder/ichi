// 学業情報（本人のプロフィールタブのみ表示、他人には非公開）
export interface AcademicInfo {
  department: string;      // 学部・学科 (例: 経済学部)
  grade: string;           // 学年 (例: 2)
  gpa: string;             // GPA (숨김 처리 대상)
  earnedCredits: string;   // 取得単位 (숨김 처리 대상)
  requiredCredits: string; // 卒業必要単位
  courseCount: string;     // 今学期の履修科目数
}

export interface UserProfile {
  uid: string;
  email: string;
  nickname: string;
  photoURL: string | null;
  friendIds: string[];
  createdAt: number;
  academic?: AcademicInfo;
}
