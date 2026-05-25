import { queues } from '../queues';
import { TaskReasoningEngine } from '../ai';

export class TaskGeneratorAgent {
  async process(jobData: any) {
    console.log('[TaskGeneratorAgent] Generating economic task from event');
    
    const parsedSpec = await TaskReasoningEngine.generateTaskFromEvent(jobData.analysis);
    console.log('[TaskGeneratorAgent] Created task:', parsedSpec);
    
    await queues.bidding.add('evaluate-bid', { task: parsedSpec });
  }
}
