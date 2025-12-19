import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DB_URL || 'postgresql://user:password@localhost:5432/ledger_db'
});

export const getClient = async () => {
    const client = await pool.connect();
    return client;
};