import axios from 'axios';
import type { Tweet, TwitterUser, Media } from './twitterClient';

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
  image?: {
    url: string;
  };
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

  createTweetEmbed(tweet: Tweet, user: TwitterUser, media: Media[] = []): DiscordEmbed {
    const tweetUrl = `https://x.com/${user.username}/status/${tweet.id}`;
    
    // Find media for this tweet
    const tweetMedia = media.filter(m => 
      tweet.attachments?.media_keys?.includes(m.media_key)
    );
    
    const embed: DiscordEmbed = {
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

    // Add the first image/video if available
    if (tweetMedia.length > 0) {
      const firstMedia = tweetMedia[0];
      
      if (firstMedia.type === 'photo' && firstMedia.url) {
        embed.image = { url: firstMedia.url };
      } else if ((firstMedia.type === 'video' || firstMedia.type === 'animated_gif') && firstMedia.preview_image_url) {
        embed.image = { url: firstMedia.preview_image_url };
        // Add a note about video content
        embed.fields?.push({
          name: '🎥 Media',
          value: firstMedia.type === 'video' ? 'Video content' : 'Animated GIF',
          inline: true
        });
      }
      
      // If there are multiple media items, add a note
      if (tweetMedia.length > 1) {
        embed.fields?.push({
          name: '📸 Additional Media',
          value: `${tweetMedia.length - 1} more item(s) - view on X`,
          inline: true
        });
      }
    }
    
    return embed;
  }

  private hasValidMedia(media: Media[]): boolean {
    return media.some(m => 
      (m.type === 'photo' && m.url) || 
      ((m.type === 'video' || m.type === 'animated_gif') && m.preview_image_url)
    );
  }

  async sendTweet(tweet: Tweet, user: TwitterUser, media: Media[] = []): Promise<void> {
    const tweetUrl = `https://x.com/${user.username}/status/${tweet.id}`;
    
    // Find media for this tweet
    const tweetMedia = media.filter(m => 
      tweet.attachments?.media_keys?.includes(m.media_key)
    );
    
    try {
      // Try to send with embed including media
      const embed = this.createTweetEmbed(tweet, user, media);
      const content = `🐦 **New post from @${user.username}**`;
      
      // Check if we have valid media to include
      if (tweetMedia.length > 0 && this.hasValidMedia(tweetMedia)) {
        console.log(`📸 Including ${tweetMedia.length} media item(s) in embed`);
      }
      
      await this.sendMessage(content, embed);
      
    } catch (embedError: any) {
      console.warn('⚠️ Embed failed, falling back to URL only', { 
        error: embedError.message,
        tweetId: tweet.id 
      });
      
      // Fallback: send just the URL (Discord may auto-embed)
      const fallbackContent = `🐦 **New post from @${user.username}**\n${tweetUrl}`;
      await this.sendMessage(fallbackContent);
    }
  }
}


