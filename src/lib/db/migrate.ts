import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const dbPath = path.join(DATA_DIR, './data/db.sqlite');

const db = new Database(dbPath);

const migrationsFolder = path.join(DATA_DIR, 'drizzle');

db.exec(`
  CREATE TABLE IF NOT EXISTS ran_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    run_on DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    allowed_providers TEXT DEFAULT '["*"]',
    allowed_models TEXT DEFAULT '["*"]',
    token_limit_5h INTEGER,
    token_limit_weekly INTEGER,
    token_limit_per_day INTEGER,
    token_limit_per_month INTEGER,
    max_tokens_per_request INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS model_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatId TEXT,
    messageId TEXT,
    providerId TEXT NOT NULL,
    modelKey TEXT NOT NULL,
    query TEXT,
    step TEXT NOT NULL DEFAULT 'answer',
    promptTokens INTEGER NOT NULL DEFAULT 0,
    completionTokens INTEGER NOT NULL DEFAULT 0,
    totalTokens INTEGER NOT NULL DEFAULT 0,
    durationMs INTEGER NOT NULL DEFAULT 0,
    timeToFirstTokenMs INTEGER,
    tokensPerSecond REAL,
    optimizationMode TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    errorMessage TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS waypoints (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Waypoints',
    system_instructions TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS waypoint_crons (
    id TEXT PRIMARY KEY,
    waypoint_id TEXT NOT NULL REFERENCES waypoints(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    schedule TEXT NOT NULL,
    prompt TEXT NOT NULL,
    sources TEXT DEFAULT '[]',
    optimization_mode TEXT NOT NULL DEFAULT 'balanced',
    chat_model_provider TEXT NOT NULL,
    chat_model_key TEXT NOT NULL,
    embedding_model_provider TEXT,
    embedding_model_key TEXT,
    system_instructions TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    next_run_at TEXT,
    last_status TEXT,
    last_error TEXT,
    last_chat_id TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scratchpad_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'FileText',
    content TEXT NOT NULL,
    system_instructions TEXT,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scratchpads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    user_id TEXT,
    waypoint_id TEXT,
    template_id TEXT,
    sources TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scratchpad_versions (
    id TEXT PRIMARY KEY,
    scratchpad_id TEXT NOT NULL REFERENCES scratchpads(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    prompt TEXT,
    sources TEXT DEFAULT '[]',
    author TEXT NOT NULL DEFAULT 'ai',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scratchpad_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scratchpad_id TEXT NOT NULL REFERENCES scratchpads(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    role TEXT NOT NULL,
    query TEXT NOT NULL,
    response_blocks TEXT DEFAULT '[]',
    sources TEXT DEFAULT '[]',
    metrics TEXT,
    selected_text TEXT,
    created_at TEXT NOT NULL
  );
`);


