import { queues } from '../queues';
import { groqService, Prompts, TaskReasoningEngine } from '../ai';

export class ExecutorAgent {
  async process(jobData: any) {
    const { task, bidAmount } = jobData;
    console.log(`[ExecutorAgent] Performing work for task: ${task.title}. Expected reward: ${bidAmount}`);
    
    // Simulate streaming execution for complex tasks
    let rawExecutionResult = "";
    await groqService.streamText(
      `Execute this task: ${task.description}\nRequirements: ${(task.requirements || []).join(', ')}`,
      Prompts.EXECUTION_SYSTEM,
      (chunk) => {
        rawExecutionResult += chunk;
        // Could stream to WebSocket for live UI updates here
      }
    );
    
    const summary = await TaskReasoningEngine.summarizeExecution(task, rawExecutionResult);
    
    console.log(`[ExecutorAgent] Work completed. Summary: ${summary}`);
    await queues.validation.add('validate-task', { task, result: rawExecutionResult, summary });
  }
}
