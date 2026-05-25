import { groqService } from './GroqService';
import { Prompts } from './prompts';
import { BidReasoningOutput } from './types';

export class BidReasoningEngine {
  static async evaluateTask(taskSpec: any, agentCapabilities: string[]): Promise<BidReasoningOutput> {
    const prompt = `Task Specification:
${JSON.stringify(taskSpec)}

Agent Capabilities:
${agentCapabilities.join(', ')}

Assess if this agent should bid on this task. Output JSON:
{
  "confidenceScore": <0-100>,
  "estimatedCost": <number>,
  "shouldBid": <boolean>,
  "reasoning": "string explaining the decision"
}`;

    return groqService.generateJSON<BidReasoningOutput>(prompt, Prompts.BID_REASONING_SYSTEM, 'mixtral-8x7b-32768');
  }
}
