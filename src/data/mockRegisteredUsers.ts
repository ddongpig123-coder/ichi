export interface RegisteredUser {
  uid: string;
  email: string;
  nickname: string;
}

// TODO(network): 実際にはFirestoreの "users" コレクションを email で検索する。
// friendRequestService.findUserByEmail をFirestoreクエリに置き換えれば、このモックは不要になる。
export const MOCK_REGISTERED_USERS: RegisteredUser[] = [
  { uid: "u101", email: "tanaka@example.ac.jp", nickname: "たなか" },
  { uid: "u102", email: "suzuki@example.ac.jp", nickname: "すずき" },
  { uid: "u103", email: "yamada@example.ac.jp", nickname: "やまだ" },
];
