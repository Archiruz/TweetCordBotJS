import axios from 'axios';
import type { Tweet, TwitterUser } from './twitterClient';

export interface DiscordConfig {
  webhookUrl: string;
  threadId?: string;
}

export interface DiscordEmbed {
  color?: number;
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  description?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
    icon_url?: string;
  };
  timestamp?: string;
  url?: string;
}

export class DiscordClient {
  private config: DiscordConfig;

  constructor(config: DiscordConfig) {
    this.config = config;
  }

  async sendMessage(content: string, embed?: DiscordEmbed): Promise<void> {
    try {
      console.log('📤 Sending message to Discord webhook...');
      
      const payload: any = { content };
      if (embed) {
        payload.embeds = [embed];
      }
      
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

  createTweetEmbed(tweet: Tweet, user: TwitterUser): DiscordEmbed {
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

  async sendTweet(tweet: Tweet, user: TwitterUser): Promise<void> {
    const embed = this.createTweetEmbed(tweet, user);
    const content = `🐦 **New post from @${user.username}**`;
    await this.sendMessage(content, embed);
  }
}


