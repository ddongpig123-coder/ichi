// 運営者の連絡先（利用規約・プライバシーポリシーと同一）。App Store 指針 1.2 により
// 「アプリ内で連絡先を提示し、不適切な活動を報告できること」が必須。
export const OPERATOR_CONTACT_EMAIL = "ddongpig123@gmail.com";

// 便覧（履修要項）の提供メール。卒業要件が「準備中」の学校のユーザーに送ってもらう（2026-11-26 準熙）。
// 便覧は学内向け資料なので、受け取った PDF はリポジトリに入れない（COLLAB-DATA-TAEHUI §10-2）。
export function binranMailUrl(subject: string, body: string): string {
  return `mailto:${OPERATOR_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
