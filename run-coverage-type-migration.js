const { Client } = require('pg');
const fs = require('fs');

async function runMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'sadegh',
    user: 'postgres',
    password: 'B0b_Dylan',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const sql = fs.readFileSync('add-coverage-type.sql', 'utf8');
    
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 60) + '...');
        await client.query(statement);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    
    // Verify
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
      AND column_name = 'coverage_type';
    `);
    
    console.log('\n📊 Verified column:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await client.end();
  }
}

runMigration();
