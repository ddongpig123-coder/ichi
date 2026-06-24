import { View, Text, StyleSheet } from "react-native";
import MicrosoftSignInButton from "../src/components/auth/MicrosoftSignInButton";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>大学生コミュニティ</Text>
      <Text style={styles.subtitle}>
        学校のMicrosoftアカウントでログインしてください
      </Text>
      <MicrosoftSignInButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    padding: 32,
    gap: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
  },
});
