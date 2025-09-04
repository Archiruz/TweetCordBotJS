import axios from 'axios';
import type { Tweet, TwitterUser, Media } from './twitterClient';

export interface DiscordConfig {
  webhookUrl: string;
  threadId?: string;
}

export class DiscordClient {
  private config: DiscordConfig;

  constructor(config: DiscordConfig) {
    this.config = config;
  }

  async sendMessage(content: string): Promise<void> {
    try {
      console.log('📤 Sending message to Discord webhook...');
      
      const payload = { content };
      
      // Add thread_id parameter if specified
      const webhookUrl = new URL(this.config.webhookUrl);
      if (this.config.threadId) {
        webhookUrl.searchParams.set('thread_id', this.config.threadId);
      }
      
      await axios.post(webhookUrl.toString(), payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TweetCordBot/1.0'
        }
      });
      
      console.log('✅ Message sent to Discord successfully');
    } catch (error: any) {
      console.error('❌ Error sending to Discord:', error.response?.data || error.message);
      throw error;
    }
  }


  async sendTweet(tweet: Tweet, user: TwitterUser, media: Media[] = []): Promise<void> {
    // Use fxtwitter URL for automatic rich embeds with media support
    const fxTwitterUrl = `https://fxtwitter.com/${user.username}/status/${tweet.id}`;
    const content = `🐦 **New post from @${user.username}**\n${fxTwitterUrl}`;
    
    console.log(`📤 Sending fxtwitter URL for tweet: ${tweet.id}`);
    await this.sendMessage(content);
  }
}


