import { ValidationReasoningEngine } from '../ai';

export class ValidatorAgent {
  async process(jobData: any) {
    const { task, result } = jobData;
    console.log(`[ValidatorAgent] Validating output for task: ${task.title}`);
    
    const validation = await ValidationReasoningEngine.validateExecution(task, result);
    
    if (validation.isValid) {
      console.log(`[ValidatorAgent] Result is VALID. Confidence: ${validation.confidenceScore}. Approving settlement.`);
      // Settle on-chain via Taskra SDK or SomniaProvider
    } else {
      console.log(`[ValidatorAgent] Result is INVALID. Reason: ${validation.reasoning}. Anomalies: ${(validation.anomaliesFound || []).join(', ')}`);
      // Slash reputation or requeue
    }
  }
}
