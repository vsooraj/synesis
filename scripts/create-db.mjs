import pg from 'pg';
const { Client } = pg;

async function createDb() {
  const envUrl = process.env.DATABASE_URL || "postgresql://postgres:admin123@localhost:5432/Synesis";
  // We need to connect to the 'postgres' maintenance database to run 'CREATE DATABASE'
  const connectionString = envUrl.replace(/\/[^/]+$/, "/postgres");
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    await client.query('CREATE DATABASE "Synesis"');
    console.log('Database "Synesis" created successfully.');
  } catch (err) {
    if (err.code === '42P04') {
      console.log('Database "Synesis" already exists.');
    } else {
      console.error('Error creating database:', err);
    }
  } finally {
    await client.end();
  }
}

createDb();
