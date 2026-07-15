// ============================================================
// アプリ内文言の辞書（ja = 正本 / ko = 한국어）
// - キーは "画面.用途" のフラット形式。型で存在チェックされる。
// - 外部i18nライブラリは使わない（依存ゼロ・型安全・2言語なら十分）。
// - 新しい文言は必ず両言語同時に追加すること（型エラーで強制される）。
// ============================================================

const ja = {
  // 共通
  "common.cancel": "キャンセル",
  "common.ok": "OK",
  "common.save": "保存",
  "common.edit": "編集",
  "common.delete": "削除",
  "common.send": "送信",
  "common.back": "戻る",
  "common.next": "次へ",
  "common.done": "完了",
  "common.guest": "ゲスト",
  "common.notSet": "未設定",
  "common.error": "エラーが発生しました",

  // タブ
  "tabs.home": "ホーム",
  "tabs.boards": "掲示板",
  "tabs.friends": "友達",
  "tabs.messages": "メッセージ",
  "tabs.profile": "プロフィール",

  // オンボーディング
  "onboarding.welcome": "ichiへようこそ",
  "onboarding.subtitle": "日本の大学生活を、もっとつながりやすく",
  "onboarding.termsTitle": "利用規約への同意",
  "onboarding.termsSummary":
    "ichiを利用するには、利用規約とプライバシーポリシーへの同意が必要です。\n\n・掲示板はニックネーム・匿名で利用できますが、運営者は法令に基づき投稿者を特定できる情報を保持します\n・誹謗中傷・個人情報の無断公開などの禁止行為には、投稿削除・利用停止などの措置を行います\n・詳細は全文をご確認ください",
  "onboarding.readTerms": "利用規約の全文を読む",
  "onboarding.readPrivacy": "プライバシーポリシーの全文を読む",
  "onboarding.agree": "同意して始める",
  "onboarding.languageTitle": "言語を選択",
  "onboarding.languageSubtitle": "アプリの表示言語を選んでください（後で変更できます）",
  "onboarding.schoolTitle": "学校を選択",
  "onboarding.schoolSubtitle": "所属している学校を選んでください",
  "onboarding.schoolOther": "その他・まだ決まっていない",
  "onboarding.start": "ichiを始める",

  // アカウント
  "account.title": "アカウント",
  "account.registerTitle": "アカウント登録",
  "account.registerDescription":
    "登録すると、機種変更やアプリ再インストール後もデータを引き継げます。いま使っている時間割・友達はそのまま残ります。",
  "account.nickname": "ニックネーム",
  "account.nicknamePlaceholder": "例: たろう",
  "account.email": "メールアドレス",
  "account.password": "パスワード（6文字以上）",
  "account.passwordConfirm": "パスワード（確認）",
  "account.register": "登録する",
  "account.registering": "登録中…",
  "account.login": "ログイン",
  "account.loggingIn": "ログイン中…",
  "account.logout": "ログアウト",
  "account.logoutConfirm": "ログアウトしますか？",
  "account.or": "または",
  "account.microsoftRegister": "Microsoftで登録（大学アカウント・認証バッジ付与）",
  "account.microsoftLogin": "Microsoftでログイン",
  "account.toLogin": "既にアカウントをお持ちの方はこちら（ログイン）",
  "account.toRegister": "新規登録はこちら",
  "account.loginWarning":
    "※ ログインすると、ゲストとして作成した現在のデータ（時間割など）にはアクセスできなくなります。",
  "account.guestBadge": "ゲスト利用中",
  "account.registeredBadge": "登録済み ✓",
  "account.goRegister": "アカウント登録 →",
  "account.goManage": "アカウント管理 →",
  "account.verifiedBadge": "学校認証済み",

  // 友達
  "friends.title": "友達",
  "friends.add": "+ 追加",
  "friends.addTitle": "友達追加",
  "friends.emailPlaceholder": "メールアドレスを入力",
  "friends.userNotFound": "存在しないユーザーです",
  "friends.requestsTitle": "フレンド申請",
  "friends.accept": "承認",
  "friends.reject": "拒否",
  "friends.message": "メッセージ",
  "friends.empty": "まだ友達がいません",
  "friends.emptyHint": "右上の「+ 追加」からメールアドレスで友達を追加できます",
  "friends.timetablePrivate": "さんの時間割は非公開です",
  "friends.removeTitle": "友達を削除",
  "friends.removeConfirm": "さんを友達から削除しますか？",

  // ホーム・時間割
  "home.friendsSection": "友達",
  "home.overlapPopupTitle": "一緒に受けている友達",
  "timetable.addTitle": "講義を追加",
  "timetable.name": "講義名",
  "timetable.teacher": "担当教授",
  "timetable.room": "教室",
  "timetable.color": "カラー",
  "timetable.springSemester": "春学期",
  "timetable.fallSemester": "秋学期",

  // プロフィール
  "profile.title": "プロフィール",
  "profile.academicInfo": "🔒 学業情報",
  "profile.departmentGrade": "学部・学科 / 学年",
  "profile.language": "言語 / 言語設定",
} as const;