try { db.exec("ALTER TABLE chats ADD COLUMN userId TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE chats ADD COLUMN waypointId TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE model_stats ADD COLUMN userId TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN token_limit_5h INTEGER;"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN token_limit_weekly INTEGER;"); } catch(e) {}
try { db.exec("ALTER TABLE scratchpads ADD COLUMN waypoint_id TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE scratchpads ADD COLUMN template_id TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE scratchpad_messages ADD COLUMN metrics TEXT;"); } catch(e) {}



function sanitizeSql(content: string) {
  const statements = content
    .split(/--> statement-breakpoint/g)
    .map((stmt) =>
      stmt
        .split(/\r?\n/)
        .filter((l) => !l.trim().startsWith('-->'))
        .join('\n')
        .trim(),
    )
    .filter((stmt) => stmt.length > 0);

  return statements;
}

fs.readdirSync(migrationsFolder)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .forEach((file) => {
    const filePath = path.join(migrationsFolder, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    const statements = sanitizeSql(content);

    const migrationName = file.split('_')[0] || file;

    const already = db
      .prepare('SELECT 1 FROM ran_migrations WHERE name = ?')
      .get(migrationName);

    if (already) {
      console.log(`Skipping already-applied migration: ${file}`);
      return;
    }

    try {
      if (migrationName === '0001') {
        const messages = db
          .prepare(
            'SELECT id, type, metadata, content, chatId, messageId FROM messages',
          )
          .all();

        db.exec(`
                    CREATE TABLE IF NOT EXISTS messages_with_sources (
                        id INTEGER PRIMARY KEY,
                        type TEXT NOT NULL,
                        chatId TEXT NOT NULL,
                        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        messageId TEXT NOT NULL,
                        content TEXT,
                        sources TEXT DEFAULT '[]'
                    );
                `);

        const insertMessage = db.prepare(`
                    INSERT INTO messages_with_sources (type, chatId, createdAt, messageId, content, sources)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

        messages.forEach((msg: any) => {
          while (typeof msg.metadata === 'string') {
            msg.metadata = JSON.parse(msg.metadata || '{}');
          }
          if (msg.type === 'user') {
            insertMessage.run(
              'user',
              msg.chatId,
              msg.metadata['createdAt'],
              msg.messageId,
              msg.content,
              '[]',
            );
          } else if (msg.type === 'assistant') {
            insertMessage.run(
              'assistant',
              msg.chatId,
              msg.metadata['createdAt'],
              msg.messageId,
              msg.content,
              '[]',
            );
            const sources = msg.metadata['sources'] || '[]';
            if (sources && sources.length > 0) {
              insertMessage.run(
                'source',
                msg.chatId,
                msg.metadata['createdAt'],
                `${msg.messageId}-source`,
                '',
                JSON.stringify(sources),
              );
            }
          }
        });

        db.exec('DROP TABLE messages;');
        db.exec('ALTER TABLE messages_with_sources RENAME TO messages;');
      } else if (migrationName === '0002') {
        /* Migrate chat */
        db.exec(`
          CREATE TABLE IF NOT EXISTS chats_new (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            userId TEXT,
            sources TEXT DEFAULT '[]',
            files TEXT DEFAULT '[]'
          );
        `);

        const chats = db
          .prepare('SELECT id, title, createdAt, files FROM chats')
          .all();

        const insertChat = db.prepare(`
            INSERT INTO chats_new (id, title, createdAt, userId, sources, files)
            VALUES (?, ?, ?, ?, ?, ?)
          `);

        chats.forEach((chat: any) => {
          let files = chat.files;
          while (typeof files === 'string') {
            files = JSON.parse(files || '[]');
          }

          insertChat.run(
            chat.id,
            chat.title,
            chat.createdAt,
            chat.userId || null,
            '["web"]',
            JSON.stringify(files),
          );
        });

        db.exec('DROP TABLE chats;');
        db.exec('ALTER TABLE chats_new RENAME TO chats;');

        /* Migrate messages */

        db.exec(`
          CREATE TABLE IF NOT EXISTS messages_new (
            id INTEGER PRIMARY KEY,
            messageId TEXT NOT NULL,
            chatId TEXT NOT NULL,
            backendId TEXT NOT NULL,
            query TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            responseBlocks TEXT DEFAULT '[]',
            status TEXT DEFAULT 'answering'
          );
        `);

        const messages = db
          .prepare(
            'SELECT id, messageId, chatId, type, content, createdAt, sources FROM messages ORDER BY id ASC',
          )
          .all();

        const insertMessage = db.prepare(`
            INSERT INTO messages_new (messageId, chatId, backendId, query, createdAt, responseBlocks, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

        let currentMessageData: {
          sources?: any[];
          response?: string;
          query?: string;
          messageId?: string;
          chatId?: string;
          createdAt?: string;
        } = {};
        let lastCompleted = true;

        messages.forEach((msg: any) => {
          if (msg.type === 'user' && lastCompleted) {
            currentMessageData = {};
            currentMessageData.messageId = msg.messageId;
            currentMessageData.chatId = msg.chatId;
            currentMessageData.query = msg.content;
            currentMessageData.createdAt = msg.createdAt;
            lastCompleted = false;
          } else if (msg.type === 'source' && !lastCompleted) {
            let sources = msg.sources;

            while (typeof sources === 'string') {
              sources = JSON.parse(sources || '[]');
            }

            currentMessageData.sources = sources;
          } else if (msg.type === 'assistant' && !lastCompleted) {
            currentMessageData.response = msg.content;
            insertMessage.run(
              currentMessageData.messageId,
              currentMessageData.chatId,
              `${currentMessageData.messageId}-backend`,
              currentMessageData.query,
              currentMessageData.createdAt,
              JSON.stringify([
                {
                  id: crypto.randomUUID(),
                  type: 'text',
                  data: currentMessageData.response || '',
                },
                ...(currentMessageData.sources &&
                currentMessageData.sources.length > 0
                  ? [
                      {
                        id: crypto.randomUUID(),
                        type: 'source',
                        data: currentMessageData.sources,
                      },
                    ]
                  : []),
              ]),
              'completed',
            );

            lastCompleted = true;
          } else if (msg.type === 'user' && !lastCompleted) {
            /* Message wasn't completed so we'll just create the record with empty response */
            insertMessage.run(
              currentMessageData.messageId,
              currentMessageData.chatId,
              `${currentMessageData.messageId}-backend`,
              currentMessageData.query,
              currentMessageData.createdAt,
              JSON.stringify([
                {
                  id: crypto.randomUUID(),
                  type: 'text',
                  data: '',
                },
                ...(currentMessageData.sources &&
                currentMessageData.sources.length > 0
                  ? [
                      {
                        id: crypto.randomUUID(),
                        type: 'source',
                        data: currentMessageData.sources,
                      },
                    ]
                  : []),
              ]),
              'completed',
            );

            lastCompleted = true;
          }
        });

        db.exec('DROP TABLE messages;');
        db.exec('ALTER TABLE messages_new RENAME TO messages;');
      } else {
        // Execute each statement separately
        statements.forEach((stmt) => {
          if (stmt.trim()) {
            db.exec(stmt);
          }
        });
      }

      db.prepare('INSERT OR IGNORE INTO ran_migrations (name) VALUES (?)').run(
        migrationName,
      );
      console.log(`Applied migration: ${file}`);
    } catch (err) {
      console.error(`Failed to apply migration ${file}:`, err);
      throw err;
    }
  });

// Guarantee all essential columns exist after all migrations finish
try { db.exec("ALTER TABLE chats ADD COLUMN userId TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE model_stats ADD COLUMN userId TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN token_limit_5h INTEGER;"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN token_limit_weekly INTEGER;"); } catch(e) {}
try { db.exec("ALTER TABLE chats ADD COLUMN sources TEXT DEFAULT '[]';"); } catch(e) {}
try { db.exec("ALTER TABLE chats ADD COLUMN files TEXT DEFAULT '[]';"); } catch(e) {}
try { db.exec("ALTER TABLE chats ADD COLUMN waypointId TEXT;"); } catch(e) {}
