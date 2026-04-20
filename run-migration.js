const { Client } = require('pg');

async function runMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'sadegh',
    user: 'postgres',
    password: 'B0b_Dylan',
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to database: sadegh');

    console.log('📝 Running migration: Adding last_processed_timeframe column...');
    
    const result = await client.query(`
      ALTER TABLE pages ADD COLUMN IF NOT EXISTS last_processed_timeframe VARCHAR(10);
    `);

    console.log('✅ Migration completed successfully!');
    console.log('📊 Column "last_processed_timeframe" added to pages table');

    // Verify the column was added
    const verifyResult = await client.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'pages' AND column_name = 'last_processed_timeframe';
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful:');
      console.log('   Column:', verifyResult.rows[0].column_name);
      console.log('   Type:', verifyResult.rows[0].data_type);
      console.log('   Max Length:', verifyResult.rows[0].character_maximum_length);
    } else {
      console.log('⚠️  Column not found in verification (might already exist)');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

runMigration();
