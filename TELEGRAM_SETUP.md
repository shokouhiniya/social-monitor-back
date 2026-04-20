# Telegram Integration Setup

## Prerequisites

You need a Telegram account with a phone number to authenticate.

## Step 1: Run the Authentication Script

```bash
cd social-monitor-back
node telegram-auth.js
```

## Step 2: Follow the Prompts

1. **Enter your phone number** (with country code)
   - Example: `+989123456789`

2. **Check your Telegram app** for the verification code
   - You'll receive a code in your Telegram app (not SMS)

3. **Enter the verification code** when prompted

4. **Enter your 2FA password** (if you have two-factor authentication enabled)
   - If you don't have 2FA, just press Enter

## Step 3: Copy the Session String

After successful authentication, you'll see output like:

```
✅ Authentication successful!

📋 Your session string:
================================
1AgAOMTQ5LjE1NC4xNjcuNTE6NDQzAc...
================================

📝 Copy the session string above and add it to your .env file:
   TELEGRAM_SESSION=<paste_session_string_here>
```

## Step 4: Update .env File

Open `social-monitor-back/.env` and update the `TELEGRAM_SESSION` variable:

```env
TELEGRAM_SESSION=1AgAOMTQ5LjE1NC4xNjcuNTE6NDQzAc...
```

## Step 5: Restart the Backend Server

```bash
npm run start:dev
```

You should see:
```
🔌 Connecting to Telegram...
✅ Telegram client connected
```

## Using Telegram Integration

### Sync a Telegram Channel

```bash
POST http://localhost:3000/telegram/sync
Content-Type: application/json

{
  "username": "ghalibaf",
  "messageLimit": 50
}
```

### Fetch More Messages

```bash
POST http://localhost:3000/telegram/fetch-more/:pageId
Content-Type: application/json

{
  "messageLimit": 50
}
```

### Monitor Existing Channel

```bash
POST http://localhost:3000/telegram/monitor/:pageId
```

## Troubleshooting

### "Telegram client not initialized"
- Make sure you've run `node telegram-auth.js` and added the session string to `.env`
- Restart the backend server after updating `.env`

### "Failed to connect to Telegram"
- Check your internet connection
- Verify the session string is correct in `.env`
- Try re-authenticating by running `node telegram-auth.js` again

### "PHONE_CODE_INVALID"
- Make sure you're entering the code from your Telegram app (not SMS)
- The code expires after a few minutes, request a new one if needed

## Security Notes

- **Never commit your session string** to version control
- The session string gives full access to your Telegram account
- Keep your `.env` file secure
- Consider using a dedicated Telegram account for the bot
