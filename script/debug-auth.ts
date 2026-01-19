import pg from 'pg';

const { Pool } = pg;

const HOST = 'db.fjxpwckoqpxlnebcjnab.supabase.co';
const USER = 'postgres';
const PASSWORDS = [
    'Sigma_2026_Secure_Update!',
    'Sigma_2026_Secure_Update!*',
    'Sigma_2026_Secure_Update',
];

async function testPassword(password: string) {
    console.log(`Testing password: ${password}`);
    const pool = new Pool({
        user: USER,
        host: HOST,
        database: 'postgres',
        password: password,
        port: 5432,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
    });

    try {
        const client = await pool.connect();
        console.log(`✅ SUCCESS! Correct password is: ${password}`);
        client.release();
        return true;
    } catch (err: any) {
        if (err.code === '28P01') {
            console.log(`❌ Auth Failed for: ${password}`);
        } else {
            console.log(`⚠️  Other Error for ${password}: ${err.message}`);
        }
        return false;
    } finally {
        await pool.end();
    }
}

async function run() {
    for (const pwd of PASSWORDS) {
        const success = await testPassword(pwd);
        if (success) process.exit(0);
    }
    console.log("❌ All passwords failed.");
    process.exit(1);
}

run();
