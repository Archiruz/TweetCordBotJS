// Simple storage interface for tracking last processed tweet
// In Trigger.dev, you might want to use a database or external storage
// For now, we'll use a simple in-memory approach with environment variables

export interface StorageInterface {
  getLastTweetId(): Promise<string | null>;
  saveLastTweetId(tweetId: string): Promise<void>;
}

export class MemoryStorage implements StorageInterface {
  private lastTweetId: string | null = null;

  async getLastTweetId(): Promise<string | null> {
    return this.lastTweetId;
  }

  async saveLastTweetId(tweetId: string): Promise<void> {
    this.lastTweetId = tweetId;
    console.log(`💾 Saved last tweet ID: ${tweetId}`);
  }
}

// Simple file-based storage for development/testing
export class FileStorage implements StorageInterface {
  private filePath: string;

  constructor(filePath: string = './last_tweet_id.txt') {
    this.filePath = filePath;
  }

  async getLastTweetId(): Promise<string | null> {
    try {
      const fs = await import('fs').then(m => m.promises);
      const data = await fs.readFile(this.filePath, 'utf8');
      return data.trim();
    } catch (error) {
      // File doesn't exist yet
      return null;
    }
  }

  async saveLastTweetId(tweetId: string): Promise<void> {
    try {
      const fs = await import('fs').then(m => m.promises);
      await fs.writeFile(this.filePath, tweetId, 'utf8');
      console.log(`💾 Saved last tweet ID to file: ${tweetId}`);
    } catch (error) {
      console.error('❌ Error saving last tweet ID to file:', error);
    }
  }
}

// Environment variable storage (limited in serverless environments)
export class EnvStorage implements StorageInterface {
  private envKey: string;

  constructor(envKey: string = 'LAST_TWEET_ID') {
    this.envKey = envKey;
  }

  async getLastTweetId(): Promise<string | null> {
    return process.env[this.envKey] || null;
  }

  async saveLastTweetId(tweetId: string): Promise<void> {
    // Note: In Trigger.dev, you can't modify environment variables at runtime
    // This is just for logging - in production you'd use a database
    console.log(`💾 Last tweet ID: ${tweetId} (would save to database in production)`);
  }
}
