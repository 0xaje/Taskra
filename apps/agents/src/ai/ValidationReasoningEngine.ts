import { groqService } from './GroqService';
import { Prompts } from './prompts';
import { ValidationOutput } from './types';

export class ValidationReasoningEngine {
  static async validateExecution(taskSpec: any, executionResult: string): Promise<ValidationOutput> {
    const prompt = `Task Specification:
${JSON.stringify(taskSpec)}

Execution Result to Validate:
${executionResult}

Analyze the result against the requirements. Output JSON:
{
  "isValid": <boolean>,
  "confidenceScore": <0-100>,
  "reasoning": "detailed explanation",
  "anomaliesFound": ["list of issues, empty if none"]
}`;

    return groqService.generateJSON<ValidationOutput>(prompt, Prompts.VALIDATION_SYSTEM, 'llama3-70b-8192');
  }
}
