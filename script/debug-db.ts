import 'dotenv/config'; // Requires dotenv package
import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
console.log("Testing Connection to:", dbUrl?.replace(/:([^:@]+)@/, ":***@")); // Hide password log

if (!dbUrl) throw new Error("No DATABASE_URL");

const sql = postgres(dbUrl);

async function test() {
    try {
        const res = await sql`select version()`;
        console.log("Success:", res);
    } catch (e) {
        console.error("Connection Failed:", e);
    } finally {
        await sql.end();
    }
}

test();
