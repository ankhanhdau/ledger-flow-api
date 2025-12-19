import { getClient } from '../db/connection.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
    const client = await getClient();
    
    try {
        console.log('🚀 Starting database migration...');
        
        // Read the schema.sql file
        const schemaPath = join(__dirname, '../db/schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        
        console.log('📖 Reading schema from:', schemaPath);
        
        // Execute the schema
        await client.query(schema);
        
        console.log('✅ Database schema created successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate().catch((error) => {
    console.error('Fatal error during migration:', error);
    process.exit(1);
});