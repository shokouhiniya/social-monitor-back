const axios = require('axios');

async function deepFetchFars() {
  try {
    console.log('🔍 Deep fetching Fars News with 1000 message limit...\n');
    console.log('⚠️  Make sure your VPN is OFF!\n');
    console.log('⏳ This may take a while...\n');
    
    // Delete existing posts first
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
    
    // Fetch with very large limit
    console.log('📥 Fetching 1000 messages from Fars News...');
    const response = await axios.post('http://localhost:3000/telegram/sync', {
      username: 'farsna',
      messageLimit: 1000,
      page_category: 'news_agency',
      client_keywords: ['قالیباف']
    });
    
    console.log('\n✅ Fetch complete!');
    console.log(`   Messages fetched: ${response.data.data.messages_fetched}`);
    
    // Check date range
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
      const daysDiff = Math.floor((newest - oldest) / (1000 * 60 * 60 * 24));
      
      console.log(`\n📊 Results:`);
      console.log(`   Total relevant posts: ${stats.rows[0].total}`);
      console.log(`   Oldest post: ${oldest.toLocaleString('fa-IR')}`);
      console.log(`   Newest post: ${newest.toLocaleString('fa-IR')}`);
      console.log(`   Date range: ${daysDiff} days`);
      
      if (daysDiff < 3) {
        console.log(`\n⚠️  WARNING: All posts are from the last ${daysDiff} days!`);
        console.log(`   This means Fars News hasn't mentioned "قالیباف" in their older posts.`);
        console.log(`   Out of 1000 messages, only ${stats.rows[0].total} contained the keyword.`);
      }
    }
    
    await client2.end();
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

deepFetchFars();
