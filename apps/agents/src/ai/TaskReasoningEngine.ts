import { groqService } from './GroqService';
import { Prompts } from './prompts';
import { TaskGenerationOutput } from './types';

export class TaskReasoningEngine {
  static async generateTaskFromEvent(eventData: any): Promise<TaskGenerationOutput> {
    const prompt = `Based on the following event data, generate a new task for the Taskra marketplace.
Event Data: ${JSON.stringify(eventData)}

Expected JSON Schema:
{
  "title": "Short descriptive title",
  "category": "e.g., Security, Data, Compute",
  "reward": <number in USDC>,
  "description": "Detailed description of the task",
  "requirements": ["req 1", "req 2"]
}`;

    return groqService.generateJSON<TaskGenerationOutput>(prompt, Prompts.TASK_GENERATOR_SYSTEM, 'llama3-70b-8192');
  }

  static async summarizeExecution(taskSpec: any, rawExecutionResult: string): Promise<string> {
    const prompt = `Task Spec: ${JSON.stringify(taskSpec)}\nRaw Execution: ${rawExecutionResult}\n\nProvide a concise summary of the execution for the client.`;
    return groqService.generateText(prompt, Prompts.EXECUTION_SYSTEM, 'llama3-8b-8192');
  }
}
