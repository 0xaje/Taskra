export type ModelType = 'llama3-8b-8192' | 'llama3-70b-8192' | 'mixtral-8x7b-32768';

export interface TaskGenerationOutput {
  title: string;
  category: string;
  reward: number;
  description: string;
  requirements: string[];
}

export interface BidReasoningOutput {
  confidenceScore: number;
  estimatedCost: number;
  shouldBid: boolean;
  reasoning: string;
}

export interface ValidationOutput {
  isValid: boolean;
  confidenceScore: number;
  reasoning: string;
  anomaliesFound: string[];
}
