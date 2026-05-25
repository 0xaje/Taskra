import { queues } from '../queues';
import { BidReasoningEngine } from '../ai';

export class BiddingAgent {
  async process(jobData: any) {
    const { task } = jobData;
    console.log(`[BiddingAgent] Evaluating profitability for task: ${task.title}`);
    
    const capabilities = ["Smart Contract Auditing", "Data Analysis", "On-chain Execution"];
    const bidResult = await BidReasoningEngine.evaluateTask(task, capabilities);
    
    if (bidResult.shouldBid && bidResult.confidenceScore > 50) {
      console.log(`[BiddingAgent] Bidding on task with confidence ${bidResult.confidenceScore}. Reasoning: ${bidResult.reasoning}`);
      await queues.execution.add('execute-task', { task, bidAmount: task.reward * 0.9 });
    } else {
      console.log(`[BiddingAgent] Skipped task. Reasoning: ${bidResult.reasoning}`);
    }
  }
}
