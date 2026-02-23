import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface VocabularyItem {
  id: string;
  latvianWord: string;
  englishTranslation: string;
  context: string | null;
  createdAt: string;
  conversationId?: string;
}

interface DeleteVocabularyResponse {
  success: boolean;
}

export function registerVocabularyRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/vocabulary - Get all vocabulary for authenticated user
  app.fastify.get(
    '/api/vocabulary',
    {
      schema: {
        description: "Get all vocabulary for authenticated user",
        tags: ['vocabulary'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                latvianWord: { type: 'string' },
                englishTranslation: { type: 'string' },
                context: { type: ['string', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
                conversationId: { type: 'string', format: 'uuid' },
              },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<VocabularyItem[]> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Fetching all vocabulary');

      const vocabularyItems = await app.db
        .select()
        .from(schema.vocabulary)
        .where(eq(schema.vocabulary.userId, userId))
        .orderBy(desc(schema.vocabulary.createdAt));

      app.logger.info({ userId, count: vocabularyItems.length }, 'Vocabulary retrieved');

      return vocabularyItems.map((item) => ({
        id: item.id,
        latvianWord: item.latvianWord,
        englishTranslation: item.englishTranslation,
        context: item.context,
        createdAt: item.createdAt.toISOString(),
        conversationId: item.conversationId,
      }));
    }
  );

  // GET /api/conversations/:id/vocabulary - Get vocabulary for a specific conversation
  app.fastify.get<{ Params: { id: string } }>(
    '/api/conversations/:id/vocabulary',
    {
      schema: {
        description: 'Get vocabulary for a conversation',
        tags: ['vocabulary'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                latvianWord: { type: 'string' },
                englishTranslation: { type: 'string' },
                context: { type: ['string', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<VocabularyItem[] | void> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const userId = session.user.id;

      app.logger.info({ conversationId: id, userId }, 'Fetching conversation vocabulary');

      // Verify conversation exists and belongs to user
      const conversation = await app.db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, id))
        .then((result) => result[0]);

      if (!conversation) {
        app.logger.warn({ conversationId: id, userId }, 'Conversation not found');
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      if (conversation.userId !== userId) {
        app.logger.warn({ conversationId: id, userId, ownerId: conversation.userId }, 'User not authorized to access conversation');
        return reply.status(403).send({ error: 'Not authorized' });
      }

      const vocabularyItems = await app.db
        .select()
        .from(schema.vocabulary)
        .where(eq(schema.vocabulary.conversationId, id))
        .orderBy(desc(schema.vocabulary.createdAt));

      app.logger.info({ conversationId: id, count: vocabularyItems.length }, 'Conversation vocabulary retrieved');

      return vocabularyItems.map((item) => ({
        id: item.id,
        latvianWord: item.latvianWord,
        englishTranslation: item.englishTranslation,
        context: item.context,
        createdAt: item.createdAt.toISOString(),
      }));
    }
  );

  // DELETE /api/vocabulary/:id - Delete a vocabulary item
  app.fastify.delete<{ Params: { id: string } }>(
    '/api/vocabulary/:id',
    {
      schema: {
        description: 'Delete a vocabulary item',
        tags: ['vocabulary'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<DeleteVocabularyResponse | void> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const userId = session.user.id;

      app.logger.info({ vocabularyId: id, userId }, 'Deleting vocabulary item');

      const vocabularyItem = await app.db
        .select()
        .from(schema.vocabulary)
        .where(eq(schema.vocabulary.id, id))
        .then((result) => result[0]);

      if (!vocabularyItem) {
        app.logger.warn({ vocabularyId: id, userId }, 'Vocabulary item not found');
        return reply.status(404).send({ error: 'Vocabulary item not found' });
      }

      if (vocabularyItem.userId !== userId) {
        app.logger.warn({ vocabularyId: id, userId, ownerId: vocabularyItem.userId }, 'User not authorized to delete vocabulary');
        return reply.status(403).send({ error: 'Not authorized' });
      }

      await app.db.delete(schema.vocabulary).where(eq(schema.vocabulary.id, id));

      app.logger.info({ vocabularyId: id, userId }, 'Vocabulary item deleted successfully');

      return { success: true };
    }
  );
}
