import axios from 'axios';

export interface TwitterConfig {
  bearerToken: string;
  username: string;
}

export interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
  attachments?: {
    media_keys?: string[];
  };
}

export interface Media {
  media_key: string;
  type: 'photo' | 'video' | 'animated_gif';
  url?: string;
  preview_image_url?: string;
  width?: number;
  height?: number;
}

export interface TwitterUser {
  id: string;
  username: string;
  name: string;
  verified?: boolean;
  profile_image_url?: string;
}

export class TwitterClient {
  private config: TwitterConfig;
  private baseUrl = 'https://api.x.com/2';

  constructor(config: TwitterConfig) {
    this.config = config;
  }

  async getUserId(username: string): Promise<string> {
    try {
      console.log(`🔍 Looking up user ID for @${username}...`);
      
      const response = await axios.get(
        `${this.baseUrl}/users/by/username/${username}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.bearerToken}`,
            'User-Agent': 'TweetCordBot/1.0'
          }
        }
      );
      
      if (response.data && response.data.data) {
        console.log(`✅ Found user ID: ${response.data.data.id}`);
        return response.data.data.id;
      }
      
      throw new Error('User not found');
    } catch (error: any) {
      console.error('❌ Error fetching user ID:', error.response?.data || error.message);
      throw error;
    }
  }

  async getLatestTweets(userId: string, maxResults: number = 5): Promise<{ tweets: Tweet[], users: TwitterUser[], media?: Media[] }> {
    try {
      console.log(`🐦 Fetching latest ${maxResults} tweets from user ${userId}...`);
      
      const response = await axios.get(
        `${this.baseUrl}/users/${userId}/tweets`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.bearerToken}`,
            'User-Agent': 'TweetCordBot/1.0'
          },
          params: {
            max_results: maxResults,
            exclude: 'retweets,replies', // Exclude retweets and replies
            'tweet.fields': 'created_at,author_id,public_metrics,context_annotations,attachments',
            'expansions': 'author_id,attachments.media_keys',
            'user.fields': 'username,name,verified,profile_image_url',
            'media.fields': 'media_key,type,url,preview_image_url,width,height'
          }
        }
      );
      
      if (response.data && response.data.data) {
        console.log(`✅ Retrieved ${response.data.data.length} tweets`);
        return {
          tweets: response.data.data,
          users: response.data.includes?.users || [],
          media: response.data.includes?.media || []
        };
      }
      
      return { tweets: [], users: [], media: [] };
    } catch (error: any) {
      console.error('❌ Error fetching tweets:', error.response?.data || error.message);
      
      // Handle rate limiting - X API allows 1 request per 15 minutes for this endpoint
      if (error.response?.status === 429) {
        console.error('⚠️  Rate limit exceeded (429). Need to wait at least 15 minutes before next request.');
        // In Trigger.dev, we'll handle this by scheduling the next run appropriately
        // rather than sleeping here
      }
      
      throw error;
    }
  }

  async getLatestTweet(userId: string): Promise<{ tweet: Tweet | null, media: Media[] }> {
    try {
      const { tweets, media } = await this.getLatestTweets(userId, 1);
      return { 
        tweet: tweets.length > 0 ? tweets[0] : null,
        media: media || []
      };
    } catch (error) {
      throw error;
    }
  }
}
