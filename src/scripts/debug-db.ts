import prisma from '../lib/prisma';

async function main() {
    try {
        console.log('--- TABLES ---');
        const tables = await prisma.$queryRaw`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name
    `;
        console.table(tables);
        console.log('--------------');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
