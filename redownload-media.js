/**
 * Re-download media for existing Instagram posts that have expired CDN URLs.
 * This script fetches fresh data from the API and downloads images locally.
 * 
 * Usage: node redownload-media.js
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_DATABASE || 'sadegh',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'B0b_Dylan',
};

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'b79509e210msh113fb4eced81297p155bcajsn897485f63480';

async function downloadMedia(url, pageId, postId) {
  try {
    const mediaDir = path.join(process.cwd(), 'public', 'media', String(pageId));
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
    const filename = `${postId}${ext}`;
    const filePath = path.join(mediaDir, filename);

    fs.writeFileSync(filePath, Buffer.from(response.data));
    return `/static/media/${pageId}/${filename}`;
  } catch (err) {
    console.warn(`  ⚠️ Failed to download: ${err.message}`);
    return null;
  }
}

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('✅ Connected to database');

  // Get all Instagram pages
  const pagesResult = await client.query(
    "SELECT id, username FROM pages WHERE platform = 'instagram'"
  );

  console.log(`📋 Found ${pagesResult.rows.length} Instagram pages\n`);

  for (const page of pagesResult.rows) {
    console.log(`\n🔄 Processing page: @${page.username} (ID: ${page.id})`);

    // Fetch fresh data from RapidAPI
    try {
      const response = await axios.get('https://instagram-looter2.p.rapidapi.com/profile', {
        params: { username: page.username },
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com',
        },
        timeout: 20000,
      });

      const data = response.data;
      const edges = data?.edge_owner_to_timeline_media?.edges || [];
      console.log(`  📸 Found ${edges.length} posts from API`);

      let updated = 0;
      for (const edge of edges) {
        const node = edge.node;
        if (!node) continue;

        const externalId = node.id || node.shortcode;
        const mediaUrl = node.display_url || node.thumbnail_src;

        if (!mediaUrl) continue;

        // Check if post exists in DB
        const postResult = await client.query(
          'SELECT id, media_url FROM posts WHERE external_id = $1 AND page_id = $2',
          [externalId, page.id]
        );

        if (postResult.rows.length === 0) continue;

        const post = postResult.rows[0];

        // Skip if already has local media
        if (post.media_url && post.media_url.startsWith('/static/')) {
          continue;
        }

        // Download the image
        const localPath = await downloadMedia(mediaUrl, page.id, externalId);
        if (localPath) {
          await client.query(
            'UPDATE posts SET media_url = $1 WHERE id = $2',
            [localPath, post.id]
          );
          updated++;
          console.log(`  ✅ Updated post ${externalId}`);
        }
      }

      console.log(`  📊 Updated ${updated} posts with local media`);
    } catch (err) {
      console.error(`  ❌ Error fetching page @${page.username}: ${err.message}`);
    }

    // Small delay between pages
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  await client.end();
  console.log('\n🎉 Done!');
}

main().catch(console.error);
