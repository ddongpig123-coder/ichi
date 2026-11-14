// app.json を土台に、ビルドの種類によって変わる所だけここで上書きする（Expo の動的設定）。
// 中身の設定は今までどおり app.json に書く。ここは「場合分け」だけ。docs/PUSH-NOTIFICATIONS.md
//
// ① 開発用ビルド（eas.json の development プロファイルが APP_VARIANT=development を渡す）
//    → 名前「大学の森 dev」・別の bundle ID / package。ストア版を消さずに同じ端末に並べて入れられる。
// ② Android のプッシュ通知に要る FCM 設定ファイル google-services.json。
//    公開リポジトリには置かない（.gitignore 済み）→ EAS の環境変数（ファイル型）で渡す:
//      本番  GOOGLE_SERVICES_JSON      … Firebase に登録した Android アプリ jp.timetable.app のもの
//      開発  GOOGLE_SERVICES_JSON_DEV  … 任意。jp.timetable.app.dev も登録したときだけ（無ければ Android の開発用ビルドは通知なし）
//    手元でビルドするときは ./google-services.json を置けば使われる（本番のみ）。
const fs = require("node:fs");

module.exports = ({ config }) => {
  const dev = process.env.APP_VARIANT === "development";
  const googleServicesFile = dev
    ? process.env.GOOGLE_SERVICES_JSON_DEV
    : process.env.GOOGLE_SERVICES_JSON || (fs.existsSync("./google-services.json") ? "./google-services.json" : undefined);

  return {
    ...config,
    name: dev ? "大学の森 dev" : config.name,
    scheme: dev ? "uni-community-dev" : config.scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: dev ? "jp.timetable.app.dev" : config.ios.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: dev ? "jp.timetable.app.dev" : config.android.package,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
