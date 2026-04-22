const { Client } = require('pg');
const axios = require('axios');

async function analyzeMissingSentiments() {
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

    // Find posts without sentiment scores
    const result = await client.query(`
      SELECT id, page_id, caption, published_at
      FROM posts
      WHERE sentiment_score IS NULL
      ORDER BY published_at DESC;
    `);

    console.log(`📊 Found ${result.rows.length} posts without sentiment scores\n`);

    if (result.rows.length === 0) {
      console.log('✅ All posts already have sentiment scores!');
      await client.end();
      return;
    }

    console.log('🤖 Analyzing sentiments using OpenRouter AI...\n');

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
    
    // Process in batches of 10
    const batchSize = 10;
    let processed = 0;

    for (let i = 0; i < result.rows.length; i += batchSize) {
      const batch = result.rows.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(result.rows.length / batchSize)} (${batch.length} posts)...`);

      const postsText = batch.map((post, idx) => 
        `پست ${idx}: "${(post.caption || '').substring(0, 200)}"`
      ).join('\n\n');

      const prompt = `تو یک تحلیل‌گر احساسات هستی. برای هر پست زیر، احساس کلی را تحلیل کن.

${postsText}

خروجی را دقیقاً به فرمت JSON array زیر برگردان:
[
  {"index": 0, "sentiment_score": عدد از -1 تا 1, "sentiment_label": "angry/hopeful/neutral/sad"},
  {"index": 1, "sentiment_score": عدد از -1 تا 1, "sentiment_label": "angry/hopeful/neutral/sad"}
]

راهنما:
- angry: خشم، انتقاد شدید، نفرت (-1 تا -0.5)
- sad: ناامیدی، غم، نگرانی (-0.5 تا -0.1)
- neutral: خنثی، بی‌طرف، اطلاع‌رسانی (-0.1 تا 0.1)
- hopeful: امیدواری، مثبت، سازنده (0.1 تا 1)`;

      try {
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'google/gemini-2.5-pro',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000,
          },
        );

        const content = response.data?.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          const sentiments = JSON.parse(jsonMatch[0]);
          
          // Update database
          for (const sentiment of sentiments) {
            const post = batch[sentiment.index];
            if (post) {
              await client.query(`
                UPDATE posts
                SET sentiment_score = $1, sentiment_label = $2
                WHERE id = $3;
              `, [sentiment.sentiment_score, sentiment.sentiment_label, post.id]);
              
              processed++;
            }
          }
          
          console.log(`✅ Batch complete (${processed}/${result.rows.length} total)`);
        } else {
          console.warn(`⚠️  Could not parse AI response for this batch`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error processing batch: ${error.message}`);
        // Continue with next batch
      }
    }

    console.log(`\n🎉 Complete! Analyzed ${processed} posts`);

    // Show statistics
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(sentiment_score) as with_sentiment,
        COUNT(*) - COUNT(sentiment_score) as without_sentiment
      FROM posts;
    `);

    console.log(`\n📊 Final Statistics:`);
    console.log(`   Total posts: ${stats.rows[0].total}`);
    console.log(`   With sentiment: ${stats.rows[0].with_sentiment}`);
    console.log(`   Without sentiment: ${stats.rows[0].without_sentiment}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

analyzeMissingSentiments();
