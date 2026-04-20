const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');

const apiId = 36590241;
const apiHash = 'bfc548a42c4b6826b7c993c54d5a7b44';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function authenticate() {
  console.log('🔐 Telegram Authentication Script');
  console.log('================================\n');

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => {
      const phone = await question('📱 Enter your phone number (with country code, e.g., +989123456789): ');
      return phone;
    },
    password: async () => {
      const password = await question('🔒 Enter your 2FA password (if enabled): ');
      return password;
    },
    phoneCode: async () => {
      const code = await question('📲 Enter the code you received: ');
      return code;
    },
    onError: (err) => {
      console.error('❌ Error:', err);
    },
  });

  console.log('\n✅ Authentication successful!');
  console.log('\n📋 Your session string:');
  console.log('================================');
  console.log(client.session.save());
  console.log('================================\n');
  console.log('📝 Copy the session string above and add it to your .env file:');
  console.log('   TELEGRAM_SESSION=<paste_session_string_here>\n');

  rl.close();
  process.exit(0);
}

authenticate().catch((error) => {
  console.error('❌ Authentication failed:', error);
  rl.close();
  process.exit(1);
});
