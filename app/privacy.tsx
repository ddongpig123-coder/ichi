import { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../src/contexts/ThemeContext";
import type { Theme } from "../src/theme/themes";

// プライバシーポリシー（全文・日本語正本）。docs/legal/PRIVACY.md と同期して管理すること。
const PRIVACY_TEXT = `プライバシーポリシー

最終更新日: 2026年[■]月[■]日

Lee Junhee(以下「運営者」)は、アプリケーション「ichi」(以下「本サービス」)における利用者の個人情報の取扱いについて、個人情報の保護に関する法律その他関連法令を遵守し、以下のとおりプライバシーポリシーを定めます。

1. 取得する情報

【利用者が提供する情報】
・メールアドレス（アカウント登録時。学校アカウント認証時は大学発行メールアドレス）
・ニックネーム、プロフィール画像
・所属学校・学部（ゲスト利用時は学校選択のみ）
・時間割・履修情報、学業情報（GPA・取得単位等。本人が任意入力するもの）
・投稿コンテンツ（掲示板投稿、コメント、講義レビュー、メッセージ）
・通報・お問い合わせの内容

【自動的に取得される情報】
・アカウント識別子（Firebase Authenticationが発行するUID）
・投稿・操作の日時記録
・端末情報・アクセスログ（利用基盤であるGoogle Firebaseが標準的に収集するもの。IPアドレス等を含む場合があります）

運営者は、氏名・住所・電話番号・学籍番号の提供を求めません。

2. 利用目的
1. 本サービスの提供・維持・改善（時間割管理、掲示板、友達機能等）
2. 本人確認（学校アカウント認証）および認証バッジの表示
3. 利用規約違反への対応（通報の処理、不正利用の防止、アカウント措置）
4. 法令に基づく対応（プロバイダ責任制限法上の発信者情報開示請求への対応を含む）
5. お問い合わせへの対応
6. 利用状況の統計分析（個人を識別できない形式に加工した上で実施）

3. 第三者提供
運営者は、以下の場合を除き、個人情報を第三者に提供しません。
1. 本人の同意がある場合
2. 法令に基づく場合（裁判所の命令、プロバイダ責任制限法に基づく開示請求等）
3. 人の生命・身体・財産の保護のために必要で、本人の同意を得ることが困難な場合

匿名掲示板における投稿は、他の利用者に対してニックネームまたは匿名で表示され、メールアドレス・所属等が他の利用者に公開されることはありません（本人が公開設定を選択した時間割・プロフィール情報を除く）。

4. 外国にある第三者への提供（委託）
本サービスは、データの保存・認証基盤としてGoogle LLCが提供するFirebase（サーバー所在地: 米国等）を利用しています。取得した情報はFirebaseのサーバーに保存されます。Google LLCにおける個人情報の保護措置については、同社のプライバシーポリシーをご確認ください。

5. 安全管理措置
・通信の暗号化（TLS）
・アクセス制御（Firestoreセキュリティルールによる、本人以外のデータへのアクセス制限）
・パスワードの非保持（認証基盤Firebase Authenticationが管理し、運営者は保持・閲覧しない）
・運営者アカウントの認証管理

6. 保存期間
・アカウント情報: アカウント削除まで
・投稿コンテンツ: 利用者による削除後も、法令遵守・紛争対応のため最長6ヶ月間、非公開の状態で記録を保存することがあります
・通報記録: 処理完了後1年間

7. 開示・訂正・削除の請求
利用者は、運営者に対し、個人情報保護法の定めに従い、自己の個人情報の開示・訂正・利用停止・削除を請求できます。請求は下記の連絡先までお願いします。本人確認の上、法令の定める期間内に対応します。

8. 未成年者の利用
本サービスは大学生・大学院生等を対象としています。18歳未満の方は、保護者の同意を得た上でご利用ください。

9. ポリシーの変更
本ポリシーの内容は、法令の変更またはサービスの変更に応じて改定されることがあります。重要な変更はアプリ内通知等で周知します。

10. お問い合わせ窓口
個人情報の取扱いに関するお問い合わせ、開示等の請求、投稿の削除依頼:
ddongpig123@gmail.com`;

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/onboarding"))}
      >
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.text}>{PRIVACY_TEXT}</Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    backButton: {
      position: "absolute",
      top: 16,
      left: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      zIndex: 1,
    },
    backIcon: { fontSize: 18, color: theme.textPrimary },
    content: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 40 },
    text: { fontSize: 12, lineHeight: 19, color: theme.textPrimary },
  });
}
