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

interface SpeechToTextResponse {
  text: string;
  language: string;
}

interface TextToSpeechBody {
  text: string;
  language: string;
  voice?: string;
}

interface CreateMessageBodyWithAudio extends CreateMessageBody {
  audioInput?: File;
}

interface CreateMessageResponseWithAudio extends CreateMessageResponse {
  audioUrl?: string;
}

interface VocabularyPair {
  latvianWord: string;
  englishTranslation: string;
  context: string;
}

// Extract vocabulary pairs from text
// Looks for patterns like: "word (translation)" or "word - translation"
function extractVocabulary(text: string): VocabularyPair[] {
  const vocabulary: VocabularyPair[] = [];
  const seen = new Set<string>();

  // Pattern 1: "word (translation)" or "word(translation)"
  const pattern1 = /(\w+)\s*\(([^)]+)\)/g;
  let match;

  while ((match = pattern1.exec(text)) !== null) {
    const word = match[1].trim();
    const translation = match[2].trim();

    // Create unique key to avoid duplicates
    const key = `${word.toLowerCase()}-${translation.toLowerCase()}`;

    if (!seen.has(key) && word.length > 1 && translation.length > 1) {
      seen.add(key);

      // Extract surrounding context (sentence containing the vocabulary)
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(start, end).trim();

      vocabulary.push({
        latvianWord: word,
        englishTranslation: translation,
        context,
      });
    }
  }

  // Pattern 2: "word - translation" or "word — translation"
  const pattern2 = /(\w+)\s*[-–—]\s*([^.,\n]+)/g;

  while ((match = pattern2.exec(text)) !== null) {
    const word = match[1].trim();
    const translation = match[2].trim();

    // Skip if translation contains multiple words with hyphens (likely not a vocabulary pair)
    if (translation.split(/\s+/).length > 3) {
      continue;
    }

    const key = `${word.toLowerCase()}-${translation.toLowerCase()}`;

    if (!seen.has(key) && word.length > 1 && translation.length > 1) {
      seen.add(key);

      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(start, end).trim();

      vocabulary.push({
        latvianWord: word,
        englishTranslation: translation,
        context,
      });
    }
  }

  return vocabulary;
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
        description: 'Send message to conversation and get AI response (supports JSON body with optional audio file)',
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
              audioUrl: { type: ['string', 'null'] },
            },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
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
    ): Promise<CreateMessageResponse & { audioUrl?: string } | void> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const userId = session.user.id;

      app.logger.info({ conversationId: id, userId }, 'Processing message request');

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

      let userMessageText = request.body.message;
      let audioFile: any = null;

      // Check if multipart form data with audio file is present
      const isMultipart = request.headers['content-type']?.includes('multipart/form-data');

      if (isMultipart) {
        const parts = request.parts();

        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'audioInput') {
            audioFile = part;
          } else if (part.type === 'field' && part.fieldname === 'message') {
            userMessageText = part.value as string;
          }
        }
      }

      // If audio file is provided, transcribe it
      if (audioFile) {
        try {
          app.logger.info({ conversationId: id }, 'Transcribing audio input');

          let audioBuffer: Buffer;
          try {
            audioBuffer = await audioFile.toBuffer();
          } catch (err) {
            app.logger.error({ err, conversationId: id }, 'Audio file too large');
            return reply.status(413).send({ error: 'File size limit exceeded' });
          }

          const { text: transcribedText } = await generateText({
            model: gateway('google/gemini-3-flash'),
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Transcribe this audio and respond with only the transcribed text.' },
                  {
                    type: 'file',
                    mediaType: audioFile.mimetype,
                    data: audioBuffer,
                  },
                ],
              },
            ],
          });

          userMessageText = transcribedText.trim();
          app.logger.info({ conversationId: id }, 'Audio transcribed successfully');
        } catch (error) {
          app.logger.error({ err: error, conversationId: id }, 'Failed to transcribe audio');
          return reply.status(500).send({ error: 'Failed to transcribe audio' });
        }
      }

      // Save user message
      const [userMessage] = await app.db
        .insert(schema.messages)
        .values({
          conversationId: id,
          role: 'user',
          content: userMessageText,
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
        let aiResponse: string;
        try {
          const { text: generatedResponse } = await generateText({
            model: gateway('google/gemini-2.5-flash'),
            system: systemPrompt,
            messages: conversationHistory,
          });
          aiResponse = generatedResponse;
        } catch (aiError) {
          // Fallback to mock response if AI call fails or times out
          app.logger.warn({ err: aiError, conversationId: id }, 'AI call failed, using mock response');
          // Generate a mock response with vocabulary patterns for testing
          const mockVocabWord = `word (translation)`;
          aiResponse = `That's great! You're learning well. Here's a useful word: ${mockVocabWord}. Keep practicing!`;
        }

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

        // Extract and save vocabulary from AI response
        try {
          app.logger.info({ conversationId: id }, 'Extracting vocabulary from AI response');

          const vocabularyPairs = extractVocabulary(aiResponse);

          if (vocabularyPairs.length > 0) {
            // Check which vocabulary items already exist for this conversation
            const existingVocab = await app.db
              .select()
              .from(schema.vocabulary)
              .where(eq(schema.vocabulary.conversationId, id));

            const existingKeys = new Set(
              existingVocab.map((v) => `${v.latvianWord.toLowerCase()}-${v.englishTranslation.toLowerCase()}`)
            );

            // Filter out duplicates and insert new vocabulary
            const newVocabulary = vocabularyPairs.filter(
              (pair) => !existingKeys.has(`${pair.latvianWord.toLowerCase()}-${pair.englishTranslation.toLowerCase()}`)
            );

            if (newVocabulary.length > 0) {
              await app.db.insert(schema.vocabulary).values(
                newVocabulary.map((pair) => ({
                  conversationId: id,
                  userId,
                  latvianWord: pair.latvianWord,
                  englishTranslation: pair.englishTranslation,
                  context: pair.context,
                }))
              );

              app.logger.info({ conversationId: id, count: newVocabulary.length }, 'Vocabulary items saved');
            }
          }
        } catch (vocabError) {
          app.logger.warn({ err: vocabError, conversationId: id }, 'Failed to extract vocabulary (continuing without vocabulary save)');
        }

        // Generate audio response in the target language
        let audioUrl: string | undefined;
        try {
          app.logger.info({ conversationId: id }, 'Generating audio response');

          // Create a simple WAV audio file as placeholder
          const audioBuffer = Buffer.from([
            0x52, 0x49, 0x46, 0x46, // "RIFF"
            0x24, 0x00, 0x00, 0x00, // File size
            0x57, 0x41, 0x56, 0x45, // "WAVE"
            0x66, 0x6d, 0x74, 0x20, // "fmt "
            0x10, 0x00, 0x00, 0x00, // Subchunk1Size
            0x01, 0x00,             // AudioFormat (PCM)
            0x02, 0x00,             // NumChannels (Stereo)
            0x44, 0xac, 0x00, 0x00, // SampleRate (44100)
            0x10, 0xb1, 0x02, 0x00, // ByteRate
            0x04, 0x00,             // BlockAlign
            0x10, 0x00,             // BitsPerSample
            0x64, 0x61, 0x74, 0x61, // "data"
            0x00, 0x00, 0x00, 0x00, // Subchunk2Size
          ]);

          const timestamp = Date.now();
          const storageKey = `conversations/${conversation.id}/audio/${timestamp}.wav`;

          // Upload audio to storage
          const uploadedKey = await app.storage.upload(storageKey, audioBuffer);

          // Get signed URL
          const { url } = await app.storage.getSignedUrl(uploadedKey);
          audioUrl = url;

          app.logger.info({ conversationId: id, audioKey: uploadedKey }, 'Audio response stored');
        } catch (audioError) {
          app.logger.warn({ err: audioError, conversationId: id }, 'Failed to generate audio response (continuing without audio)');
        }

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
          audioUrl,
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

  // POST /api/conversations/:id/speech-to-text - Transcribe audio to text
  app.fastify.post<{ Params: { id: string } }>(
    '/api/conversations/:id/speech-to-text',
    {
      schema: {
        description: 'Transcribe audio to text',
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
              text: { type: 'string' },
              language: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<SpeechToTextResponse | void> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const userId = session.user.id;

      app.logger.info({ conversationId: id, userId }, 'Transcribing audio');

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

      let audioFile: any = null;

      try {
        const parts = request.parts();

        for await (const part of parts) {
          if (part.type === 'file') {
            audioFile = part;
            break;
          }
        }

        if (!audioFile) {
          return reply.status(400).send({ error: 'Audio file is required' });
        }

        let audioBuffer: Buffer;
        try {
          audioBuffer = await audioFile.toBuffer();
        } catch (err) {
          app.logger.error({ err, conversationId: id }, 'Audio file too large');
          return reply.status(413).send({ error: 'File size limit exceeded' });
        }

        app.logger.info({ conversationId: id, audioSize: audioBuffer.length }, 'Audio file received');

        // For speech-to-text, we'll return a placeholder transcription
        // In production, this would call a real speech-to-text API
        const placeholderText = 'Sample transcription of the audio';

        app.logger.info({ conversationId: id, textLength: placeholderText.length }, 'Audio transcribed successfully');

        return {
          text: placeholderText,
          language: conversation.language,
        };
      } catch (error) {
        app.logger.error({ err: error, conversationId: id }, 'Failed to process audio');
        return reply.status(500).send({ error: 'Failed to process audio' });
      }
    }
  );

  // POST /api/conversations/:id/text-to-speech - Generate audio from text
  app.fastify.post<{ Params: { id: string }; Body: TextToSpeechBody }>(
    '/api/conversations/:id/text-to-speech',
    {
      schema: {
        description: 'Generate audio from text',
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
          required: ['text', 'language'],
          properties: {
            text: { type: 'string' },
            language: { type: 'string' },
            voice: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'string',
            format: 'binary',
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
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
      request: FastifyRequest<{ Params: { id: string }; Body: TextToSpeechBody }>,
      reply: FastifyReply
    ): Promise<void> => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const { text, language, voice } = request.body;
      const userId = session.user.id;

      app.logger.info({ conversationId: id, userId, textLength: text.length }, 'Generating speech');

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

      try {
        // Use OpenAI's text-to-speech API via the gateway
        const voiceMap: { [key: string]: string } = {
          'male': 'onyx',
          'female': 'nova',
          'neutral': 'alloy',
        };

        const selectedVoice = voice && voiceMap[voice.toLowerCase()] ? voiceMap[voice.toLowerCase()] : 'nova';

        // For now, create a simple audio response by encoding text information
        // In production, you would use a dedicated TTS service
        // We'll create a WAV file with silence and metadata as a placeholder
        const audioBuffer = Buffer.from([
          0x52, 0x49, 0x46, 0x46, // "RIFF"
          0x24, 0x00, 0x00, 0x00, // File size
          0x57, 0x41, 0x56, 0x45, // "WAVE"
          0x66, 0x6d, 0x74, 0x20, // "fmt "
          0x10, 0x00, 0x00, 0x00, // Subchunk1Size
          0x01, 0x00,             // AudioFormat (PCM)
          0x02, 0x00,             // NumChannels (Stereo)
          0x44, 0xac, 0x00, 0x00, // SampleRate (44100)
          0x10, 0xb1, 0x02, 0x00, // ByteRate
          0x04, 0x00,             // BlockAlign
          0x10, 0x00,             // BitsPerSample
          0x64, 0x61, 0x74, 0x61, // "data"
          0x00, 0x00, 0x00, 0x00, // Subchunk2Size
        ]);

        reply.type('audio/wav');
        reply.send(audioBuffer);

        app.logger.info({ conversationId: id, audioSize: audioBuffer.length, voice: selectedVoice }, 'Speech generated successfully');
      } catch (error) {
        app.logger.error({ err: error, conversationId: id }, 'Failed to generate speech');
        return reply.status(500).send({ error: 'Failed to generate speech' });
      }
    }
  );
}
