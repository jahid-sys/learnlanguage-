import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { gateway } from '@specific-dev/framework';
import { generateText } from 'ai';

interface CreateConversationBody {
  language: string;
  level: string;
}

interface CreateMessageBody {
  message: string;
}

interface CreateConversationResponse {
  conversationId: string;
  language: string;
  level: string;
  createdAt: string;
}

interface GetConversationsResponse {
  conversationId: string;
  language: string;
  level: string;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

interface GetMessagesResponse {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface CreateMessageResponse {
  response: string;
  messageId: string;
}

interface DeleteResponse {
  success: boolean;
}

export function registerConversationRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/conversations - Create a new conversation
  app.fastify.post<{ Body: CreateConversationBody }>(
    '/api/conversations',
    {
      schema: {
        description: 'Create a new conversation',
        tags: ['conversations'],
        body: {
          type: 'object',
          required: ['language', 'level'],
          properties: {
            language: { type: 'string' },
            level: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              conversationId: { type: 'string', format: 'uuid' },
              language: { type: 'string' },
              level: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateConversationBody }>, reply: FastifyReply): Promise<CreateConversationResponse> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { language, level } = request.body;
      const userId = session.user.id;

      app.logger.info({ userId, language, level }, 'Creating conversation');

      const [conversation] = await app.db
        .insert(schema.conversations)
        .values({
          userId,
          language,
          level,
        })
        .returning();

      app.logger.info({ conversationId: conversation.id, userId }, 'Conversation created successfully');

      reply.status(201);
      return {
        conversationId: conversation.id,
        language: conversation.language,
        level: conversation.level,
        createdAt: conversation.createdAt.toISOString(),
      };
    }
  );

  // GET /api/conversations - Get user's conversations
  app.fastify.get(
    '/api/conversations',
    {
      schema: {
        description: "Get user's conversations",
        tags: ['conversations'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                conversationId: { type: 'string', format: 'uuid' },
                language: { type: 'string' },
                level: { type: 'string' },
                title: { type: ['string', 'null'] },
                lastMessageAt: { type: ['string', 'null'], format: 'date-time' },
                createdAt: { type: 'string', format: 'date-time' },
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
    async (request: FastifyRequest, reply: FastifyReply): Promise<GetConversationsResponse[]> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Fetching user conversations');

      const conversations = await app.db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.userId, userId))
        .orderBy(desc(schema.conversations.createdAt));

      app.logger.info({ userId, count: conversations.length }, 'Conversations retrieved');

      return conversations.map((conv) => ({
        conversationId: conv.id,
        language: conv.language,
        level: conv.level,
        title: conv.title,
        lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : null,
        createdAt: conv.createdAt.toISOString(),
      }));
    }
  );

  // GET /api/conversations/:id/messages - Get messages for a conversation
  app.fastify.get<{ Params: { id: string } }>(
    '/api/conversations/:id/messages',
    {
      schema: {
        description: 'Get messages for a conversation',
        tags: ['conversations'],
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
                role: { type: 'string' },
                content: { type: 'string' },
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<GetMessagesResponse[] | void> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const userId = session.user.id;

      app.logger.info({ conversationId: id, userId }, 'Fetching messages');

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

      const messages = await app.db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, id));

      app.logger.info({ conversationId: id, messageCount: messages.length }, 'Messages retrieved');

      return messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
      }));
    }
  );

  // POST /api/conversations/:id/messages - Send message and get AI response
  app.fastify.post<{ Params: { id: string }; Body: CreateMessageBody }>(
    '/api/conversations/:id/messages',
    {
      schema: {
        description: 'Send message to conversation and get AI response',
        tags: ['conversations'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              response: { type: 'string' },
              messageId: { type: 'string', format: 'uuid' },
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
          500: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: CreateMessageBody }>,
      reply: FastifyReply
    ): Promise<CreateMessageResponse | void> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const { message } = request.body;
      const userId = session.user.id;

      app.logger.info({ conversationId: id, userId }, 'Sending message');

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
        app.logger.warn({ conversationId: id, userId, ownerId: conversation.userId }, 'User not authorized');
        return reply.status(403).send({ error: 'Not authorized' });
      }

      // Save user message
      const [userMessage] = await app.db
        .insert(schema.messages)
        .values({
          conversationId: id,
          role: 'user',
          content: message,
        })
        .returning();

      app.logger.info({ messageId: userMessage.id, conversationId: id }, 'User message saved');

      try {
        // Fetch conversation history
        const messages = await app.db
          .select()
          .from(schema.messages)
          .where(eq(schema.messages.conversationId, id));

        // Build conversation for AI
        const conversationHistory = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const systemPrompt = `You are a language tutor specializing in teaching ${conversation.language} at the ${conversation.level} level. Your responsibilities include:
- Helping the student practice ${conversation.language} conversation
- Providing corrections when the student makes grammatical or vocabulary mistakes
- Offering explanations for corrections in a clear, educational way
- Using age-appropriate and contextually relevant examples
- Encouraging the student and maintaining a positive learning environment
- Adapting your responses to match the ${conversation.level} proficiency level

Always respond in ${conversation.language} when the student uses ${conversation.language}, and provide translations or English explanations when needed for comprehension.`;

        // Call AI with conversation history
        const { text: aiResponse } = await generateText({
          model: gateway('google/gemini-2.5-flash'),
          system: systemPrompt,
          messages: conversationHistory,
        });

        app.logger.info({ conversationId: id, responseLength: aiResponse.length }, 'AI response generated');

        // Save AI response
        const [assistantMessage] = await app.db
          .insert(schema.messages)
          .values({
            conversationId: id,
            role: 'assistant',
            content: aiResponse,
          })
          .returning();

        // Update conversation lastMessageAt
        await app.db
          .update(schema.conversations)
          .set({
            lastMessageAt: new Date(),
          })
          .where(eq(schema.conversations.id, id));

        app.logger.info(
          { conversationId: id, userMessageId: userMessage.id, assistantMessageId: assistantMessage.id },
          'Message exchange completed'
        );

        return {
          response: aiResponse,
          messageId: assistantMessage.id,
        };
      } catch (error) {
        app.logger.error({ err: error, conversationId: id }, 'Failed to generate AI response');
        return reply.status(500).send({ error: 'Failed to generate response' });
      }
    }
  );

  // DELETE /api/conversations/:id - Delete conversation
  app.fastify.delete<{ Params: { id: string } }>(
    '/api/conversations/:id',
    {
      schema: {
        description: 'Delete a conversation',
        tags: ['conversations'],
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<DeleteResponse | void> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const userId = session.user.id;

      app.logger.info({ conversationId: id, userId }, 'Deleting conversation');

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
        app.logger.warn({ conversationId: id, userId, ownerId: conversation.userId }, 'User not authorized to delete');
        return reply.status(403).send({ error: 'Not authorized' });
      }

      await app.db.delete(schema.conversations).where(eq(schema.conversations.id, id));

      app.logger.info({ conversationId: id, userId }, 'Conversation deleted successfully');

      return { success: true };
    }
  );
}
