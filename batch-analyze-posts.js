const { Client } = require('pg');
const axios = require('axios');

async function batchAnalyzePosts() {
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
      SELECT id, caption
      FROM posts
      WHERE sentiment_score IS NULL AND caption IS NOT NULL AND caption != ''
      ORDER BY published_at DESC
      LIMIT 50;
    `);

    const postsToAnalyze = result.rows;
    console.log(`📊 Found ${postsToAnalyze.length} posts to analyze (showing first 50)\n`);

    if (postsToAnalyze.length === 0) {
      console.log('✅ All posts already have sentiment scores!');
      return;
    }

    console.log('🤖 Sending batch to AI for analysis...\n');

    // Create batch prompt
    const postsText = postsToAnalyze.map((post, idx) => 
      `${idx}: "${post.caption.substring(0, 200)}"`
    ).join('\n\n');

    const prompt = `Analyze the sentiment of these social media posts. Return ONLY a JSON array with no additional text.

Posts:
${postsText}

Return format (JSON array only):
[
  {"index": 0, "sentiment_score": <-1 to 1>, "sentiment_label": "<angry/hopeful/neutral/sad>"},
  {"index": 1, "sentiment_score": <-1 to 1>, "sentiment_label": "<angry/hopeful/neutral/sad>"},
  ...
]`;

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
        timeout: 90000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || '';
    console.log('📝 Received AI response\n');

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.error('❌ Could not parse AI response');
      console.log('Response:', content.substring(0, 500));
      return;
    }

    const analyses = JSON.parse(jsonMatch[0]);
    console.log(`✅ Parsed ${analyses.length} sentiment analyses\n`);

    // Update posts
    let updated = 0;
    for (const analysis of analyses) {
      const post = postsToAnalyze[analysis.index];
      if (post) {
        await client.query(
          'UPDATE posts SET sentiment_score = $1, sentiment_label = $2 WHERE id = $3',
          [analysis.sentiment_score, analysis.sentiment_label, post.id]
        );
        updated++;
        process.stdout.write('.');
      }
    }

    console.log(`\n\n✅ Updated ${updated} posts with sentiment scores!`);
    console.log(`\n💡 Run this script multiple times to analyze all posts (processes 50 at a time)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  } finally {
    await client.end();
  }
}

// Load environment variables
require('dotenv').config();

batchAnalyzePosts();
