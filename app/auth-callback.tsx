import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { setBearerToken } from "@/lib/auth";

type Status = "processing" | "success" | "error";

export default function AuthCallbackScreen() {
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState("Processing authentication...");
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") {
      handleWebCallback();
    } else {
      handleNativeCallback();
    }
  }, []);

  const handleWebCallback = () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("better_auth_token");
      const error = urlParams.get("error");

      if (error) {
        setStatus("error");
        setMessage(`Authentication failed: ${error}`);
        window.opener?.postMessage({ type: "oauth-error", error }, "*");
        return;
      }

      if (token) {
        setStatus("success");
        setMessage("Authentication successful! Closing...");
        window.opener?.postMessage({ type: "oauth-success", token }, "*");
        setTimeout(() => window.close(), 1000);
      } else {
        setStatus("error");
        setMessage("No authentication token received");
        window.opener?.postMessage({ type: "oauth-error", error: "No token" }, "*");
      }
    } catch (err) {
      setStatus("error");
      setMessage("Failed to process authentication");
      console.error("Auth callback error:", err);
    }
  };

  const handleNativeCallback = async () => {
    try {
      console.log("[AuthCallback] Native: processing OAuth callback");

      // Get the initial URL that launched the app (for cold start)
      const initialUrl = await Linking.getInitialURL();
      console.log("[AuthCallback] Initial URL:", initialUrl);

      let token: string | null = null;
      let error: string | null = null;

      if (initialUrl) {
        try {
          const url = new URL(initialUrl);
          token = url.searchParams.get("better_auth_token");
          error = url.searchParams.get("error");
        } catch {
          const queryStart = initialUrl.indexOf("?");
          if (queryStart !== -1) {
            const params = new URLSearchParams(initialUrl.substring(queryStart + 1));
            token = params.get("better_auth_token");
            error = params.get("error");
          }
        }
      }

      if (error) {
        console.error("[AuthCallback] Native OAuth error:", error);
        setStatus("error");
        setMessage(`Authentication failed: ${error}`);
        setTimeout(() => router.replace("/auth"), 2000);
        return;
      }

      if (token) {
        console.log("[AuthCallback] Native: token found, storing...");
        await setBearerToken(token);
        setStatus("success");
        setMessage("Authentication successful!");
        // Navigate to home - AuthContext will pick up the token
        setTimeout(() => router.replace("/(tabs)/(home)"), 500);
      } else {
        // No token in initial URL - the deep link listener in AuthContext will handle it
        // Just navigate back to home and let the session be fetched
        console.log("[AuthCallback] Native: no token in initial URL, navigating to home");
        setStatus("success");
        setMessage("Completing authentication...");
        setTimeout(() => router.replace("/(tabs)/(home)"), 500);
      }
    } catch (err) {
      console.error("[AuthCallback] Native callback error:", err);
      setStatus("error");
      setMessage("Failed to process authentication");
      setTimeout(() => router.replace("/auth"), 2000);
    }
  };

  return (
    <View style={styles.container}>
      {status === "processing" && <ActivityIndicator size="large" color="#007AFF" />}
      {status === "success" && <Text style={styles.successIcon}>✓</Text>}
      {status === "error" && <Text style={styles.errorIcon}>✗</Text>}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  successIcon: {
    fontSize: 48,
    color: "#34C759",
  },
  errorIcon: {
    fontSize: 48,
    color: "#FF3B30",
  },
  message: {
    fontSize: 18,
    marginTop: 20,
    textAlign: "center",
    color: "#333",
  },
});
