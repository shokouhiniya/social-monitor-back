const { Client } = require('pg');

async function checkKeywordMatches() {
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

    // Check Fars News posts
    const pageId = 12;
    const keyword = 'قالیباف';
    
    // Count posts with keyword
    const withKeyword = await client.query(`
      SELECT COUNT(*) as count
      FROM posts 
      WHERE page_id = $1 AND caption ILIKE $2;
    `, [pageId, `%${keyword}%`]);
    
    // Count total posts
    const total = await client.query(`
      SELECT COUNT(*) as count
      FROM posts 
      WHERE page_id = $1;
    `, [pageId]);
    
    console.log(`📊 Fars News (Page ${pageId}) Statistics:`);
    console.log(`   Total posts: ${total.rows[0].count}`);
    console.log(`   Posts with "${keyword}": ${withKeyword.rows[0].count}`);
    console.log(`   Posts without "${keyword}": ${total.rows[0].count - withKeyword.rows[0].count}`);
    
    // Show sample posts WITH keyword
    console.log(`\n✅ Sample posts WITH "${keyword}":`);
    const samplesWithKeyword = await client.query(`
      SELECT id, LEFT(caption, 100) as caption_preview
      FROM posts 
      WHERE page_id = $1 AND caption ILIKE $2
      LIMIT 3;
    `, [pageId, `%${keyword}%`]);
    
    samplesWithKeyword.rows.forEach((post, idx) => {
      console.log(`   ${idx + 1}. [ID ${post.id}] ${post.caption_preview}...`);
    });
    
    // Show sample posts WITHOUT keyword
    console.log(`\n❌ Sample posts WITHOUT "${keyword}":`);
    const samplesWithoutKeyword = await client.query(`
      SELECT id, LEFT(caption, 100) as caption_preview
      FROM posts 
      WHERE page_id = $1 AND caption NOT ILIKE $2
      LIMIT 3;
    `, [pageId, `%${keyword}%`]);
    
    samplesWithoutKeyword.rows.forEach((post, idx) => {
      console.log(`   ${idx + 1}. [ID ${post.id}] ${post.caption_preview}...`);
    });
    
    // Check page category
    const page = await client.query(`
      SELECT page_category, client_keywords
      FROM pages
      WHERE id = $1;
    `, [pageId]);
    
    console.log(`\n📄 Page Configuration:`);
    console.log(`   Category: ${page.rows[0].page_category}`);
    console.log(`   Keywords: ${page.rows[0].client_keywords ? page.rows[0].client_keywords.join(', ') : 'NULL'}`);
    
    console.log(`\n💡 Recommendation:`);
    if (page.rows[0].page_category === 'official') {
      console.log(`   ⚠️  Page is set as "official" - all posts are saved regardless of keywords`);
      console.log(`   ✅ Change page_category to "news_agency" to enable filtering`);
    } else {
      console.log(`   ✅ Page category is correct for filtering`);
      console.log(`   ⚠️  Existing posts were fetched before filtering was implemented`);
      console.log(`   💡 Delete existing posts and re-fetch to apply filtering`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkKeywordMatches();
