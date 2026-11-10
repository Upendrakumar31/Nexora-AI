import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from '../configs/db.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Splits SQL content into individual executable statements,
 * correctly handling single quotes, dollar quotes ($$ ... $$), and comments.
 */
export function splitSqlStatements(content) {
    const statements = [];
    let current = '';
    let inDollarQuote = false;
    let dollarTag = '';
    let inSingleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (inLineComment) {
            if (char === '\n') inLineComment = false;
            continue;
        }

        if (inBlockComment) {
            if (char === '*' && nextChar === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }

        if (!inSingleQuote && !inDollarQuote) {
            if (char === '-' && nextChar === '-') {
                inLineComment = true;
                i++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                i++;
                continue;
            }
        }

        if (!inDollarQuote) {
            if (char === "'") {
                if (inSingleQuote && nextChar === "'") {
                    current += "''";
                    i++;
                    continue;
                }
                inSingleQuote = !inSingleQuote;
                current += char;
                continue;
            }
        }

        if (!inSingleQuote) {
            if (char === '$') {
                const match = content.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
                if (match) {
                    const tag = match[1];
                    if (!inDollarQuote) {
                        inDollarQuote = true;
                        dollarTag = tag;
                        current += tag;
                        i += tag.length - 1;
                        continue;
                    } else if (content.slice(i, i + dollarTag.length) === dollarTag) {
                        inDollarQuote = false;
                        current += dollarTag;
                        i += dollarTag.length - 1;
                        continue;
                    }
                }
            }
        }

        if (char === ';' && !inSingleQuote && !inDollarQuote) {
            const trimmed = current.trim();
            if (trimmed) {
                statements.push(trimmed);
            }
            current = '';
            continue;
        }

        current += char;
    }

    const trimmed = current.trim();
    if (trimmed) {
        statements.push(trimmed);
    }

    return statements;
}

export async function runMigrations(customSql = sql) {
    console.log('🚀 [Nexora AI Migration] Checking database connection...');

    if (!process.env.DATABASE_URL && customSql === sql) {
        console.error('❌ [Nexora AI Migration] DATABASE_URL is not set. Please provide DATABASE_URL in server/.env.');
        process.exit(1);
    }

    try {
        // Create schema_migrations tracking table if not exists
        await customSql`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `;

        const appliedRows = await customSql`SELECT name FROM schema_migrations`;
        const appliedSet = new Set(appliedRows.map(r => r.name));

        const migrationsDir = path.join(__dirname, '../migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`📁 [Nexora AI Migration] Found ${files.length} migration file(s).`);

        let appliedCount = 0;

        for (const file of files) {
            if (appliedSet.has(file)) {
                console.log(`⏩ [Nexora AI Migration] Already applied: ${file}`);
                continue;
            }

            console.log(`⏳ [Nexora AI Migration] Applying: ${file}...`);
            const filePath = path.join(migrationsDir, file);
            const sqlContent = fs.readFileSync(filePath, 'utf8');
            const statements = splitSqlStatements(sqlContent);

            for (const statement of statements) {
                if (typeof customSql.unsafe === 'function') {
                    await customSql.unsafe(statement);
                } else {
                    await customSql([statement]);
                }
            }

            await customSql`
                INSERT INTO schema_migrations (name)
                VALUES (${file})
                ON CONFLICT (name) DO NOTHING;
            `;

            console.log(`✅ [Nexora AI Migration] Successfully applied: ${file}`);
            appliedCount++;
        }

        console.log(`🎉 [Nexora AI Migration] Migration complete. Applied ${appliedCount} new migration(s).`);
        return { success: true, appliedCount };
    } catch (error) {
        console.error('❌ [Nexora AI Migration Error]:', error.message);
        if (customSql === sql) {
            process.exit(1);
        }
        throw error;
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    runMigrations();
}
