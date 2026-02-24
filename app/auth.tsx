
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import React, { useState } from "react";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleEmailAuth = async () => {
    console.log(`[Auth] Starting ${mode} with email:`, email);
    
    if (!email || !password) {
      const missingInfo = "Lūdzu, aizpildiet visus laukus.";
      setErrorMessage(missingInfo);
      setErrorModalVisible(true);
      console.log("[Auth] Validation failed:", missingInfo);
      return;
    }

    if (mode === "signup" && !name) {
      const missingName = "Lūdzu, ievadiet savu vārdu.";
      setErrorMessage(missingName);
      setErrorModalVisible(true);
      console.log("[Auth] Validation failed:", missingName);
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        console.log("[Auth] Calling signInWithEmail...");
        await signInWithEmail(email, password);
        console.log("[Auth] Sign in successful, navigating to home");
        router.replace("/(tabs)/(home)");
      } else {
        console.log("[Auth] Calling signUpWithEmail with name:", name);
        await signUpWithEmail(email, password, name);
        console.log("[Auth] Sign up successful, navigating to home");
        router.replace("/(tabs)/(home)");
      }
    } catch (error: any) {
      console.error(`[Auth] ${mode} failed:`, error);
      console.error("[Auth] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      
      let userFriendlyMessage = "Autentifikācija neizdevās. Lūdzu, mēģiniet vēlreiz.";
      
      if (error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes("invalid email or password") || msg.includes("invalid credentials") || msg.includes("403")) {
          userFriendlyMessage = "Nepareizs e-pasts vai parole.";
        } else if (msg.includes("422") || msg.includes("validation")) {
          userFriendlyMessage = "Nederīgi dati. Pārbaudiet e-pastu un paroli (min. 8 rakstzīmes).";
        } else if (msg.includes("401")) {
          userFriendlyMessage = "Nepareizs e-pasts vai parole.";
        } else if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("user already exists")) {
          userFriendlyMessage = "Šis e-pasts jau ir reģistrēts. Lūdzu, piesakieties.";
        } else if (msg.includes("password") && msg.includes("8")) {
          userFriendlyMessage = "Parolei jābūt vismaz 8 rakstzīmēm.";
        } else if (msg.includes("network") || msg.includes("fetch")) {
          userFriendlyMessage = "Tīkla kļūda. Pārbaudiet interneta savienojumu.";
        } else {
          userFriendlyMessage = error.message;
        }
      }
      
      setErrorMessage(userFriendlyMessage);
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: "google" | "apple" | "github") => {
    console.log(`[Auth] Starting ${provider} OAuth`);
    setLoading(true);
    try {
      if (provider === "google") {
        console.log("[Auth] Calling signInWithGoogle...");
        await signInWithGoogle();
      } else if (provider === "apple") {
        console.log("[Auth] Calling signInWithApple...");
        await signInWithApple();
      }
      console.log(`[Auth] ${provider} sign in successful, navigating to home`);
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      console.error(`[Auth] ${provider} sign in failed:`, error);
      console.error("[Auth] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      
      let userFriendlyMessage = `${provider} autentifikācija neizdevās.`;
      if (error.message) {
        userFriendlyMessage = `${provider} kļūda: ${error.message}`;
      }
      
      setErrorMessage(userFriendlyMessage);
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const modeText = mode === "signin" ? "Pieslēgties" : "Reģistrēties";
  const switchModeText = mode === "signin" ? "Nav konta? Reģistrēties" : "Jau ir konts? Pieslēgties";
  const switchMode = mode === "signin" ? "signup" : "signin";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <Text style={styles.title}>Sveiki!</Text>
          <Text style={styles.subtitle}>
            {mode === "signin" ? "Pieslēdzieties savam kontam" : "Izveidojiet jaunu kontu"}
          </Text>

          {mode === "signup" && (
            <TextInput
              style={styles.input}
              placeholder="Vārds"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="E-pasts"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <TextInput
            style={styles.input}
            placeholder="Parole"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleEmailAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{modeText}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setMode(switchMode)}
            disabled={loading}
          >
            <Text style={styles.switchButtonText}>{switchModeText}</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>vai</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.socialButton, styles.googleButton]}
            onPress={() => handleSocialAuth("google")}
            disabled={loading}
          >
            <Text style={styles.socialButtonText}>Turpināt ar Google</Text>
          </TouchableOpacity>

          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={() => handleSocialAuth("apple")}
              disabled={loading}
            >
              <Text style={styles.socialButtonText}>Turpināt ar Apple</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setErrorModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Kļūda</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Labi</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#999",
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  switchButton: {
    marginTop: 16,
    alignItems: "center",
  },
  switchButtonText: {
    color: "#007AFF",
    fontSize: 14,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#333",
  },
  dividerText: {
    color: "#999",
    paddingHorizontal: 16,
    fontSize: 14,
  },
  socialButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: "#1a1a1a",
    borderColor: "#333",
  },
  appleButton: {
    backgroundColor: "#1a1a1a",
    borderColor: "#333",
  },
  socialButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: "#ccc",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
