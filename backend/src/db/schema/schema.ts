import { pgTable, uuid, text, timestamp, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  language: text('language').notNull(),
  level: text('level').notNull(),
  title: text('title'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const vocabulary = pgTable('vocabulary', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  latvianWord: text('latvian_word').notNull(),
  englishTranslation: text('english_translation').notNull(),
  context: text('context'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
  vocabulary: many(vocabulary),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const dailyVocabulary = pgTable('daily_vocabulary', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  latvianWord: text('latvian_word').notNull(),
  englishTranslation: text('english_translation').notNull(),
  context: text('context'),
  topic: text('topic').notNull(),
  date: date('date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const vocabularyRelations = relations(vocabulary, ({ one }) => ({
  conversation: one(conversations, {
    fields: [vocabulary.conversationId],
    references: [conversations.id],
  }),
}));
