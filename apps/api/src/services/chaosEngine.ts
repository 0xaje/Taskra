import { redis } from '../config/redis';
import { RealtimeService } from './realtime';

export class ChaosEngine {
  private static readonly VOLATILITY_KEY = 'chaos:volatility:index';

  public static async getVolatilityIndex(): Promise<number> {
    const val = await redis.get(this.VOLATILITY_KEY);
    if (!val) {
      await this.setVolatilityIndex(25); // default 25% volatility
      return 25;
    }
    return parseInt(val, 10);
  }

  public static async setVolatilityIndex(index: number): Promise<void> {
    const clamped = Math.max(10, Math.min(95, index));
    await redis.set(this.VOLATILITY_KEY, clamped.toString());
  }

  /**
   * Applies the volatility index onto task rewards, bid competition, validator strictness, etc.
   */
  public static async applyChaos(realtime: RealtimeService) {
    const current = await this.getVolatilityIndex();
    
    // Time-based slight drift every tick cycle:
    // 5% chance to have a major volatility surge!
    let nextVal = current;
    const rand = Math.random();
    if (rand < 0.06) {
      nextVal = Math.min(95, current + Math.floor(Math.random() * 25 + 15)); // Volatility surge!
      await realtime.publishLogNew({
        time: new Date().toLocaleTimeString(),
        text: `⚡ [Market Chaos] Flash Volatility surge triggered! Market Volatility Index spiked to ${nextVal}%!`,
        type: 'error'
      });
    } else if (rand < 0.50) {
      const drift = Math.floor(Math.random() * 8) - 4; // -4% to +3%
      nextVal = Math.max(10, Math.min(95, current + drift));
    }

    await this.setVolatilityIndex(nextVal);
    
    // Broadcast chaos state to frontend
    await realtime.publishMarketVolatility(nextVal);
  }

  /**
   * Event-driven: Spikes volatility index when critical blockchain occurrences happen
   */
  public static async triggerBlockchainDisruptEvent(eventType: 'SLASH' | 'DISPUTE' | 'BANKRUPTCY', realtime: RealtimeService) {
    const current = await this.getVolatilityIndex();
    let increase = 15;
    let desc = '';

    if (eventType === 'SLASH') {
      increase = 20;
      desc = 'Agent Slashed';
    } else if (eventType === 'DISPUTE') {
      increase = 30;
      desc = 'Validator Escrow Dispute Raised';
    } else if (eventType === 'BANKRUPTCY') {
      increase = 25;
      desc = 'AI Agent Bankrupted';
    }

    const nextVal = Math.min(95, current + increase);
    await this.setVolatilityIndex(nextVal);
    await realtime.publishMarketVolatility(nextVal);

    await realtime.publishLogNew({
      time: new Date().toLocaleTimeString(),
      text: `💥 [Market Chaos] Event-driven volatility shock: "${desc}" triggered! Volatility Index rose by +${increase}% (Current: ${nextVal}%)`,
      type: 'error'
    });
  }

  /**
   * Modifies task reward values dynamically based on current market chaos.
   * If chaos is high, reward values fluctuate wildly (up to +/- 45% from base reward!).
   */
  public static async getModifiedReward(baseReward: number): Promise<number> {
    const vol = await this.getVolatilityIndex();
    const multiplier = (vol / 100) * 0.45; // Max 45% fluctuation
    const fluctuationPercent = (Math.random() * multiplier * 2) - multiplier; // -multiplier to +multiplier
    return parseFloat((baseReward * (1 + fluctuationPercent)).toFixed(4));
  }

  /**
   * High volatility increases validator strictness, raising the likelihood of a disagreement.
   */
  public static async getValidatorDisagreementModifier(): Promise<number> {
    const vol = await this.getVolatilityIndex();
    // High volatility increases dispute probability by up to 30%!
    return (vol / 100) * 0.30;
  }
}
