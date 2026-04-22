const axios = require('axios');

async function testAutoFetch() {
  try {
    console.log('🧪 Testing auto-fetch logic...\n');
    console.log('⚠️  Make sure VPN is OFF!\n');
    
    // Delete existing posts
    const { Client } = require('pg');
    const client = new Client({
      host: 'localhost',
      port: 5432,
      database: 'sadegh',
      user: 'postgres',
      password: 'B0b_Dylan',
    });
    
    await client.connect();
    console.log('🗑️  Deleting existing posts...');
    await client.query('DELETE FROM posts WHERE page_id = 12');
    console.log('✅ Deleted\n');
    await client.end();
    
    // Wait for backend to start
    console.log('⏳ Waiting 10 seconds for backend to start...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Sync with default limit (should auto-fetch 30 days for non-official)
    console.log('📥 Syncing Fars News (should auto-fetch ~30 days)...');
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:3000/telegram/sync', {
      username: 'farsna',
      messageLimit: 50,  // Small limit, but should auto-expand
      page_category: 'news_agency',
      client_keywords: ['قالیباف']
    });
    
    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    console.log(`\n✅ Sync complete in ${duration} seconds!`);
    console.log(`   ${response.data.data.message}`);
    
    // Check results
    const client2 = new Client({
      host: 'localhost',
      port: 5432,
      database: 'sadegh',
      user: 'postgres',
      password: 'B0b_Dylan',
    });
    
    await client2.connect();
    const stats = await client2.query(`
      SELECT 
        COUNT(*) as total,
        MIN(published_at) as oldest,
        MAX(published_at) as newest
      FROM posts 
      WHERE page_id = 12;
    `);
    
    if (stats.rows[0].total > 0) {
      const oldest = new Date(stats.rows[0].oldest);
      const newest = new Date(stats.rows[0].newest);
      const daysCovered = Math.floor((newest - oldest) / (1000 * 60 * 60 * 24));
      
      console.log(`\n📊 Results:`);
      console.log(`   Total relevant posts: ${stats.rows[0].total}`);
      console.log(`   Oldest post: ${oldest.toLocaleString('fa-IR')}`);
      console.log(`   Newest post: ${newest.toLocaleString('fa-IR')}`);
      console.log(`   Days covered: ${daysCovered}`);
      
      if (daysCovered >= 25) {
        console.log(`\n✅ SUCCESS: Auto-fetch covered ${daysCovered} days!`);
      } else {
        console.log(`\n⚠️  WARNING: Only ${daysCovered} days covered (expected ~30)`);
      }
    }
    
    await client2.end();
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAutoFetch();