const ko: Record<TranslationKey, string> = {
  "common.cancel": "취소",
  "common.ok": "확인",
  "common.save": "저장",
  "common.edit": "편집",
  "common.delete": "삭제",
  "common.send": "보내기",
  "common.back": "뒤로",
  "common.next": "다음",
  "common.done": "완료",
  "common.guest": "게스트",
  "common.notSet": "미설정",
  "common.error": "오류가 발생했습니다",

  "tabs.home": "홈",
  "tabs.boards": "게시판",
  "tabs.friends": "친구",
  "tabs.messages": "쪽지",
  "tabs.profile": "프로필",

  "onboarding.welcome": "ichi에 오신 것을 환영합니다",
  "onboarding.subtitle": "일본 대학 생활을, 더 가깝게",
  "onboarding.termsTitle": "이용약관 동의",
  "onboarding.termsSummary":
    "ichi를 이용하려면 이용약관과 개인정보처리방침에 대한 동의가 필요합니다.\n\n・게시판은 닉네임·익명으로 이용할 수 있지만, 운영자는 법령에 따라 투고자를 특정할 수 있는 정보를 보유합니다\n・비방·개인정보 무단 공개 등 금지행위에는 투고 삭제·이용 정지 등의 조치가 취해집니다\n・자세한 내용은 전문을 확인해 주세요",
  "onboarding.readTerms": "이용약관 전문 보기",
  "onboarding.readPrivacy": "개인정보처리방침 전문 보기",
  "onboarding.agree": "동의하고 시작하기",
  "onboarding.languageTitle": "언어 선택",
  "onboarding.languageSubtitle": "앱 표시 언어를 선택하세요 (나중에 변경 가능)",
  "onboarding.schoolTitle": "학교 선택",
  "onboarding.schoolSubtitle": "소속 학교를 선택해 주세요",
  "onboarding.schoolOther": "기타·아직 미정",
  "onboarding.start": "ichi 시작하기",

  "account.title": "계정",
  "account.registerTitle": "계정 등록",
  "account.registerDescription":
    "등록하면 기기 변경이나 앱 재설치 후에도 데이터를 이어받을 수 있습니다. 지금 사용 중인 시간표·친구는 그대로 유지됩니다.",
  "account.nickname": "닉네임",
  "account.nicknamePlaceholder": "예: 하나",
  "account.email": "이메일 주소",
  "account.password": "비밀번호 (6자 이상)",
  "account.passwordConfirm": "비밀번호 (확인)",
  "account.register": "등록하기",
  "account.registering": "등록 중…",
  "account.login": "로그인",
  "account.loggingIn": "로그인 중…",
  "account.logout": "로그아웃",
  "account.logoutConfirm": "로그아웃하시겠습니까?",
  "account.or": "또는",
  "account.microsoftRegister": "Microsoft로 등록 (대학 계정·인증 배지 부여)",
  "account.microsoftLogin": "Microsoft로 로그인",
  "account.toLogin": "이미 계정이 있으신가요? (로그인)",
  "account.toRegister": "신규 등록은 여기",
  "account.loginWarning":
    "※ 로그인하면 게스트로 만든 현재 데이터(시간표 등)에는 접근할 수 없게 됩니다.",
  "account.guestBadge": "게스트 이용 중",
  "account.registeredBadge": "등록됨 ✓",
  "account.goRegister": "계정 등록 →",
  "account.goManage": "계정 관리 →",
  "account.verifiedBadge": "학교 인증됨",

  "friends.title": "친구",
  "friends.add": "+ 추가",
  "friends.addTitle": "친구 추가",
  "friends.emailPlaceholder": "이메일 주소 입력",
  "friends.userNotFound": "존재하지 않는 사용자입니다",
  "friends.requestsTitle": "친구 신청",
  "friends.accept": "승인",
  "friends.reject": "거부",
  "friends.message": "쪽지",
  "friends.empty": "아직 친구가 없습니다",
  "friends.emptyHint": "오른쪽 위 「+ 추가」에서 이메일로 친구를 추가할 수 있어요",
  "friends.timetablePrivate": "님의 시간표는 비공개입니다",
  "friends.removeTitle": "친구 삭제",
  "friends.removeConfirm": "님을 친구에서 삭제하시겠습니까?",

  "home.friendsSection": "친구",
  "home.overlapPopupTitle": "같이 듣는 친구",
  "timetable.addTitle": "강의 추가",
  "timetable.name": "강의명",
  "timetable.teacher": "담당 교수",
  "timetable.room": "강의실",
  "timetable.color": "색상",
  "timetable.springSemester": "봄학기",
  "timetable.fallSemester": "가을학기",

  "profile.title": "프로필",
  "profile.academicInfo": "🔒 학업 정보",
  "profile.departmentGrade": "학부·학과 / 학년",
  "profile.language": "언어 / 言語設定",
};

export type TranslationKey = keyof typeof ja;

export const TRANSLATIONS = { ja, ko } as const;
