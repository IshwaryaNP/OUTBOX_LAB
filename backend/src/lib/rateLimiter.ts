import { redisConnection } from './redis.js';

export class RateLimiter {
  /**
   * Generates a Redis key for an hourly window per sender
   */
  private static getKey(senderId: string, timestamp: number = Date.now()): string {
    const date = new Date(timestamp);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    return `ratelimit:sender:${senderId}:${yyyy}${mm}${dd}${hh}`;
  }

  /**
   * Checks if an email can be sent in the current hour and increments the counter atomically
   */
  static async checkAndIncrement(senderId: string, maxPerHour: number): Promise<{
    allowed: boolean;
    currentCount: number;
    resetAt: Date;
    msUntilReset: number;
  }> {
    const key = this.getKey(senderId);
    const now = new Date();
    
    // Next hour start (UTC)
    const nextHour = new Date(now);
    nextHour.setUTCMinutes(0, 0, 0);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    const msUntilReset = Math.max(1000, nextHour.getTime() - now.getTime());
    const ttlSeconds = Math.ceil(msUntilReset / 1000) + 120; // Extra 2 mins buffer

    // Atomic increment
    const count = await redisConnection.incr(key);
    if (count === 1) {
      // Set expiration when key is first created
      await redisConnection.expire(key, ttlSeconds);
    }

    if (count > maxPerHour) {
      return {
        allowed: false,
        currentCount: count,
        resetAt: nextHour,
        msUntilReset,
      };
    }

    return {
      allowed: true,
      currentCount: count,
      resetAt: nextHour,
      msUntilReset,
    };
  }

  /**
   * Check if a rate-limit alert was recently sent to Slack to avoid spamming
   */
  static async shouldNotifySlack(senderId: string): Promise<boolean> {
    const notifyKey = `ratelimit:slack_notified:${senderId}:${this.getKey(senderId)}`;
    const result = await redisConnection.set(notifyKey, '1', 'EX', 3600, 'NX');
    return result === 'OK';
  }
}

