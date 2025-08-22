require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const config = {
  x: {
    bearerToken: process.env.X_BEARER_TOKEN,
    username: process.env.X_USERNAME,
    baseUrl: 'https://api.x.com/2'
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    threadId: process.env.DISCORD_THREAD_ID
  },
  checkInterval: parseInt(process.env.CHECK_INTERVAL_MINUTES) || 480, // Default 8 hours
  lastTweetFile: path.join(__dirname, 'last_tweet_id.txt')
};

// Validate required environment variables
function validateConfig() {
  const required = [
    'X_BEARER_TOKEN',
    'X_USERNAME', 
    'DISCORD_WEBHOOK_URL'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease copy env.example to .env and fill in the required values.');
    process.exit(1);
  }
  
  console.log('✅ Configuration validated');
}

// Get user ID from username using X API v2
async function getUserId(username) {
  try {
    console.log(`🔍 Looking up user ID for @${username}...`);
    
    const response = await axios.get(
      `${config.x.baseUrl}/users/by/username/${username}`,
      {
        headers: {
          'Authorization': `Bearer ${config.x.bearerToken}`,
          'User-Agent': 'TweetCordBot/1.0'
        }
      }
    );
    
    if (response.data && response.data.data) {
      console.log(`✅ Found user ID: ${response.data.data.id}`);
      return response.data.data.id;
    }
    
    throw new Error('User not found');
  } catch (error) {
    console.error('❌ Error fetching user ID:', error.response?.data || error.message);
    throw error;
  }
}

// Get latest tweets from user using X API v2
async function getLatestTweets(userId, maxResults = 5) {
  try {
    console.log(`🐦 Fetching latest ${maxResults} tweets from user ${userId}...`);
    
    const response = await axios.get(
      `${config.x.baseUrl}/users/${userId}/tweets`,
      {
        headers: {
          'Authorization': `Bearer ${config.x.bearerToken}`,
          'User-Agent': 'TweetCordBot/1.0'
        },
                  params: {
            max_results: maxResults,
            exclude: 'retweets,replies', // Exclude retweets and replies
            'tweet.fields': 'created_at,author_id,public_metrics,context_annotations',
            'expansions': 'author_id',
            'user.fields': 'username,name,verified'
          }
      }
    );
    
    if (response.data && response.data.data) {
      console.log(`✅ Retrieved ${response.data.data.length} tweets`);
      return {
        tweets: response.data.data,
        users: response.data.includes?.users || []
      };
    }
    
    return { tweets: [], users: [] };
  } catch (error) {
    console.error('❌ Error fetching tweets:', error.response?.data || error.message);
    
    // Handle rate limiting - X API allows 1 request per 15 minutes for this endpoint
    if (error.response?.status === 429) {
      console.error('⚠️  Rate limit exceeded (429). Need to wait 15 minutes before next request.');
      console.error('💡 Consider increasing CHECK_INTERVAL_MINUTES to 15 or higher in your .env file');
    }
    
    throw error;
  }
}

// Send message to Discord via webhook
async function sendToDiscord(content, embed = null) {
  try {
    console.log('📤 Sending message to Discord webhook...');
    
    const payload = { content };
    if (embed) {
      payload.embeds = [embed];
    }
    
    // Add thread_id parameter if specified
    const webhookUrl = new URL(config.discord.webhookUrl);
    if (config.discord.threadId) {
      webhookUrl.searchParams.set('thread_id', config.discord.threadId);
    }
    
    const response = await axios.post(webhookUrl.toString(), payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TweetCordBot/1.0'
      }
    });
    
    console.log('✅ Message sent to Discord successfully');
    return response.data;
  } catch (error) {
    console.error('❌ Error sending to Discord:', error.response?.data || error.message);
    throw error;
  }
}

// Create Discord embed for tweet
function createTweetEmbed(tweet, user) {
  const tweetUrl = `https://x.com/${user.username}/status/${tweet.id}`;
  
  return {
    color: 0x1DA1F2, // Twitter blue
    author: {
      name: `${user.name} (@${user.username})${user.verified ? ' ✓' : ''}`,
      url: `https://x.com/${user.username}`,
      icon_url: user.profile_image_url || 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png'
    },
    description: tweet.text,
    fields: [
      {
        name: '📊 Engagement',
        value: `👍 ${tweet.public_metrics?.like_count || 0} | 🔄 ${tweet.public_metrics?.retweet_count || 0} | 💬 ${tweet.public_metrics?.reply_count || 0}`,
        inline: true
      }
    ],
    footer: {
      text: 'X (formerly Twitter)',
      icon_url: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png'
    },
    timestamp: tweet.created_at,
    url: tweetUrl
  };
}

