// 投稿まわりの文字数上限（画面の maxLength と文字数カウンターで使う）。
// firestore.rules でも同じ値で検証する（変えるときは両方そろえること）。
export const POST_TITLE_MAX = 100;
export const POST_BODY_MAX = 3000;
export const COMMENT_MAX = 1000;
export const REVIEW_COMMENT_MAX = 500;
export const NICKNAME_MAX = 20;
export const BOARD_NAME_MAX = 30;
