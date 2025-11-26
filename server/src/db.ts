import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

// Turso database configuration
// TURSO_DATABASE_URL should be like: libsql://your-db-name-username.turso.io
// TURSO_AUTH_TOKEN is the auth token from Turso

const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl) {
    throw new Error('TURSO_DATABASE_URL or DATABASE_URL is missing');
}

// Create libSQL client for Turso
const client = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
});

export const db = drizzle(client, { schema });

// Export client for raw queries if needed
export { client };
