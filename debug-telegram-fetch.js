require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

async function debugTelegramFetch() {
  const apiId = parseInt(process.env.TELEGRAM_API_ID || '36590241');
  const apiHash = process.env.TELEGRAM_API_HASH || 'bfc548a42c4b6826b7c993c54d5a7b44';
  const sessionString = process.env.TELEGRAM_SESSION || '';

  if (!sessionString) {
    console.error('❌ TELEGRAM_SESSION not found in environment');
    return;
  }

  const session = new StringSession(sessionString);
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 3,
    timeout: 10000,
  });

  try {
    console.log('🔌 Connecting to Telegram...');
    console.log('⚠️  Make sure VPN is OFF!\n');
    
    await client.connect();
    console.log('✅ Connected\n');

    const username = 'farsna';
    console.log(`📡 Fetching messages from @${username}...\n`);

    // Get channel entity
    const entity = await client.getEntity(username);
    console.log(`✅ Found channel: ${entity.title}\n`);

    // Fetch messages with detailed logging
    console.log('📥 Fetching 1000 messages...');
    const messages = await client.getMessages(entity, {
      limit: 1000,
    });

    console.log(`✅ Received ${messages.length} messages\n`);

    // Analyze messages
    const keyword = 'قالیباف';
    let withKeyword = 0;
    let withoutKeyword = 0;
    const dateDistribution = {};

    messages.forEach((msg) => {
      if (!msg.message && !msg.media) return;

      const caption = msg.message || '';
      const hasKeyword = caption.toLowerCase().includes(keyword.toLowerCase());
      
      if (hasKeyword) {
        withKeyword++;
      } else {
        withoutKeyword++;
      }

      // Track date distribution
      if (msg.date) {
        const date = new Date(msg.date * 1000);
        const dateKey = date.toISOString().split('T')[0];
        if (!dateDistribution[dateKey]) {
          dateDistribution[dateKey] = { total: 0, withKeyword: 0 };
        }
        dateDistribution[dateKey].total++;
        if (hasKeyword) {
          dateDistribution[dateKey].withKeyword++;
        }
      }
    });

    console.log('📊 Analysis Results:');
    console.log(`   Total messages: ${messages.length}`);
    console.log(`   With "${keyword}": ${withKeyword}`);
    console.log(`   Without "${keyword}": ${withoutKeyword}`);
    console.log(`   Filtering rate: ${((withoutKeyword / messages.length) * 100).toFixed(1)}% filtered out\n`);

    // Show date distribution
    console.log('📅 Messages by date (last 14 days):');
    const sortedDates = Object.keys(dateDistribution).sort().reverse().slice(0, 14);
    
    sortedDates.forEach((dateKey) => {
      const stats = dateDistribution[dateKey];
      const date = new Date(dateKey);
      console.log(`   ${date.toLocaleDateString('fa-IR')}: ${stats.withKeyword} relevant / ${stats.total} total`);
    });

    // Check oldest message
    if (messages.length > 0) {
      const oldestMsg = messages[messages.length - 1];
      const oldestDate = new Date(oldestMsg.date * 1000);
      const newestMsg = messages[0];
      const newestDate = new Date(newestMsg.date * 1000);
      const daysDiff = Math.floor((newestDate - oldestDate) / (1000 * 60 * 60 * 24));
      
      console.log(`\n📌 Date Range:`);
      console.log(`   Oldest: ${oldestDate.toLocaleString('fa-IR')}`);
      console.log(`   Newest: ${newestDate.toLocaleString('fa-IR')}`);
      console.log(`   Span: ${daysDiff} days`);
      
      if (daysDiff < 7) {
        console.log(`\n⚠️  WARNING: Only ${daysDiff} days of messages!`);
        console.log(`   This suggests the Telegram API is not returning older messages.`);
        console.log(`   Possible reasons:`);
        console.log(`   1. Channel is new or was recently created`);
        console.log(`   2. API limit restrictions`);
        console.log(`   3. Messages were deleted from the channel`);
      }
    }

    // Show sample messages with and without keyword
    console.log(`\n✅ Sample messages WITH "${keyword}":`);
    const samplesWithKeyword = messages
      .filter(m => m.message && m.message.toLowerCase().includes(keyword.toLowerCase()))
      .slice(0, 3);
    
    samplesWithKeyword.forEach((msg, idx) => {
      const date = new Date(msg.date * 1000);
      const preview = msg.message.substring(0, 80);
      console.log(`   ${idx + 1}. [${date.toLocaleDateString('fa-IR')}] ${preview}...`);
    });

    console.log(`\n❌ Sample messages WITHOUT "${keyword}":`);
    const samplesWithoutKeyword = messages
      .filter(m => m.message && !m.message.toLowerCase().includes(keyword.toLowerCase()))
      .slice(0, 3);
    
    samplesWithoutKeyword.forEach((msg, idx) => {
      const date = new Date(msg.date * 1000);
      const preview = msg.message.substring(0, 80);
      console.log(`   ${idx + 1}. [${date.toLocaleDateString('fa-IR')}] ${preview}...`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('FLOOD')) {
      console.log('\n⚠️  Rate limit hit. Wait a few minutes and try again.');
    }
  } finally {
    await client.disconnect();
    console.log('\n👋 Disconnected');
  }
}

debugTelegramFetch();
