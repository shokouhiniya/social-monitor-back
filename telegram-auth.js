const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');

const apiId = parseInt(process.env.TELEGRAM_API_ID || '36590241');
const apiHash = process.env.TELEGRAM_API_HASH || 'bfc548a42c4b6826b7c993c54d5a7b44';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

(async () => {
  console.log('🔐 Telegram Authentication Script');
  console.log('==================================');
  console.log('⚠️  Make sure your VPN is OFF before running this script!');
  console.log('');

  const session = new StringSession('');
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await ask('📱 Enter your phone number (with country code, e.g. +98...): '),
    password: async () => await ask('🔑 Enter your 2FA password (if any, press Enter to skip): '),
    phoneCode: async () => await ask('📨 Enter the code you received: '),
    onError: (err) => console.error('❌ Error:', err),
  });

  console.log('');
  console.log('✅ Successfully authenticated!');
  console.log('');

  const sessionString = client.session.save();
  console.log('📋 Your session string (copy this):');
  console.log('');
  console.log(sessionString);
  console.log('');
  console.log('👉 Add this to your .env file as:');
  console.log(`TELEGRAM_SESSION=${sessionString}`);
  console.log('');

  rl.close();
  await client.disconnect();
  process.exit(0);
})();
