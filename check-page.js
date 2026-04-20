const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'sadegh',
  user: 'postgres',
  password: 'B0b_Dylan',
});

async function checkPage() {
  try {
    await client.connect();
    const res = await client.query(
      'SELECT id, name, username, bio, followers_count, following_count, profile_image_url FROM pages WHERE username = $1',
      ['mb_ghalibaf']
    );
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkPage();
