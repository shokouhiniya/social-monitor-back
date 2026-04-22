const { Client } = require('pg');

async function checkSentimentScores() {
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

    // Check sentiment score distribution
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_posts,
        COUNT(sentiment_score) as posts_with_sentiment,
        COUNT(*) - COUNT(sentiment_score) as posts_without_sentiment,
        AVG(sentiment_score) as avg_sentiment,
        MIN(sentiment_score) as min_sentiment,
        MAX(sentiment_score) as max_sentiment,
        COUNT(CASE WHEN sentiment_score = 0 THEN 1 END) as zero_sentiment_count,
        COUNT(CASE WHEN sentiment_score IS NULL THEN 1 END) as null_sentiment_count
      FROM posts;
    `);

    console.log('📊 Sentiment Score Statistics:');
    console.log('─'.repeat(60));
    const stats = result.rows[0];
    console.log(`Total Posts:              ${stats.total_posts}`);
    console.log(`Posts WITH sentiment:     ${stats.posts_with_sentiment}`);
    console.log(`Posts WITHOUT sentiment:  ${stats.posts_without_sentiment}`);
    console.log(`Posts with score = 0:     ${stats.zero_sentiment_count}`);
    console.log(`Posts with score = NULL:  ${stats.null_sentiment_count}`);
    console.log(`Average sentiment:        ${stats.avg_sentiment}`);
    console.log(`Min sentiment:            ${stats.min_sentiment}`);
    console.log(`Max sentiment:            ${stats.max_sentiment}`);
    console.log('─'.repeat(60));

    // Check sentiment by date
    const byDate = await client.query(`
      SELECT 
        DATE(published_at) as date,
        COUNT(*) as post_count,
        COUNT(sentiment_score) as with_sentiment,
        AVG(sentiment_score) as avg_sentiment,
        MIN(sentiment_score) as min_sentiment,
        MAX(sentiment_score) as max_sentiment
      FROM posts
      WHERE published_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(published_at)
      ORDER BY date DESC
      LIMIT 10;
    `);

    console.log('\n📅 Last 10 Days Sentiment:');
    console.log('─'.repeat(80));
    console.log('Date       | Posts | With Sentiment | Avg    | Min    | Max');
    console.log('─'.repeat(80));
    byDate.rows.forEach(row => {
      const date = row.date.toISOString().split('T')[0];
      const avg = row.avg_sentiment ? Number(row.avg_sentiment).toFixed(2) : 'NULL';
      const min = row.min_sentiment ? Number(row.min_sentiment).toFixed(2) : 'NULL';
      const max = row.max_sentiment ? Number(row.max_sentiment).toFixed(2) : 'NULL';
      console.log(`${date} | ${String(row.post_count).padEnd(5)} | ${String(row.with_sentiment).padEnd(14)} | ${avg.padEnd(6)} | ${min.padEnd(6)} | ${max}`);
    });
    console.log('─'.repeat(80));

    // Check a sample of posts
    const sample = await client.query(`
      SELECT 
        id,
        LEFT(caption, 50) as caption_preview,
        sentiment_score,
        sentiment_label,
        published_at
      FROM posts
      ORDER BY published_at DESC
      LIMIT 10;
    `);

    console.log('\n📝 Sample of Recent Posts:');
    console.log('─'.repeat(80));
    sample.rows.forEach(row => {
      const date = row.published_at ? row.published_at.toISOString().split('T')[0] : 'NULL';
      const score = row.sentiment_score !== null ? row.sentiment_score : 'NULL';
      const label = row.sentiment_label || 'NULL';
      console.log(`ID: ${row.id} | Date: ${date} | Score: ${score} | Label: ${label}`);
      console.log(`   Caption: ${row.caption_preview || 'No caption'}...`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSentimentScores();
