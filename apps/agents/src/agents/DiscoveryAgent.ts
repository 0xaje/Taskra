import { queues } from '../queues';
import { groqService } from '../ai';

export class DiscoveryAgent {
  async process() {
    console.log('[DiscoveryAgent] Scanning blockchain and system events...');
    const eventsFound = Math.random() > 0.5;
    
    if (eventsFound) {
      console.log('[DiscoveryAgent] Found interesting events. Pushing to TaskGeneratorAgent.');
      const analysis = await groqService.generateText(
        "Summarize this abstract blockchain event: '0xabc... transfer 10 ETH'. What kind of task could we generate from it?",
        "You are a Discovery AI."
      );
      
      await queues.taskGeneration.add('generate-task', {
        eventData: 'Sample on-chain event',
        analysis
      });
    } else {
      console.log('[DiscoveryAgent] No new events.');
    }
  }
}
