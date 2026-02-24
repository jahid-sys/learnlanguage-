import { createApplication, createAuthMiddleware } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerConversationRoutes } from './routes/conversations.js';
import { registerVocabularyRoutes } from './routes/vocabulary.js';
import { registerNativeAuthRoutes } from './routes/native-auth.js';

const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Custom middleware to handle native mobile OAuth callbacks
// This intercepts OAuth callbacks and returns session token in redirect URL for native clients
const nativeOAuthHook = createAuthMiddleware(async (ctx) => {
  // Check if this is an OAuth callback request or sign-in request
  const isOAuthFlow = ctx.path.includes('callback') || ctx.path.includes('sign-in/social');
  if (!isOAuthFlow) {
    return;
  }

  // Check for native client indicators in query parameters
  const query = ctx.query as Record<string, unknown>;
  const redirectTo = query?.redirect_to as string;
  const expoClient = query?.expo_client === 'true' || query?.expo_client === true;

  // Detect if it's a native app by checking redirect_to or expo_client flag
  const isNativeClient = expoClient || (redirectTo && (
    redirectTo.startsWith('exp://') ||      // Expo
    redirectTo.startsWith('myapp://') ||    // Custom native scheme
    redirectTo.startsWith('rnapp://') ||    // React Native
    redirectTo.startsWith('rnexpo://')      // React Native Expo
  ));

  // Store native client indicator and redirect info in context for response handler
  if (isNativeClient) {
    ctx.context = {
      ...ctx.context,
      isNativeClient: true,
      nativeRedirectTo: redirectTo || 'exp://auth-callback',
    };
    app.logger.info(
      { redirectTo, expoClient, nativeRedirectTo: redirectTo || 'exp://auth-callback' },
      'Detected native mobile client in OAuth flow'
    );
  }
});

// Hook to modify OAuth callback response for native clients
const nativeOAuthResponseHook = createAuthMiddleware(async (ctx) => {
  // Only modify successful OAuth responses for native clients
  const isNativeClient = (ctx.context as Record<string, unknown>)?.isNativeClient;
  const nativeRedirectTo = (ctx.context as Record<string, unknown>)?.nativeRedirectTo as string;

  if (!isNativeClient || !nativeRedirectTo) {
    return;
  }

  // Try to get session data from context
  const newSession = ctx.context?.newSession;
  let sessionToken: string | null = null;

  if (newSession) {
    const sessionData = newSession as Record<string, unknown>;
    // Handle different session response structures
    if (typeof sessionData.session === 'object' && sessionData.session !== null) {
      sessionToken = (sessionData.session as Record<string, unknown>)?.token as string;
    } else if (typeof sessionData.token === 'string') {
      sessionToken = sessionData.token;
    }
  }

  if (!sessionToken) {
    app.logger.warn({ nativeRedirectTo }, 'No session token available for native redirect');
    return;
  }

  // Append session token to the native app redirect URL
  const callbackUrl = new URL(nativeRedirectTo);
  callbackUrl.searchParams.set('better_auth_token', sessionToken);

  const finalRedirectUrl = callbackUrl.toString();
  app.logger.info(
    {
      tokenLength: sessionToken.length,
      redirectUrl: finalRedirectUrl,
      originalRedirect: nativeRedirectTo
    },
    'Redirecting native client with session token'
  );

  // Return redirect response with the modified URL
  return {
    context: {
      ...ctx.context,
      response: {
        statusCode: 302,
        headers: {
          Location: finalRedirectUrl,
        },
      },
    },
  };
});

// Enable authentication with email/password and OAuth providers (Google and Apple via proxy)
app.withAuth({
  hooks: {
    before: nativeOAuthHook,
    after: nativeOAuthResponseHook,
  },
});

// Enable storage for audio files
app.withStorage();

// Register routes
registerConversationRoutes(app);
registerVocabularyRoutes(app);
registerNativeAuthRoutes(app);

await app.run();
app.logger.info('Application running');
