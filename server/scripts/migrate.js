import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from '../configs/db.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
    console.log('🚀 [Nexora AI Migration] Checking database connection...');

    if (!process.env.DATABASE_URL) {
        console.error('❌ [Nexora AI Migration] DATABASE_URL is not set. Please provide DATABASE_URL in server/.env.');
        process.exit(1);
    }

    try {
        // Create schema_migrations tracking table if not exists
        await sql`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `;

        const appliedRows = await sql`SELECT name FROM schema_migrations`;
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

            if (typeof sql.unsafe === 'function') {
                await sql.unsafe(sqlContent);
            } else {
                await sql([sqlContent]);
            }

            await sql`
                INSERT INTO schema_migrations (name)
                VALUES (${file})
                ON CONFLICT (name) DO NOTHING;
            `;

            console.log(`✅ [Nexora AI Migration] Successfully applied: ${file}`);
            appliedCount++;
        }

        console.log(`🎉 [Nexora AI Migration] Migration complete. Applied ${appliedCount} new migration(s).`);
    } catch (error) {
        console.error('❌ [Nexora AI Migration Error]:', error.message);
        process.exit(1);
    }
}

runMigrations();
