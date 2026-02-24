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
  // Check if this is an OAuth callback request
  if (!ctx.path.includes('callback') && !ctx.path.includes('sign-in/social')) {
    return;
  }

  // If the request includes a redirect_uri from a native app, we'll handle it specially
  const query = ctx.query as Record<string, unknown>;
  const redirectUri = query?.redirect_uri as string;
  const isNativeClient = redirectUri && (
    redirectUri.startsWith('exp://') ||  // Expo
    redirectUri.startsWith('myapp://') ||  // Custom native scheme
    redirectUri.startsWith('rnapp://') ||  // React Native
    query?.client_type === 'native'
  );

  // Store native client indicator in context for the response handler
  if (isNativeClient) {
    ctx.context = {
      ...ctx.context,
      isNativeClient: true,
      nativeRedirectUri: redirectUri,
    };
  }
});

// Hook to modify OAuth callback response for native clients
const nativeOAuthResponseHook = createAuthMiddleware(async (ctx) => {
  // Only modify successful OAuth responses
  const isNativeClient = (ctx.context as Record<string, unknown>)?.isNativeClient;
  const newSession = ctx.context?.newSession;

  if (!newSession || !isNativeClient) {
    return;
  }

  // For native clients, redirect to the app scheme with session token as query parameter
  const sessionData = newSession as { session: { token: string }; user: { id: string } };
  const sessionToken = sessionData.session?.token;
  const userId = sessionData.user?.id;

  if (!sessionToken) {
    return;
  }

  const redirectUri = (ctx.context as Record<string, unknown>)?.nativeRedirectUri || 'myapp://oauth-callback';

  const callbackUrl = new URL(redirectUri as string);
  callbackUrl.searchParams.set('token', sessionToken);
  callbackUrl.searchParams.set('userId', userId || '');

  // Return redirect response with the modified URL
  return {
    context: {
      ...ctx.context,
      response: {
        statusCode: 302,
        headers: {
          Location: callbackUrl.toString(),
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
