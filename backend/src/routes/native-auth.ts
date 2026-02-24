import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';

interface SessionWithUser {
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export function registerNativeAuthRoutes(app: App) {
  // Get session from Bearer token (for native mobile apps)
  // Native apps extract the token from the OAuth redirect URL and pass it via Authorization header
  app.fastify.get('/api/auth/session/from-token', {
    schema: {
      description: 'Get session from Bearer token (for native mobile apps)',
      tags: ['auth'],
      headers: {
        type: 'object',
        properties: {
          authorization: {
            type: 'string',
            description: 'Bearer token from OAuth callback (Authorization: Bearer <token>)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            session: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                token: { type: 'string' },
                userId: { type: 'string' },
                expiresAt: { type: 'string' },
              },
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                emailVerified: { type: 'boolean' },
                image: { type: ['string', 'null'] },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<SessionWithUser | { error: string }> => {
    try {
      // Extract Bearer token from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        app.logger.warn({ authHeader }, 'Invalid authorization header format');
        reply.code(401);
        return { error: 'Missing or invalid Authorization header' };
      }

      const token = authHeader.slice(7); // Remove "Bearer " prefix
      app.logger.info({ tokenLength: token.length }, 'Attempting to validate session token');

      // Look up session by token
      const db = app.db;
      const sessionRecord = await db
        .select()
        .from(authSchema.session)
        .where(eq(authSchema.session.token, token))
        .limit(1);

      if (!sessionRecord || sessionRecord.length === 0) {
        app.logger.warn({ token: token.slice(0, 10) }, 'Session token not found');
        reply.code(401);
        return { error: 'Invalid or expired session token' };
      }

      const session = sessionRecord[0];

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        app.logger.warn({ sessionId: session.id, expiresAt: session.expiresAt }, 'Session has expired');
        reply.code(401);
        return { error: 'Session has expired' };
      }

      // Fetch the associated user
      const userRecord = await db
        .select()
        .from(authSchema.user)
        .where(eq(authSchema.user.id, session.userId))
        .limit(1);

      if (!userRecord || userRecord.length === 0) {
        app.logger.error({ userId: session.userId }, 'User not found for session');
        reply.code(401);
        return { error: 'User not found' };
      }

      const user = userRecord[0];
      app.logger.info({ userId: user.id, sessionId: session.id }, 'Session validated successfully');

      return {
        session: {
          id: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          userId: session.userId,
          expiresAt: session.expiresAt,
          token: session.token,
          ipAddress: session.ipAddress ?? undefined,
          userAgent: session.userAgent ?? undefined,
        },
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image ?? undefined,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to validate session token');
      reply.code(500);
      return { error: 'Failed to validate session' };
    }
  });
}
