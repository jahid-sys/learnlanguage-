import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig?.extra?.backendUrl || "";

export const BEARER_TOKEN_KEY = "lingualearn_bearer_token";

// Platform-specific storage: localStorage for web, SecureStore for native
const storage = Platform.OS === "web"
  ? {
      getItem: (key: string) => {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
        } catch {}
      },
      deleteItem: (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch {}
      },
    }
  : {
      getItem: async (key: string) => {
        try {
          return await SecureStore.getItemAsync(key);
        } catch {
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          await SecureStore.setItemAsync(key, value);
        } catch {}
      },
      deleteItem: async (key: string) => {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {}
      },
    };

// Build auth client options
const authClientOptions: any = {
  baseURL: API_URL,
};

// On native, use expoClient plugin for proper token handling
// The scheme must match the one in app.json (expo.scheme)
// Note: In Expo Go, deep links use exp:// scheme automatically
// For standalone builds, the scheme from app.json is used
if (Platform.OS !== "web") {
  // Get the scheme from Constants - normalize it to be URL-safe (no spaces)
  // In Expo Go, the actual deep link scheme is "exp://" regardless of app scheme
  // For standalone builds, we use the normalized scheme
  const rawScheme = Constants.expoConfig?.scheme;
  // Normalize: lowercase, replace spaces with hyphens, remove invalid chars
  const appScheme = typeof rawScheme === "string"
    ? rawScheme.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-._]/g, "")
    : "learn-latvian-language";
  console.log("[Auth] Raw scheme:", rawScheme, "-> Normalized scheme:", appScheme);
  
  authClientOptions.plugins = [
    expoClient({
      scheme: appScheme,
      storagePrefix: "lingualearn",
      storage: storage as any,
    }),
  ];
}

// On web, use credentials: include for cookie-based auth + bearer token fallback
if (Platform.OS === "web") {
  authClientOptions.fetchOptions = {
    credentials: "include" as RequestCredentials,
  };
}

export const authClient = createAuthClient(authClientOptions);

export async function setBearerToken(token: string) {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(BEARER_TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
    }
  } catch (error) {
    console.error("[Auth] Failed to set bearer token:", error);
  }
}

export async function clearAuthTokens() {
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(BEARER_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
    }
  } catch (error) {
    console.error("[Auth] Failed to clear auth tokens:", error);
  }
}

export { API_URL };
