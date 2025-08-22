# TweetCord Bot

A Node.js bot that automatically forwards X (formerly Twitter) posts from a specific user to a Discord thread. Designed to work with the X API v2 free tier limitations.

## Features

- ✅ **X API v2 Integration** - Uses the latest Twitter API endpoints
- ✅ **Free Tier Optimized** - Respects the 100 requests/month limit
- ✅ **Rich Discord Embeds** - Beautiful formatted messages with engagement metrics
- ✅ **Smart Scheduling** - Configurable check intervals (default: 8 hours)
- ✅ **Duplicate Prevention** - Tracks last processed tweet to avoid duplicates
- ✅ **Error Handling** - Robust error handling with Discord notifications
- ✅ **Rate Limit Management** - Handles API rate limits gracefully

## Prerequisites

1. **X (Twitter) Developer Account**
   - Apply at [developer.x.com](https://developer.x.com)
   - Create an app to get Bearer Token
   - Free tier provides 100 requests/month

2. **Discord Webhook**
   - Go to your Discord channel settings
   - Navigate to Integrations → Webhooks
   - Create a new webhook and copy the URL
   - Enable Developer Mode in Discord to get Thread IDs (optional)

3. **Node.js**
   - Version 14 or higher required

## Installation

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example file
   cp env.example .env
   
   # Edit .env with your actual values
   ```

## Configuration

Edit the `.env` file with your credentials:

```env
# X (Twitter) API Configuration
X_BEARER_TOKEN=your_x_api_bearer_token_here
X_USERNAME=username_to_monitor

# Discord Webhook Configuration  
DISCORD_WEBHOOK_URL=your_discord_webhook_url_here
DISCORD_THREAD_ID=your_discord_thread_id_here

# Optional: Check interval in minutes (default: 480 = 8 hours)
CHECK_INTERVAL_MINUTES=480
```

### Getting Your Credentials

#### X API Bearer Token
1. Go to [developer.x.com](https://developer.x.com/en/portal/dashboard)
2. Create a new app or select existing one
3. Go to "Keys and Tokens" tab
4. Generate/copy the "Bearer Token"

#### Discord Webhook URL & Thread ID
1. **Create Webhook:**
   - Go to your Discord channel
   - Click the gear icon (Channel Settings)
   - Go to "Integrations" → "Webhooks"
   - Click "New Webhook"
   - Customize name/avatar if desired
   - Copy the "Webhook URL"

2. **Get Thread ID (Optional):**
   - Enable Developer Mode in Discord settings
   - Right-click on the thread and select "Copy Thread ID"
   - If no thread ID is provided, messages will post to the main channel

## Deployment Options

### Option 1: Trigger.dev (Recommended for Production)

This project is optimized for deployment on [Trigger.dev](https://trigger.dev), which provides a robust serverless platform for scheduled tasks.

#### Setup Trigger.dev Deployment

1. **Install Trigger.dev CLI**
   ```bash
   npm install
   ```

2. **Initialize Trigger.dev Project**
   ```bash
   npx trigger.dev@latest init
   ```

3. **Set Environment Variables in Trigger.dev Dashboard**
   - Go to your project dashboard on [trigger.dev](https://trigger.dev)
   - Navigate to Environment Variables section
   - Add the following variables:
     - `X_BEARER_TOKEN`: Your X API bearer token
     - `X_USERNAME`: Username to monitor (without @)
     - `DISCORD_WEBHOOK_URL`: Your Discord webhook URL
     - `DISCORD_THREAD_ID`: Optional thread ID

4. **Test Locally**
   ```bash
   npm run dev
   ```

5. **Deploy to Production**
   ```bash
   npm run deploy
   ```

#### Trigger.dev Features
- ✅ **Automatic Scheduling**: Runs every 8 hours (optimized for free tier)
- ✅ **Error Handling**: Built-in retries and error notifications
- ✅ **Monitoring**: Dashboard for viewing task runs and logs
- ✅ **Scalability**: Serverless execution with automatic scaling
- ✅ **Free Tier**: Generous free tier for personal projects

### Option 2: Local/Server Deployment

For local development or server deployment:

```bash
npm start
```

The bot will:
1. ✅ Validate your configuration
2. 🧪 Run an initial test
3. ⏰ Schedule regular checks based on your interval
4. 📤 Send new tweets to your Discord thread

## Free Tier Optimization

The X API v2 free tier has strict limitations:
- **100 requests per month**
- **Rate limiting applies**

This bot is optimized for these constraints:
- Default check interval: **8 hours** (≈90 requests/month)
- Fetches only **5 most recent tweets** per check
- **Smart duplicate detection** to avoid reprocessing
- **Graceful error handling** for rate limits

### Recommended Schedule
- **Every 8 hours**: ~90 requests/month ✅
- **Every 6 hours**: ~120 requests/month ⚠️ (may exceed limit)
- **Every 12 hours**: ~60 requests/month ✅ (more conservative)

## Discord Message Format

The bot sends rich embeds with:
- 👤 **User info** (name, username, verification status)
- 📝 **Tweet content**
- 📊 **Engagement metrics** (likes, retweets, replies)
- 🔗 **Direct link** to original tweet
- ⏰ **Timestamp**

## Error Handling

The bot handles various error scenarios:
- **Rate limiting**: Waits and retries appropriately
- **Network issues**: Logs errors and continues
- **Invalid credentials**: Clear error messages
- **Missing tweets**: Graceful handling of empty responses

Errors are logged to console and optionally sent to Discord.

## File Structure

```
TweetCordBotJS/
├── src/
│   ├── trigger/
│   │   └── tweetMonitor.ts    # Trigger.dev task definitions
│   └── lib/
│       ├── twitterClient.ts   # X API client
│       ├── discordClient.ts   # Discord webhook client
│       └── storage.ts         # Storage interface
├── index.js                   # Legacy standalone script
├── package.json               # Dependencies and scripts
├── trigger.config.ts          # Trigger.dev configuration
├── tsconfig.json              # TypeScript configuration
├── env.example                # Environment variables template
├── README.md                  # This documentation
└── last_tweet_id.txt          # Tracks last processed tweet (local only)
```

## Troubleshooting

### Common Issues

**"Missing required environment variables"**
- Ensure `.env` file exists and contains all required values
- Check that variable names match exactly

**"User not found"**
- Verify the X username is correct (without @ symbol)
- Ensure the user's profile is public

**"Unauthorized" (401 error)**
- Check your X Bearer Token is valid
- Ensure your X app has the necessary permissions

**"Forbidden" (403 error)**
- Verify your Discord webhook URL is correct and valid
- Check that the webhook hasn't been deleted
- Ensure Thread ID is correct (if using threads)

**"Too Many Requests" (429 error)**
- You've hit the rate limit
- Wait for the rate limit to reset (X API resets monthly)
- The scheduled task is optimized to stay within limits

### Trigger.dev Specific Issues

**"Task not found" or deployment issues**
- Ensure you've run `npx trigger.dev@latest init`
- Check that `trigger.config.ts` is properly configured
- Verify your project is connected to the correct Trigger.dev account

**"Environment variables not found"**
- Set environment variables in the Trigger.dev dashboard
- Variables set locally won't be available in production
- Use the exact variable names from `env.example`

**"Task timeout" errors**
- The task has built-in retries and error handling
- Check the Trigger.dev dashboard for detailed logs
- Rate limits may cause temporary failures (this is normal)

### Rate Limit Calculator

To calculate your monthly usage:
```
Monthly Requests = (60 * 24 * 30) / CHECK_INTERVAL_MINUTES
```

Examples:
- 480 minutes (8 hours): 90 requests/month ✅
- 360 minutes (6 hours): 120 requests/month ⚠️
- 720 minutes (12 hours): 60 requests/month ✅

## Contributing

Feel free to submit issues and enhancement requests!

## License

ISC License - see package.json for details.

---

**Happy tweeting! 🐦➡️💬**
