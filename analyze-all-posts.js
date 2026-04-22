const { Client } = require('pg');
const axios = require('axios');

async function analyzeAllPosts() {
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

    // Get all posts without sentiment scores
    const result = await client.query(`
      SELECT id, caption, page_id
      FROM posts
      WHERE sentiment_score IS NULL AND caption IS NOT NULL AND caption != ''
      ORDER BY published_at DESC;
    `);

    const postsToAnalyze = result.rows;
    console.log(`📊 Found ${postsToAnalyze.length} posts without sentiment scores\n`);

    if (postsToAnalyze.length === 0) {
      console.log('✅ All posts already have sentiment scores!');
      return;
    }

    console.log('🤖 Starting AI analysis...\n');

    let analyzed = 0;
    let failed = 0;

    // Process in batches of 10 to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < postsToAnalyze.length; i += batchSize) {
      const batch = postsToAnalyze.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(postsToAnalyze.length / batchSize)}...`);

      const batchPromises = batch.map(async (post) => {
        try {
          const prompt = `Analyze the sentiment of this social media post. Return ONLY a JSON object with no additional text.

Post: "${post.caption.substring(0, 500)}"

Return format:
{
  "sentiment_score": <number between -1 and 1>,
  "sentiment_label": "<angry/hopeful/neutral/sad>"
}`;

          const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              model: 'google/gemini-2.5-pro',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3,
            },
            {
              headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || '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'}`,
                'Content-Type': 'application/json',
              },
              timeout: 30000,
            }
          );

          const content = response.data?.choices?.[0]?.message?.content || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            
            // Update the post
            await client.query(
              'UPDATE posts SET sentiment_score = $1, sentiment_label = $2 WHERE id = $3',
              [analysis.sentiment_score, analysis.sentiment_label, post.id]
            );
            
            analyzed++;
            process.stdout.write('.');
            return true;
          } else {
            failed++;
            process.stdout.write('x');
            return false;
          }
        } catch (error) {
          failed++;
          process.stdout.write('x');
          return false;
        }
      });

      await Promise.all(batchPromises);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < postsToAnalyze.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n\n✅ Analysis complete!');
    console.log(`   Analyzed: ${analyzed} posts`);
    console.log(`   Failed: ${failed} posts`);
    console.log(`   Success rate: ${((analyzed / postsToAnalyze.length) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

// Load environment variables
require('dotenv').config();

analyzeAllPosts();
