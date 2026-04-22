const { Client } = require('pg');

async function checkPostDates() {
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
    
    // Get post count and date range
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_posts,
        MIN(published_at) as oldest_post,
        MAX(published_at) as newest_post,
        SUM(CASE WHEN is_relevant THEN 1 ELSE 0 END) as relevant_posts
      FROM posts 
      WHERE page_id = $1;
    `, [pageId]);
    
    console.log('📊 Fars News Posts Statistics:');
    console.log(`   Total posts: ${stats.rows[0].total_posts}`);
    console.log(`   Relevant posts: ${stats.rows[0].relevant_posts}`);
    console.log(`   Oldest post: ${stats.rows[0].oldest_post}`);
    console.log(`   Newest post: ${stats.rows[0].newest_post}`);
    
    if (stats.rows[0].oldest_post && stats.rows[0].newest_post) {
      const oldestDate = new Date(stats.rows[0].oldest_post);
      const newestDate = new Date(stats.rows[0].newest_post);
      const daysDiff = Math.floor((newestDate - oldestDate) / (1000 * 60 * 60 * 24));
      console.log(`   Date range: ${daysDiff} days`);
    }
    
    // Show posts by day
    console.log('\n📅 Posts by day (last 14 days):');
    const byDay = await client.query(`
      SELECT 
        DATE(published_at) as post_date,
        COUNT(*) as post_count,
        SUM(CASE WHEN is_relevant THEN 1 ELSE 0 END) as relevant_count
      FROM posts 
      WHERE page_id = $1 
        AND published_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(published_at)
      ORDER BY post_date DESC;
    `, [pageId]);
    
    byDay.rows.forEach(row => {
      console.log(`   ${row.post_date}: ${row.relevant_count} relevant / ${row.post_count} total`);
    });
    
    // Check if there are posts older than 2 days
    const olderPosts = await client.query(`
      SELECT COUNT(*) as count
      FROM posts 
      WHERE page_id = $1 
        AND published_at < NOW() - INTERVAL '2 days';
    `, [pageId]);
    
    console.log(`\n📌 Posts older than 2 days: ${olderPosts.rows[0].count}`);
    
    // Sample recent posts
    console.log('\n📝 Sample recent posts:');
    const samples = await client.query(`
      SELECT id, LEFT(caption, 80) as caption_preview, published_at, is_relevant
      FROM posts 
      WHERE page_id = $1
      ORDER BY published_at DESC
      LIMIT 5;
    `, [pageId]);
    
    samples.rows.forEach((post, idx) => {
      const date = new Date(post.published_at).toLocaleString('fa-IR');
      console.log(`   ${idx + 1}. [${post.is_relevant ? '✓' : '✗'}] ${date}`);
      console.log(`      ${post.caption_preview}...`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkPostDates();
