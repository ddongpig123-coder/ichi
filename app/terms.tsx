import { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../src/contexts/ThemeContext";
import type { Theme } from "../src/theme/themes";

// 利用規約（全文・日本語正本）。docs/legal/TERMS.md と同期して管理すること。
// 全項目確定(2026-08-24): 運営者=Lee Junhee / 管轄=東京地方裁判所 / 連絡先=ddongpig123@gmail.com / 最終更新日=2026年8月24日。
const TERMS_TEXT = `利用規約

最終更新日: 2026年8月24日

本利用規約(以下「本規約」)は、Lee Junhee(以下「運営者」)が提供するアプリケーション「ichi」(以下「本サービス」)の利用条件を定めるものです。利用者は、本サービスを利用することにより、本規約に同意したものとみなされます。

第1条（適用）
1. 本規約は、利用者と運営者との間の本サービスの利用に関わる一切の関係に適用されます。
2. 運営者が本サービス上で掲示する個別のルール・ガイドラインは、本規約の一部を構成します。

第2条（定義）
1. 「利用者」とは、本サービスを利用するすべての者をいいます（ゲスト利用を含む）。
2. 「投稿コンテンツ」とは、利用者が本サービスに投稿・送信した文章、画像その他の情報をいいます。
3. 「学校アカウント認証」とは、大学発行のアカウント（~.ac.jp等）による本人確認をいいます。

第3条（アカウント・ゲスト利用）
1. 本サービスは、アカウント登録なしのゲスト利用が可能です。ゲスト利用者にも本規約が適用されます。
2. 利用者は、登録情報（メールアドレス、ニックネーム等）を正確に提供するものとします。
3. アカウントの管理責任は利用者本人にあります。第三者への譲渡・貸与はできません。
4. 学校アカウント認証は任意です。認証済み利用者には認証バッジが表示されます。
5. 運営者は、コミュニティの健全性維持のため、将来的に一部機能（投稿等）の利用に認証を必須とする変更を行うことがあります。

第4条（禁止事項）
利用者は、本サービスの利用にあたり、以下の行為をしてはなりません。
1. 法令または公序良俗に違反する行為
2. 他者への誹謗中傷、名誉毀損、侮辱、脅迫、差別的表現
3. 他者の個人情報（氏名、住所、連絡先、写真等）を本人の同意なく公開する行為
4. 他者になりすます行為、虚偽の情報を流布する行為
5. 試験問題・答案等、第三者の著作権・知的財産権を侵害するコンテンツの投稿
6. 営利目的の宣伝・勧誘・スパム行為（運営者が許可した場合を除く）
7. 出会い・交際の斡旋を目的とする行為
8. 本サービスの運営を妨害する行為（不正アクセス、自動化ツールによる大量操作等）
9. 複数アカウントの不正利用、ブロック・通報機能の悪用
10. その他、運営者が不適切と判断する行為

第5条（投稿コンテンツの取扱い）
1. 投稿コンテンツの著作権は投稿した利用者に帰属します。
2. 利用者は運営者に対し、本サービスの提供・改善・広報に必要な範囲で、投稿コンテンツを無償で利用（複製、表示、翻訳を含む）する権利を許諾するものとします。
3. 利用者が投稿を削除した場合でも、運営者は法令遵守・紛争対応のため、投稿記録を一定期間（原則6ヶ月）保存することがあります。

第6条（匿名性と発信者情報）
1. 本サービスの掲示板等では、利用者間においてニックネームまたは匿名で表示されます。
2. 前項にかかわらず、運営者はシステム上、投稿と投稿者（アカウント識別子）の対応関係を保持しています。
3. プロバイダ責任制限法に基づく開示請求、裁判所の命令、その他法令に基づく要請があった場合、運営者は発信者情報を開示することがあります。

第7条（通報・ブロック・運営措置）
1. 利用者は、本規約に違反する投稿等を通報機能により運営者に通報できます。
2. 運営者は通報を受けた場合、速やかに（原則24時間以内に）内容を確認し、必要な措置（投稿の非表示・削除、警告、機能制限、アカウント停止等）を講じます。
3. 運営者は、本規約違反またはそのおそれがあると判断した場合、事前通知なく前項の措置を行うことができます。措置の理由について、運営者は開示義務を負いません。

第8条（知的財産権）
本サービスに関する知的財産権（投稿コンテンツを除く）は、運営者または正当な権利者に帰属します。

第9条（免責事項）
1. 運営者は、本サービスの内容の正確性・完全性・有用性について保証しません。講義情報・時間割・レビュー等は利用者の参考に供するものであり、履修判断等は利用者自身の責任で行うものとします。
2. 利用者間または利用者と第三者との間で生じた紛争について、運営者は責任を負いません。
3. 運営者は、本サービスの中断・停止・終了、データの消失等により利用者に生じた損害について、運営者に故意または重過失がある場合を除き、責任を負いません。

第10条（サービスの変更・中断・終了）
運営者は、利用者への事前通知なく、本サービスの内容の変更、提供の中断または終了を行うことができます。

第11条（規約の変更）
運営者は、必要と判断した場合、本規約を変更できます。変更後の規約は本サービス上に掲示した時点で効力を生じ、掲示後の利用をもって同意とみなします。重要な変更はアプリ内通知等で周知します。

第12条（準拠法・管轄）
本規約は日本法に準拠し、本サービスに関する紛争は東京地方裁判所を第一審の専属的合意管轄裁判所とします。

お問い合わせ: ddongpig123@gmail.com`;

export default function TermsScreen() {
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
        <Text style={styles.text}>{TERMS_TEXT}</Text>
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
