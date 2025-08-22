import { task, schedules, logger } from "@trigger.dev/sdk/v3";
import { TwitterClient } from "../lib/twitterClient";
import { DiscordClient } from "../lib/discordClient";
import { MemoryStorage } from "../lib/storage";

// Configuration interface
interface TaskConfig {
  xBearerToken: string;
  xUsername: string;
  discordWebhookUrl: string;
  discordThreadId?: string;
}

// Validate environment variables
function validateConfig(): TaskConfig {
  const required = ['X_BEARER_TOKEN', 'X_USERNAME', 'DISCORD_WEBHOOK_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return {
    xBearerToken: process.env.X_BEARER_TOKEN!,
    xUsername: process.env.X_USERNAME!,
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL!,
    discordThreadId: process.env.DISCORD_THREAD_ID
  };
}

// Main tweet monitoring task
export const monitorTweets = task({
  id: "monitor-tweets",
  maxDuration: 300, // 5 minutes max execution time
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: { manualTrigger?: boolean }) => {
    logger.log('🚀 Starting tweet monitoring task...', { timestamp: new Date().toISOString() });
    
    try {
      // Validate configuration
      const config = validateConfig();
      logger.log('✅ Configuration validated');
      
      // Initialize clients
      const twitterClient = new TwitterClient({
        bearerToken: config.xBearerToken,
        username: config.xUsername
      });
      
      const discordClient = new DiscordClient({
        webhookUrl: config.discordWebhookUrl,
        threadId: config.discordThreadId
      });
      
      const storage = new MemoryStorage(); // Using memory storage for simplicity
      
      logger.log('📋 Configuration', {
        username: config.xUsername,
        discordConfigured: !!config.discordWebhookUrl,
        threadId: config.discordThreadId || 'N/A (posts to channel)'
      });
      
      // Get user ID
      const userId = await twitterClient.getUserId(config.xUsername);
      
      // Get latest 5 tweets (excluding retweets and replies)
      const { tweets, users } = await twitterClient.getLatestTweets(userId, 5);
      
      if (tweets.length === 0) {
        logger.log('📭 No tweets found');
        return { status: 'success', message: 'No tweets found', tweetsProcessed: 0 };
      }
      
      logger.log('🐦 Latest tweets found', { 
        tweetCount: tweets.length,
        latestTweetId: tweets[0].id
      });
      
      // Get user info
      const user = users.find(u => u.id === userId) || { 
        id: userId,
        username: config.xUsername, 
        name: config.xUsername,
        verified: false 
      };
      
      // Get last processed tweet ID
      const lastTweetId = await storage.getLastTweetId();
      
      // Find new tweets (tweets are returned in reverse chronological order)
      let newTweets = tweets;
      if (lastTweetId) {
        const lastTweetIndex = tweets.findIndex(tweet => tweet.id === lastTweetId);
        if (lastTweetIndex !== -1) {
          newTweets = tweets.slice(0, lastTweetIndex);
        }
      }
      
      if (newTweets.length === 0) {
        logger.log('📭 No new tweets since last check', {
          latestTweetId: tweets[0].id,
          lastProcessedId: lastTweetId || 'none'
        });
        return { 
          status: 'success', 
          message: 'No new tweets since last check', 
          tweetsProcessed: 0,
          latestTweetId: tweets[0].id
        };
      }
      
      logger.log('🆕 New tweets detected!', { 
        newTweetCount: newTweets.length,
        lastProcessedId: lastTweetId || 'none'
      });
      
      // Process new tweets (reverse order to send oldest first)
      let processedCount = 0;
      for (const tweet of newTweets.reverse()) {
        logger.log('📝 Processing tweet', { tweetId: tweet.id });
        
        try {
          await discordClient.sendTweet(tweet, user);
          processedCount++;
          
          // Add small delay between messages
          if (newTweets.length > 1 && processedCount < newTweets.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (discordError) {
          logger.error('❌ Error sending tweet to Discord', { 
            error: discordError,
            tweetId: tweet.id 
          });
          // Continue with other tweets
        }
      }
      
      // Save the latest tweet ID
      if (processedCount > 0) {
        await storage.saveLastTweetId(tweets[0].id);
      }
      
      logger.log('✅ Tweet monitoring completed', { 
        processedCount,
        latestTweetId: tweets[0].id
      });
      
      return { 
        status: 'success', 
        message: `Processed ${processedCount} new tweets`, 
        tweetsProcessed: processedCount,
        latestTweetId: tweets[0].id
      };
      
    } catch (error: any) {
      logger.error('❌ Error in tweet monitoring task', { error: error.message });
      
      // Handle rate limiting specifically
      if (error.response?.status === 429) {
        logger.log('⏳ Rate limit hit - will retry in next scheduled run (15 minutes)');
        return { 
          status: 'rate_limited', 
          message: 'Rate limit exceeded - will retry in 15 minutes',
          tweetsProcessed: 0
        };
      }
      
      // Try to send error notification to Discord
      try {
        const config = validateConfig();
        const discordClient = new DiscordClient({
          webhookUrl: config.discordWebhookUrl,
          threadId: config.discordThreadId
        });
        
        await discordClient.sendMessage(`⚠️ **TweetCord Bot Error**: ${error.message}`);
      } catch (discordError) {
        logger.error('❌ Failed to send error notification to Discord');
      }
      
      throw error; // Re-throw to mark task as failed
    }
  },
});

// Scheduled task that runs every 8 hours (optimized for free tier)
export const scheduledTweetMonitor = schedules.task({
  id: "scheduled-tweet-monitor",
  // Every 8 hours = 3 times per day = ~90 requests per month (within free tier limit)
  cron: "0 */8 * * *", // Every 8 hours
  maxDuration: 300, // 5 minutes max execution time
  run: async (payload, { ctx }) => {
    logger.log("Scheduled tweet monitor triggered", { payload });
    return await monitorTweets.trigger({ manualTrigger: false });
  },
});

// Manual trigger task for testing
export const manualTweetCheck = task({
  id: "manual-tweet-check",
  maxDuration: 300, // 5 minutes max execution time
  run: async () => {
    logger.log('🧪 Manual tweet check triggered');
    return await monitorTweets.trigger({ manualTrigger: true });
  },
});
