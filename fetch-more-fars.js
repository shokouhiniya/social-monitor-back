const axios = require('axios');

async function fetchMoreFars() {
  try {
    console.log('📥 Fetching more posts from Fars News (page 12)...\n');
    
    const response = await axios.post('http://localhost:3000/telegram/fetch-more/12', {
      messageLimit: 200  // Fetch 200 messages
    });
    
    console.log('✅ Response:', response.data);
    console.log('\n📊 Summary:');
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Message: ${response.data.message}`);
    console.log(`   Messages fetched: ${response.data.messages_fetched}`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

fetchMoreFars();
