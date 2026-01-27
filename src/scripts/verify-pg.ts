import 'dotenv/config';
import { Pool } from 'pg';

async function verify() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Force no-verify for local script
    });

    try {
        console.log('Connecting via pg...');
        const client = await pool.connect();
        console.log('Connected.');

        const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    `);

        console.log('Tables found:', res.rows.length);
        console.table(res.rows);

        const tables = res.rows.map(r => r.table_name);
        const expected = ['User', 'Professional', 'TimeToken', 'MarketplaceOrder', 'Booking', 'Session', 'Payment', 'AuditLog'];
        const missing = expected.filter(t => !tables.includes(t));

        if (missing.length > 0) {
            console.error('MISSING TABLES:', missing);
            process.exit(1);
        } else {
            console.log('ALL TABLES PRESENT.');
        }

        client.release();
    } catch (err) {
        console.error('PG Error:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verify();
