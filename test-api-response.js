const axios = require('axios');

async function testApiResponse() {
  try {
    console.log('🔍 Testing API responses for Fars News (page 12)...\n');
    
    // Test 1: Get page details
    console.log('1️⃣ Fetching page details...');
    const pageResponse = await axios.get('http://localhost:3000/pages/12');
    const page = pageResponse.data.data;
    console.log(`   Name: ${page.name}`);
    console.log(`   Category: ${page.page_category}`);
    console.log(`   Keywords: ${page.client_keywords ? page.client_keywords.join(', ') : 'NULL'}`);
    console.log(`   Total posts: ${page.posts ? page.posts.length : 0}`);
    
    // Test 2: Get posts with different timeframes
    const timeframes = ['24h', '3d', '1w', '2w', '1m'];
    
    for (const timeframe of timeframes) {
      console.log(`\n2️⃣ Fetching posts for timeframe: ${timeframe}...`);
      const postsResponse = await axios.get(`http://localhost:3000/pages/12`);
      const posts = postsResponse.data.data.posts || [];
      
      // Filter by timeframe manually to see what should be shown
      const now = new Date();
      let cutoffDate = new Date();
      
      switch(timeframe) {
        case '24h': cutoffDate.setHours(now.getHours() - 24); break;
        case '3d': cutoffDate.setDate(now.getDate() - 3); break;
        case '1w': cutoffDate.setDate(now.getDate() - 7); break;
        case '2w': cutoffDate.setDate(now.getDate() - 14); break;
        case '1m': cutoffDate.setMonth(now.getMonth() - 1); break;
      }
      
      const filteredPosts = posts.filter(p => new Date(p.published_at) >= cutoffDate);
      console.log(`   Total posts in DB: ${posts.length}`);
      console.log(`   Posts within ${timeframe}: ${filteredPosts.length}`);
      
      if (filteredPosts.length > 0) {
        const oldest = new Date(Math.min(...filteredPosts.map(p => new Date(p.published_at))));
        const newest = new Date(Math.max(...filteredPosts.map(p => new Date(p.published_at))));
        console.log(`   Date range: ${oldest.toLocaleDateString('fa-IR')} to ${newest.toLocaleDateString('fa-IR')}`);
      }
    }
    
    // Test 3: Check if posts are marked as relevant
    console.log(`\n3️⃣ Checking post relevance...`);
    const allPosts = pageResponse.data.data.posts || [];
    const relevantCount = allPosts.filter(p => p.is_relevant !== false).length;
    console.log(`   Total posts: ${allPosts.length}`);
    console.log(`   Relevant posts: ${relevantCount}`);
    console.log(`   Non-relevant posts: ${allPosts.length - relevantCount}`);
    
    // Test 4: Show sample posts
    console.log(`\n4️⃣ Sample posts (most recent 5):`);
    const recentPosts = allPosts
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      .slice(0, 5);
    
    recentPosts.forEach((post, idx) => {
      const date = new Date(post.published_at);
      const captionPreview = post.caption ? post.caption.substring(0, 60) : 'No caption';
      console.log(`   ${idx + 1}. [${date.toLocaleString('fa-IR')}] ${captionPreview}...`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testApiResponse();
