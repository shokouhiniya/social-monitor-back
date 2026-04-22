const axios = require('axios');

async function resyncFars() {
  try {
    console.log('🔄 Re-syncing Fars News channel with large message limit...\n');
    console.log('⚠️  Make sure your VPN is OFF!\n');
    
    // First, delete existing posts
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
    const deleteResult = await client.query('DELETE FROM posts WHERE page_id = 12');
    console.log(`✅ Deleted ${deleteResult.rowCount} posts\n`);
    await client.end();
    
    // Now sync with large limit
    console.log('📥 Syncing channel with 500 message limit...');
    const response = await axios.post('http://localhost:3000/telegram/sync', {
      username: 'farsna',
      messageLimit: 500,  // Fetch 500 messages
      page_category: 'news_agency',
      client_keywords: ['قالیباف']
    });
    
    console.log('\n✅ Sync complete!');
    console.log('📊 Summary:');
    console.log(`   Status: ${response.data.data.status}`);
    console.log(`   Message: ${response.data.data.message}`);
    console.log(`   Messages fetched: ${response.data.data.messages_fetched}`);
    
    console.log('\n💡 Now check the timeline - you should see posts from the last 2 weeks!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.message.includes('VPN')) {
      console.log('\n⚠️  Make sure your VPN is OFF and try again!');
    }
  }
}

resyncFars();
