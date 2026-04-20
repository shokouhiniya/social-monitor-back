const { Client } = require('pg');

async function updateExistingPages() {
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

    // Update existing pages to be 'official' category
    const result = await client.query(`
      UPDATE pages 
      SET page_category = 'official' 
      WHERE page_category IS NULL;
    `);
    
    console.log(`✅ Updated ${result.rowCount} pages to 'official' category`);

    // Show current pages
    const pages = await client.query(`
      SELECT id, name, username, platform, page_category, client_keywords 
      FROM pages 
      ORDER BY id;
    `);
    
    console.log('\n📊 Current pages:');
    pages.rows.forEach(page => {
      console.log(`  - ${page.name} (@${page.username}) [${page.platform}] - Category: ${page.page_category || 'NULL'}, Keywords: ${page.client_keywords || 'NULL'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

updateExistingPages();
