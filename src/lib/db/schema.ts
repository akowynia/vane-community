import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { Block } from '../types';
import { SearchSources } from '../agents/search/types';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('member'), // 'admin' | 'member'
  status: text('status').notNull().default('active'), // 'active' | 'disabled'
  allowedProviders: text('allowed_providers', { mode: 'json' })
    .$type<string[]>()
    .default(sql`'["*"]'`),
  allowedModels: text('allowed_models', { mode: 'json' })
    .$type<string[]>()
    .default(sql`'["*"]'`),
  tokenLimit5h: integer('token_limit_5h'),
  tokenLimitWeekly: integer('token_limit_weekly'),
  tokenLimitPerDay: integer('token_limit_per_day'),
  tokenLimitPerMonth: integer('token_limit_per_month'),
  maxTokensPerRequest: integer('max_tokens_per_request'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const userSessions = sqliteTable('user_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  messageId: text('messageId').notNull(),
  chatId: text('chatId').notNull(),
  backendId: text('backendId').notNull(),
  query: text('query').notNull(),
  createdAt: text('createdAt').notNull(),
  responseBlocks: text('responseBlocks', { mode: 'json' })
    .$type<Block[]>()
    .default(sql`'[]'`),
  status: text({ enum: ['answering', 'completed', 'error'] }).default(
    'answering',
  ),
});

interface DBFile {
  name: string;
  fileId: string;
}

export const waypoints = sqliteTable('waypoints', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon').default('Waypoints'),
  systemInstructions: text('system_instructions'),
  userId: text('user_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const waypointCrons = sqliteTable('waypoint_crons', {
  id: text('id').primaryKey(),
  waypointId: text('waypoint_id')
    .notNull()
    .references(() => waypoints.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  schedule: text('schedule').notNull(),
  prompt: text('prompt').notNull(),
  sources: text('sources', { mode: 'json' })
    .$type<SearchSources[]>()
    .default(sql`'[]'`),
  optimizationMode: text('optimization_mode').notNull().default('balanced'),
  chatModelProvider: text('chat_model_provider').notNull(),
  chatModelKey: text('chat_model_key').notNull(),
  embeddingModelProvider: text('embedding_model_provider'),
  embeddingModelKey: text('embedding_model_key'),
  systemInstructions: text('system_instructions'),
  timezone: text('timezone').notNull().default('UTC'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastRunAt: text('last_run_at'),
  nextRunAt: text('next_run_at'),
  lastStatus: text('last_status'),
  lastError: text('last_error'),
  lastChatId: text('last_chat_id'),
  userId: text('user_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  userId: text('userId'),
  waypointId: text('waypointId'),
  sources: text('sources', {
    mode: 'json',
  })
    .$type<SearchSources[]>()
    .default(sql`'[]'`),
  files: text('files', { mode: 'json' })
    .$type<DBFile[]>()
    .default(sql`'[]'`),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  userId: text('user_id').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'disabled' | 'revoked'
  rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(60),
  tokenLimitPerDay: integer('token_limit_per_day'),
  allowedProviders: text('allowed_providers', { mode: 'json' })
    .$type<string[]>()
    .default(sql`'["*"]'`),
  allowedModels: text('allowed_models', { mode: 'json' })
    .$type<string[]>()
    .default(sql`'["*"]'`),
  defaultWaypointId: text('default_waypoint_id'),
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const modelStats = sqliteTable('model_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: text('chatId'),
  messageId: text('messageId'),
  userId: text('userId'),
  apiKeyId: text('apiKeyId'),
  source: text('source').notNull().default('ui'), // 'ui' | 'api' | 'cron'
  providerId: text('providerId').notNull(),
  modelKey: text('modelKey').notNull(),
  query: text('query'),
  step: text('step').notNull().default('answer'),
  promptTokens: integer('promptTokens').notNull().default(0),
  completionTokens: integer('completionTokens').notNull().default(0),
  totalTokens: integer('totalTokens').notNull().default(0),
  durationMs: integer('durationMs').notNull().default(0),
  timeToFirstTokenMs: integer('timeToFirstTokenMs'),
  tokensPerSecond: integer('tokensPerSecond'),
  optimizationMode: text('optimizationMode'),
  status: text('status').notNull().default('success'),
  errorMessage: text('errorMessage'),
  createdAt: text('createdAt').notNull(),
});

export const scratchpadTemplates = sqliteTable('scratchpad_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon').default('FileText'),
  content: text('content').notNull(),
  systemInstructions: text('system_instructions'),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  userId: text('user_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const scratchpads = sqliteTable('scratchpads', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  type: text('type').notNull().default('note'),
  metadata: text('metadata', { mode: 'json' }).$type<any>().default(sql`'{}'`),
  userId: text('user_id'),
  waypointId: text('waypoint_id'),
  templateId: text('template_id'),
  sources: text('sources', { mode: 'json' }).$type<any[]>().default(sql`'[]'`),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const scratchpadVersions = sqliteTable('scratchpad_versions', {
  id: text('id').primaryKey(),
  scratchpadId: text('scratchpad_id')
    .notNull()
    .references(() => scratchpads.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  summary: text('summary'),
  prompt: text('prompt'),
  sources: text('sources', { mode: 'json' }).$type<any[]>().default(sql`'[]'`),
  author: text('author').notNull().default('ai'), // 'ai' | 'user'
  createdAt: text('created_at').notNull(),
});

export const scratchpadMessages = sqliteTable('scratchpad_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scratchpadId: text('scratchpad_id')
    .notNull()
    .references(() => scratchpads.id, { onDelete: 'cascade' }),
  messageId: text('message_id').notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  query: text('query').notNull(),
  responseBlocks: text('response_blocks', { mode: 'json' })
    .$type<any[]>()
    .default(sql`'[]'`),
  sources: text('sources', { mode: 'json' }).$type<any[]>().default(sql`'[]'`),
  metrics: text('metrics', { mode: 'json' }).$type<any>(),
  selectedText: text('selected_text'),
  createdAt: text('created_at').notNull(),
});


