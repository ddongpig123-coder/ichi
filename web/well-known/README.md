# web/well-known — `https://ichi-6b8f7.web.app/.well-known/` に置くファイル

`npm run deploy:web`（scripts/deploy-web.mjs）が `dist/.well-known/` へコピーする。
友達招待リンク（`https://ichi-6b8f7.web.app/add-friend?u=…&k=…`）を LINE などで押したとき、
ブラウザを通らずに直接アプリが開くようにするための「このドメインはこのアプリのもの」証明（docs/INVITE-LINK.md §5）。

| ファイル | 対象 | 中身 |
|---|---|---|
| `apple-app-site-association` | iOS ユニバーサルリンク | `<TeamID>.<bundleID>` と `/add-friend` パス。拡張子なし・`Content-Type: application/json`（firebase.json） |
| `assetlinks.json` | Android アプリリンク | パッケージ名と**署名証明書の SHA-256**。Play Console → 設定 → アプリの完全性 → アプリ署名 の「アプリ署名鍵の証明書」と「アップロード鍵の証明書」 |

- `assetlinks.json` に `REPLACE_WITH_` が残っている間は、デプロイスクリプトはこのファイルを**載せない**（誤った指紋を公開しない）
- アプリ側の設定は `app.json` の `ios.associatedDomains` と `android.intentFilters`。開発用ビルド（大学の森 dev）では外している（`app.config.js`）
- Apple は AASA を自社 CDN にキャッシュするので、変更が反映されるまで最大 1 日ほどかかることがある
