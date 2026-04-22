const { Client } = require('pg');

async function checkPagesAndPosts() {
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

    // Check pages
    const pages = await client.query(`
      SELECT id, name, username, platform, page_category, client_keywords 
      FROM pages 
      ORDER BY id;
    `);
    
    console.log('📊 Pages:');
    pages.rows.forEach(page => {
      console.log(`  ID ${page.id}: ${page.name} (@${page.username}) [${page.platform}]`);
      console.log(`    Category: ${page.page_category || 'NULL'}`);
      console.log(`    Keywords: ${page.client_keywords ? page.client_keywords.join(', ') : 'NULL'}`);
    });

    // Check posts for each page
    for (const page of pages.rows) {
      const posts = await client.query(`
        SELECT id, caption, is_relevant, published_at 
        FROM posts 
        WHERE page_id = $1 
        ORDER BY published_at DESC 
        LIMIT 5;
      `, [page.id]);
      
      console.log(`\n  📝 Recent posts for page ${page.id} (${page.name}):`);
      console.log(`     Total posts: ${posts.rows.length}`);
      
      if (posts.rows.length > 0) {
        posts.rows.forEach((post, idx) => {
          const captionPreview = post.caption ? post.caption.substring(0, 60) + '...' : 'No caption';
          console.log(`     ${idx + 1}. [${post.is_relevant ? '✓' : '✗'}] ${captionPreview}`);
        });
      }
    }

    // Count relevant vs non-relevant posts
    const stats = await client.query(`
      SELECT 
        page_id,
        COUNT(*) as total_posts,
        SUM(CASE WHEN is_relevant THEN 1 ELSE 0 END) as relevant_posts,
        SUM(CASE WHEN NOT is_relevant THEN 1 ELSE 0 END) as non_relevant_posts
      FROM posts
      GROUP BY page_id;
    `);
    
    console.log('\n\n📈 Post Statistics:');
    stats.rows.forEach(stat => {
      const page = pages.rows.find(p => p.id === stat.page_id);
      console.log(`  Page ${stat.page_id} (${page?.name}):`);
      console.log(`    Total: ${stat.total_posts}, Relevant: ${stat.relevant_posts}, Not Relevant: ${stat.non_relevant_posts}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkPagesAndPosts();
