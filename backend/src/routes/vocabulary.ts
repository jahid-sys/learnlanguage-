import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { gateway } from '@specific-dev/framework';
import { generateText } from 'ai';

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

interface DailyWord {
  id: string;
  latvianWord: string;
  englishTranslation: string;
  context: string | null;
  date: string;
}

interface DailyVocabularyResponse {
  topic: string;
  words: DailyWord[];
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

  // GET /api/vocabulary/daily - Get daily vocabulary words for practice
  app.fastify.get(
    '/api/vocabulary/daily',
    {
      schema: {
        description: 'Get 5 daily vocabulary words for practice (generates if not exists for today)',
        tags: ['vocabulary'],
        response: {
          200: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              words: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    latvianWord: { type: 'string' },
                    englishTranslation: { type: 'string' },
                    context: { type: ['string', 'null'] },
                    date: { type: 'string', format: 'date' },
                  },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<DailyVocabularyResponse | void> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;

      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];

      app.logger.info({ userId, date: todayString }, 'Fetching daily vocabulary');

      try {
        // Check if daily vocabulary already exists for today
        const existingDaily = await app.db
          .select()
          .from(schema.dailyVocabulary)
          .where(
            and(
              eq(schema.dailyVocabulary.userId, userId),
              eq(schema.dailyVocabulary.date, todayString as any)
            )
          );

        if (existingDaily.length >= 5) {
          // Return existing daily vocabulary
          app.logger.info({ userId, count: existingDaily.length }, 'Returning existing daily vocabulary');

          // Group by topic (should all be same topic for a day)
          const topic = existingDaily[0].topic;
          const words: DailyWord[] = existingDaily.map((item) => ({
            id: item.id,
            latvianWord: item.latvianWord,
            englishTranslation: item.englishTranslation,
            context: item.context,
            date: todayString,
          }));

          return {
            topic,
            words,
          };
        }

        // Generate new daily vocabulary using AI
        app.logger.info({ userId }, 'Generating new daily vocabulary');

        const prompt = `Generate 5 Latvian vocabulary words for language learning. Pick a specific topic (like Food, Travel, Weather, Family, Work, Shopping, Health, Education, Sports, or Nature). Return ONLY valid JSON in this exact format with no markdown or extra text:
{
  "topic": "topic name",
  "words": [
    {"latvian": "word1", "english": "translation1", "context": "example sentence in Latvian"},
    {"latvian": "word2", "english": "translation2", "context": "example sentence in Latvian"},
    {"latvian": "word3", "english": "translation3", "context": "example sentence in Latvian"},
    {"latvian": "word4", "english": "translation4", "context": "example sentence in Latvian"},
    {"latvian": "word5", "english": "translation5", "context": "example sentence in Latvian"}
  ]
}`;

        const { text: aiResponse } = await generateText({
          model: gateway('google/gemini-3-flash'),
          prompt,
        });

        app.logger.info({ userId, responseLength: aiResponse.length }, 'AI generated daily vocabulary');

        // Parse JSON response
        let generatedData: { topic: string; words: Array<{ latvian: string; english: string; context: string }> };

        try {
          generatedData = JSON.parse(aiResponse);
        } catch (parseError) {
          app.logger.error({ err: parseError, aiResponse }, 'Failed to parse AI response as JSON');
          return reply.status(500).send({ error: 'Failed to parse AI response' });
        }

        // Validate response structure
        if (!generatedData.topic || !Array.isArray(generatedData.words) || generatedData.words.length !== 5) {
          app.logger.error({ generatedData }, 'Invalid AI response structure');
          return reply.status(500).send({ error: 'Invalid AI response format' });
        }

        // Save to database
        const dailyWords = await app.db
          .insert(schema.dailyVocabulary)
          .values(
            generatedData.words.map((word) => ({
              userId,
              latvianWord: word.latvian,
              englishTranslation: word.english,
              context: word.context,
              topic: generatedData.topic,
              date: todayString as any,
            }))
          )
          .returning();

        app.logger.info({ userId, topic: generatedData.topic, count: dailyWords.length }, 'Daily vocabulary saved');

        return {
          topic: generatedData.topic,
          words: dailyWords.map((item) => ({
            id: item.id,
            latvianWord: item.latvianWord,
            englishTranslation: item.englishTranslation,
            context: item.context,
            date: todayString,
          })),
        };
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to get/generate daily vocabulary');
        return reply.status(500).send({ error: 'Failed to get daily vocabulary' });
      }
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
