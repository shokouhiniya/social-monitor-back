const { Client } = require('pg');

async function fixFarsPage() {
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

    const pageId = 12;
    
    // Update page category
    console.log('📝 Updating Fars News page category to "news_agency"...');
    await client.query(`
      UPDATE pages 
      SET page_category = 'news_agency'
      WHERE id = $1;
    `, [pageId]);
    console.log('✅ Page category updated\n');
    
    // Delete all existing posts from this page
    console.log('🗑️  Deleting existing posts...');
    const deleteResult = await client.query(`
      DELETE FROM posts 
      WHERE page_id = $1;
    `, [pageId]);
    console.log(`✅ Deleted ${deleteResult.rowCount} posts\n`);
    
    // Verify
    const page = await client.query(`
      SELECT id, name, page_category, client_keywords
      FROM pages
      WHERE id = $1;
    `, [pageId]);
    
    console.log('📄 Updated Page Configuration:');
    console.log(`   ID: ${page.rows[0].id}`);
    console.log(`   Name: ${page.rows[0].name}`);
    console.log(`   Category: ${page.rows[0].page_category}`);
    console.log(`   Keywords: ${page.rows[0].client_keywords.join(', ')}`);
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Make sure VPN is OFF (Telegram requires no VPN)');
    console.log('   2. Go to the page profile in the frontend');
    console.log('   3. Click "دریافت پست‌های بیشتر" button');
    console.log('   4. Only posts containing "قالیباف" will be saved');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixFarsPage();
