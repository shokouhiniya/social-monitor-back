const { Client } = require('pg');

async function verifyColumn() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'sadegh',
    user: 'postgres',
    password: 'B0b_Dylan',
  });

  try {
    await client.connect();
    
    // Check all columns in pages table
    const result = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'pages'
      ORDER BY ordinal_position;
    `);

    console.log('📊 Pages table columns:');
    console.log('─'.repeat(80));
    result.rows.forEach(row => {
      const maxLen = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  ${row.column_name.padEnd(30)} ${row.data_type}${maxLen.padEnd(10)} ${nullable}`);
    });
    console.log('─'.repeat(80));
    
    // Check if last_processed_timeframe exists
    const hasColumn = result.rows.some(row => row.column_name === 'last_processed_timeframe');
    
    if (hasColumn) {
      console.log('✅ Column "last_processed_timeframe" exists!');
    } else {
      console.log('❌ Column "last_processed_timeframe" NOT found!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyColumn();
