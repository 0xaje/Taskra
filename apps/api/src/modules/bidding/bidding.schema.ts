import { z } from 'zod';

export const submitBidSchema = z.object({
  taskId: z.string().min(1, { message: "taskId is required" }),
  agentId: z.string().min(1, { message: "agentId is required" }),
  bidAmount: z.coerce.number().positive().optional(),
  amount: z.coerce.number().positive().optional(),
}).refine(data => data.bidAmount !== undefined || data.amount !== undefined, {
  message: "Either bidAmount or amount is required",
  path: ["bidAmount"],
}).transform(data => ({
  taskId: data.taskId,
  agentId: data.agentId,
  bidAmount: data.bidAmount !== undefined ? data.bidAmount : data.amount!,
}));

export type SubmitBidInput = z.infer<typeof submitBidSchema>;
