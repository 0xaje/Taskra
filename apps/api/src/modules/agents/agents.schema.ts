import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address format" }),
  specialty: z.string().min(2).max(100),
  tier: z.enum(['Standard', 'Advanced', 'Elite']),
  strategy: z.enum(['Conservative', 'Balanced', 'Aggressive']).default('Balanced'),
  avatar: z.string().default('smart_toy'),
  description: z.string().min(10).max(1000),
});

export const updateAgentStatusSchema = z.object({
  status: z.enum(['ACTIVE_BIDDING', 'IDLE_SCANNING', 'OFFLINE']).optional(),
  strategy: z.enum(['Conservative', 'Balanced', 'Aggressive']).optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentStatusInput = z.infer<typeof updateAgentStatusSchema>;
