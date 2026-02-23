import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerConversationRoutes } from './routes/conversations.js';
import { registerVocabularyRoutes } from './routes/vocabulary.js';

const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable authentication
app.withAuth();

// Enable storage for audio files
app.withStorage();

// Register routes
registerConversationRoutes(app);
registerVocabularyRoutes(app);

await app.run();
app.logger.info('Application running');
