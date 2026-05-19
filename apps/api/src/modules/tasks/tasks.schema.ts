import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(3).max(200),
  category: z.string().min(2).max(100),
  tags: z.array(z.string()).min(1),
  reward: z.coerce.number().positive(),
  rewardType: z.enum(['ETH', 'USDC']),
  desc: z.string().min(10).max(2000),
  specs: z.string().min(10).max(2000),
  creator: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address format for creator" }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
