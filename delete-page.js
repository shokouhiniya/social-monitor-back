// Quick script to delete a page and its posts
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'sadegh',
  user: 'postgres',
  password: 'B0b_Dylan',
});

async function deletePage(username) {
  try {
    await client.connect();
    console.log('Connected to database');

    // Delete posts first (foreign key constraint)
    const deletePostsResult = await client.query(
      'DELETE FROM posts WHERE page_id = (SELECT id FROM pages WHERE username = $1)',
      [username]
    );
    console.log(`Deleted ${deletePostsResult.rowCount} posts`);

    // Delete page
    const deletePageResult = await client.query(
      'DELETE FROM pages WHERE username = $1',
      [username]
    );
    console.log(`Deleted ${deletePageResult.rowCount} page(s)`);

    console.log(`✅ Successfully deleted page: ${username}`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

const username = process.argv[2] || 'mb_ghalibaf';
deletePage(username);
