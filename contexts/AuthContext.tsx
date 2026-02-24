
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { authClient, setBearerToken, clearAuthTokens, BEARER_TOKEN_KEY, API_URL } from "@/lib/auth";
import * as SecureStore from "expo-secure-store";

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function openOAuthPopup(provider: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popupUrl = `${window.location.origin}/auth-popup?provider=${provider}`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open popup. Please allow popups."));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "oauth-success" && event.data?.token) {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        resolve(event.data.token);
      } else if (event.data?.type === "oauth-error") {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        reject(new Error(event.data.error || "OAuth failed"));
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        reject(new Error("Authentication cancelled"));
      }
    }, 500);
  });
}

/**
 * Direct API call to Better Auth endpoints, bypassing the client library
 * This is used as a fallback when the client library has issues
 */
async function directAuthCall(endpoint: string, body: Record<string, any>): Promise<any> {
  const url = `${API_URL}${endpoint}`;
  console.log("[AuthContext] Direct auth call to:", url);
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  
  const text = await response.text();
  console.log("[AuthContext] Direct auth response status:", response.status, "body:", text);
  
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  
  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }
  
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Ref to hold the OAuth resolve/reject callbacks so the deep link handler can resolve the pending OAuth promise
  const oauthResolveRef = useRef<((token: string) => void) | null>(null);
  const oauthRejectRef = useRef<((err: Error) => void) | null>(null);

  useEffect(() => {
    console.log("[AuthContext] Initializing, fetching user session...");
    fetchUser();

    // Listen for deep links (e.g. from social auth redirects on native)
    const subscription = Linking.addEventListener("url", async (event) => {
      console.log("[AuthContext] Deep link received:", event.url);

      // Check if this is an OAuth callback with a token
      try {
        // Handle both standard URL format and custom scheme URLs
        let token: string | null = null;
        let error: string | null = null;

        try {
          const url = new URL(event.url);
          token = url.searchParams.get("better_auth_token");
          error = url.searchParams.get("error");
        } catch {
          // For custom scheme URLs like "myapp://auth-callback?better_auth_token=xxx"
          // Try to parse query string manually
          const queryStart = event.url.indexOf("?");
          if (queryStart !== -1) {
            const queryString = event.url.substring(queryStart + 1);
            const params = new URLSearchParams(queryString);
            token = params.get("better_auth_token");
            error = params.get("error");
          }
        }

        if (error) {
          console.error("[AuthContext] OAuth error in deep link:", error);
          if (oauthRejectRef.current) {
            oauthRejectRef.current(new Error(error));
            oauthResolveRef.current = null;
            oauthRejectRef.current = null;
          }
          return;
        }

        if (token) {
          console.log("[AuthContext] Token found in OAuth callback deep link, storing...");
          await setBearerToken(token);

          // Resolve the pending OAuth promise if one exists
          if (oauthResolveRef.current) {
            oauthResolveRef.current(token);
            oauthResolveRef.current = null;
            oauthRejectRef.current = null;
          }

          // Wait a moment for the token to be stored
          await new Promise(resolve => setTimeout(resolve, 300));
          console.log("[AuthContext] Refreshing user session after OAuth token received");
          await fetchUser();
          return;
        }
      } catch (err) {
        console.log("[AuthContext] Deep link parsing error:", err);
      }

      // No token in URL, just refresh session (Better Auth Expo client may have handled it)
      console.log("[AuthContext] Refreshing user session after deep link (no token in URL)");
      await fetchUser();
    });

    // POLLING: Refresh session every 5 minutes to keep SecureStore token in sync
    const intervalId = setInterval(() => {
      console.log("[AuthContext] Auto-refreshing user session (5min interval)...");
      fetchUser();
    }, 5 * 60 * 1000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, []);

  const fetchUser = async () => {
    try {
      console.log("[AuthContext] Fetching user session from Better Auth...");
      setLoading(true);

      // Get stored bearer token first
      let storedToken: string | null = null;
      if (Platform.OS === "web") {
        try {
          storedToken = localStorage.getItem(BEARER_TOKEN_KEY);
        } catch {}
      } else {
        try {
          storedToken = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
        } catch {}
      }

      // On native, prefer the /api/auth/session/from-token endpoint with Bearer token
      // This is the new endpoint that properly handles native OAuth sessions
      if (storedToken && Platform.OS !== "web") {
        console.log("[AuthContext] Native: trying /api/auth/session/from-token with stored bearer token...");
        try {
          const sessionResponse = await fetch(`${API_URL}/api/auth/session/from-token`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${storedToken}`,
              "Content-Type": "application/json",
            },
          });

          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            console.log("[AuthContext] Session from /session/from-token:", JSON.stringify(sessionData));
            if (sessionData?.user) {
              setUser(sessionData.user as User);
              // Keep the token stored since it's valid
              return;
            }
          } else {
            console.log("[AuthContext] /session/from-token failed:", sessionResponse.status);
            if (sessionResponse.status === 401) {
              // Token is invalid/expired, clear it
              await clearAuthTokens();
              storedToken = null;
            }
          }
        } catch (err) {
          console.error("[AuthContext] /session/from-token error:", err);
        }
      }

      // Try to get session via the auth client (works for web cookie-based sessions and native)
      try {
        const session = await authClient.getSession();
        console.log("[AuthContext] Session response:", JSON.stringify(session));

        if (session?.data?.user) {
          console.log("[AuthContext] User found via client:", session.data.user);
          setUser(session.data.user as User);

          // Sync token to storage for utils/api.ts
          if (session.data.session?.token) {
            console.log("[AuthContext] Syncing bearer token to storage");
            await setBearerToken(session.data.session.token);
          } else {
            console.warn("[AuthContext] Session exists but no token found in session data");
          }
          return;
        }
      } catch (clientErr) {
        console.error("[AuthContext] authClient.getSession error:", clientErr);
      }

      // Fallback: try /api/auth/get-session with stored bearer token (legacy endpoint)
      if (storedToken) {
        console.log("[AuthContext] Trying fallback /api/auth/get-session with stored bearer token...");
        try {
          const sessionResponse = await fetch(`${API_URL}/api/auth/get-session`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${storedToken}`,
              "Content-Type": "application/json",
            },
          });

          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            console.log("[AuthContext] Session from /get-session:", JSON.stringify(sessionData));
            if (sessionData?.user) {
              setUser(sessionData.user as User);
              return;
            }
          } else {
            console.log("[AuthContext] /get-session failed:", sessionResponse.status);
            // Token is invalid, clear it
            await clearAuthTokens();
          }
        } catch (err) {
          console.error("[AuthContext] /get-session error:", err);
        }
      }

      console.log("[AuthContext] No user session found");
      setUser(null);
    } catch (error) {
      console.error("[AuthContext] Failed to fetch user:", error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log("[AuthContext] Fetch user complete");
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("[AuthContext] Signing in with email:", email);
      
      // Use direct API call for reliability
      const data = await directAuthCall("/api/auth/sign-in/email", { email, password });
      console.log("[AuthContext] Sign in response data:", JSON.stringify(data));
      
      // Extract token from response
      const token = data?.token || data?.session?.token;
      if (token) {
        console.log("[AuthContext] Got token from sign-in response, storing...");
        await setBearerToken(token);
      }
      
      // Extract user from response
      if (data?.user) {
        console.log("[AuthContext] Setting user from sign-in response:", data.user);
        setUser(data.user as User);
      } else {
        // Fetch session to get user
        await fetchUser();
      }
    } catch (error) {
      console.error("[AuthContext] Email sign in failed:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("[AuthContext] Signing up with email:", email, "name:", name);
      
      // Use direct API call for reliability - name is required by the backend
      const data = await directAuthCall("/api/auth/sign-up/email", {
        email,
        password,
        name: name || email.split("@")[0], // Fallback to email prefix if no name
      });
      console.log("[AuthContext] Sign up response data:", JSON.stringify(data));
      
      // Extract token from response
      const token = data?.token || data?.session?.token;
      if (token) {
        console.log("[AuthContext] Got token from sign-up response, storing...");
        await setBearerToken(token);
      }
      
      // Extract user from response
      if (data?.user) {
        console.log("[AuthContext] Setting user from sign-up response:", data.user);
        setUser(data.user as User);
      } else {
        // Fetch session to get user
        await fetchUser();
      }
    } catch (error) {
      console.error("[AuthContext] Email sign up failed:", error);
      throw error;
    }
  };

  const signInWithSocial = async (provider: "google" | "apple" | "github") => {
    try {
      console.log(`[AuthContext] Starting ${provider} OAuth flow`);
      if (Platform.OS === "web") {
        console.log("[AuthContext] Web platform: opening OAuth popup");
        const token = await openOAuthPopup(provider);
        console.log("[AuthContext] OAuth popup returned token");
        await setBearerToken(token);
        await fetchUser();
      } else {
        console.log("[AuthContext] Native platform: using deep link flow");

        // Create a promise that will be resolved when the deep link callback arrives with a token
        const tokenPromise = new Promise<string | null>((resolve, reject) => {
          // Store resolve/reject so the deep link listener can call them
          oauthResolveRef.current = resolve;
          oauthRejectRef.current = reject;

          // Timeout after 120 seconds if no callback received
          setTimeout(() => {
            if (oauthResolveRef.current === resolve) {
              console.log("[AuthContext] OAuth callback timeout - will try fetching session anyway");
              oauthResolveRef.current = null;
              oauthRejectRef.current = null;
              resolve(null); // Resolve with null to trigger session fetch fallback
            }
          }, 120000);
        });

        // Use the app scheme from app.json for the callback URL
        // The scheme must match what's configured in app.json
        const callbackURL = Linking.createURL("/auth-callback");
        console.log("[AuthContext] Callback URL:", callbackURL);

        // Initiate the OAuth flow - this opens the browser
        await authClient.signIn.social({
          provider,
          callbackURL,
        });
        console.log("[AuthContext] OAuth browser opened, waiting for callback...");

        // Wait for the deep link callback to arrive with the token
        const token = await tokenPromise;

        if (token) {
          console.log("[AuthContext] OAuth token received via deep link, fetching user...");
          // Token already stored by the deep link handler, just fetch user
          await fetchUser();
        } else {
          // No token from deep link - try fetching session anyway
          // (Better Auth Expo client may have handled it internally)
          console.log("[AuthContext] No token from deep link, attempting session fetch...");
          await fetchUser();
          console.log("[AuthContext] Session fetch complete after OAuth");
        }
      }
    } catch (error) {
      // Clean up the pending OAuth promise refs on error
      oauthResolveRef.current = null;
      oauthRejectRef.current = null;
      console.error(`[AuthContext] ${provider} sign in failed:`, error);
      throw error;
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");
  const signInWithApple = () => signInWithSocial("apple");
  const signInWithGitHub = () => signInWithSocial("github");

  const signOut = async () => {
    try {
      console.log("[AuthContext] Signing out...");
      
      // Try to sign out via direct API call with bearer token
      let storedToken: string | null = null;
      if (Platform.OS === "web") {
        try { storedToken = localStorage.getItem(BEARER_TOKEN_KEY); } catch {}
      } else {
        try { storedToken = await SecureStore.getItemAsync(BEARER_TOKEN_KEY); } catch {}
      }
      
      if (storedToken) {
        try {
          await fetch(`${API_URL}/api/auth/sign-out`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${storedToken}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          });
        } catch (err) {
          console.error("[AuthContext] Sign out API call failed:", err);
        }
      } else {
        try {
          await authClient.signOut();
        } catch (err) {
          console.error("[AuthContext] authClient.signOut failed:", err);
        }
      }
      
      console.log("[AuthContext] Sign out successful");
    } catch (error) {
      console.error("[AuthContext] Sign out failed (API):", error);
    } finally {
      // Always clear local state immediately
      console.log("[AuthContext] Clearing local auth state");
      setUser(null);
      await clearAuthTokens();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        signInWithGitHub,
        signOut,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
