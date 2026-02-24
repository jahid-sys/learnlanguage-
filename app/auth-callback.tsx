import React, { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { setBearerToken } from "@/lib/auth";

type Status = "processing" | "success" | "error";

/**
 * Extract better_auth_token from a URL string using multiple strategies.
 * Returns { token, error } where either may be null.
 */
function extractTokenFromUrl(urlString: string): { token: string | null; error: string | null } {
  let token: string | null = null;
  let error: string | null = null;

  console.log("[AuthCallback] Extracting token from URL:", urlString);

  // Strategy 1: Standard URL parsing
  try {
    const url = new URL(urlString);
    token = url.searchParams.get("better_auth_token");
    error = url.searchParams.get("error");
    console.log("[AuthCallback] Strategy 1 - token:", token ? "found" : "not found", "error:", error);
    if (token || error) return { token, error };
  } catch (e1) {
    console.log("[AuthCallback] Strategy 1 failed:", e1);
  }

  // Strategy 2: Manual query string parsing (handles exp:// and custom schemes)
  const queryStart = urlString.indexOf("?");
  if (queryStart !== -1) {
    const queryString = urlString.substring(queryStart + 1);
    console.log("[AuthCallback] Strategy 2 - query string:", queryString);
    try {
      const params = new URLSearchParams(queryString);
      token = params.get("better_auth_token");
      error = params.get("error");
      console.log("[AuthCallback] Strategy 2 - token:", token ? "found" : "not found", "error:", error);
      if (token || error) return { token, error };
    } catch (e2) {
      console.log("[AuthCallback] Strategy 2 failed:", e2);
    }
  }

  // Strategy 3: Regex fallback (handles URL-encoded params)
  const tokenMatch = urlString.match(/[?&]better_auth_token=([^&\s]+)/);
  const errorMatch = urlString.match(/[?&]error=([^&\s]+)/);
  if (tokenMatch) {
    token = decodeURIComponent(tokenMatch[1]);
    console.log("[AuthCallback] Strategy 3 - token found via regex");
  }
  if (errorMatch) {
    error = decodeURIComponent(errorMatch[1]);
  }

  return { token, error };
}

export default function AuthCallbackScreen() {
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState("Processing authentication...");
  const router = useRouter();
  // Track whether we've already handled a token to avoid double-processing
  const handledRef = useRef(false);

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

  const processNativeToken = async (token: string) => {
    if (handledRef.current) {
      console.log("[AuthCallback] Token already handled, skipping");
      return;
    }
    handledRef.current = true;
    console.log("[AuthCallback] Native: token found! Storing and navigating...");
    await setBearerToken(token);
    setStatus("success");
    setMessage("Authentication successful!");
    // Navigate to home - AuthContext will pick up the token and fetch user
    setTimeout(() => router.replace("/(tabs)/(home)"), 800);
  };

  const processNativeError = (error: string) => {
    if (handledRef.current) return;
    handledRef.current = true;
    console.error("[AuthCallback] Native OAuth error:", error);
    setStatus("error");
    setMessage(`Authentication failed: ${error}`);
    setTimeout(() => router.replace("/auth"), 2000);
  };

  const handleNativeCallback = async () => {
    try {
      console.log("[AuthCallback] Native: processing OAuth callback");

      // Listen for URL events (warm start - app already running when deep link arrives)
      const urlSubscription = Linking.addEventListener("url", async (event) => {
        console.log("[AuthCallback] URL event received:", event.url);
        const { token, error } = extractTokenFromUrl(event.url);
        if (error) {
          processNativeError(error);
        } else if (token) {
          await processNativeToken(token);
        }
      });

      // Check the initial URL (cold start - app launched by deep link)
      const initialUrl = await Linking.getInitialURL();
      console.log("[AuthCallback] Initial URL:", initialUrl);

      if (initialUrl) {
        const { token, error } = extractTokenFromUrl(initialUrl);
        if (error) {
          urlSubscription.remove();
          processNativeError(error);
          return;
        }
        if (token) {
          urlSubscription.remove();
          await processNativeToken(token);
          return;
        }
      }

      // No token found yet - wait for URL event (warm start scenario)
      // The OAuth browser will redirect back to the app and trigger the URL event
      console.log("[AuthCallback] Native: no token in initial URL, waiting for deep link URL event...");
      setStatus("processing");
      setMessage("Completing authentication...");

      // Set a timeout - if no token arrives in 30s, navigate to home anyway
      // (AuthContext deep link listener may have already handled it)
      const timeoutId = setTimeout(() => {
        urlSubscription.remove();
        if (!handledRef.current) {
          console.log("[AuthCallback] Timeout waiting for token, navigating to home");
          handledRef.current = true;
          router.replace("/(tabs)/(home)");
        }
      }, 30000);

      // Clean up on unmount
      return () => {
        clearTimeout(timeoutId);
        urlSubscription.remove();
      };
    } catch (err) {
      console.error("[AuthCallback] Native callback error:", err);
      if (!handledRef.current) {
        handledRef.current = true;
        setStatus("error");
        setMessage("Failed to process authentication");
        setTimeout(() => router.replace("/auth"), 2000);
      }
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