// Load last processed tweet ID
async function getLastTweetId() {
  try {
    const data = await fs.readFile(config.lastTweetFile, 'utf8');
    return data.trim();
  } catch (error) {
    // File doesn't exist yet
    return null;
  }
}

// Save last processed tweet ID
async function saveLastTweetId(tweetId) {
  try {
    await fs.writeFile(config.lastTweetFile, tweetId, 'utf8');
    console.log(`💾 Saved last tweet ID: ${tweetId}`);
  } catch (error) {
    console.error('❌ Error saving last tweet ID:', error.message);
  }
}

// Main function to check for new tweets and send to Discord
async function checkAndSendTweets() {
  try {
    console.log('\n🚀 Starting tweet check...');
    console.log(`⏰ ${new Date().toISOString()}`);
    
    // Get user ID
    const userId = await getUserId(config.x.username);
    
    // Get latest tweets
    const { tweets, users } = await getLatestTweets(userId, 5);
    
    if (tweets.length === 0) {
      console.log('📭 No tweets found');
      return;
    }
    
    // Get user info
    const user = users.find(u => u.id === userId) || { 
      username: config.x.username, 
      name: config.x.username,
      verified: false 
    };
    
    // Get last processed tweet ID
    const lastTweetId = await getLastTweetId();
    
    // Find new tweets (tweets are returned in reverse chronological order)
    let newTweets = tweets;
    if (lastTweetId) {
      const lastTweetIndex = tweets.findIndex(tweet => tweet.id === lastTweetId);
      if (lastTweetIndex !== -1) {
        newTweets = tweets.slice(0, lastTweetIndex);
      }
    }
    
    if (newTweets.length === 0) {
      console.log('📭 No new tweets since last check');
      return;
    }
    
    console.log(`🆕 Found ${newTweets.length} new tweet(s)`);
    
    // Process new tweets (reverse order to send oldest first)
    for (const tweet of newTweets.reverse()) {
      console.log(`📝 Processing tweet: ${tweet.id}`);
      
      const embed = createTweetEmbed(tweet, user);
      const content = `🐦 **New post from @${user.username}**`;
      
      await sendToDiscord(content, embed);
      
      // Add small delay between messages
      if (newTweets.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Save the latest tweet ID
    await saveLastTweetId(tweets[0].id);
    
    console.log('✅ Tweet check completed successfully');
    
  } catch (error) {
    console.error('❌ Error in checkAndSendTweets:', error.message);
    
    // Send error notification to Discord (optional)
    try {
      await sendToDiscord(`⚠️ **Bot Error**: ${error.message}`);
    } catch (discordError) {
      console.error('❌ Failed to send error notification to Discord');
    }
  }
}

// Initialize and start the bot
async function init() {
  console.log('🤖 TweetCord Bot Starting...');
  console.log('=' .repeat(50));
  
  // Validate configuration
  validateConfig();
  
  console.log(`📋 Configuration:`);
  console.log(`   - X Username: @${config.x.username}`);
  console.log(`   - Discord Webhook: ${config.discord.webhookUrl ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   - Discord Thread: ${config.discord.threadId || 'N/A (posts to channel)'}`);
  console.log(`   - Check Interval: ${config.checkInterval} minutes`);
  console.log('');
  
  // Test connection by running once
  console.log('🧪 Running initial test...');
  await checkAndSendTweets();
  
  // Schedule recurring checks
  const cronExpression = `*/${config.checkInterval} * * * *`;
  console.log(`⏰ Scheduling checks every ${config.checkInterval} minutes`);
  console.log(`   Cron expression: ${cronExpression}`);
  
  cron.schedule(cronExpression, () => {
    checkAndSendTweets();
  });
  
  console.log('✅ Bot is running! Press Ctrl+C to stop.');
  console.log('=' .repeat(50));
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down TweetCord Bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down TweetCord Bot...');
  process.exit(0);
});

// Start the bot
if (require.main === module) {
  init().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  checkAndSendTweets,
  getUserId,
  getLatestTweets,
  sendToDiscord
};
