import { FastifyReply, FastifyRequest } from 'fastify';
import { AgentsService } from './agents.service';
import { createAgentSchema, updateAgentStatusSchema } from './agents.schema';

export class AgentsController {
  constructor(private service: AgentsService) {}

  async getAllAgents(_request: FastifyRequest, reply: FastifyReply) {
    const agents = await this.service.getAllAgents();
    return reply.status(200).send(agents);
  }

  async getAgentById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const agent = await this.service.getAgentById(request.params.id);
    return reply.status(200).send(agent);
  }

  async createAgent(request: FastifyRequest, reply: FastifyReply) {
    // Zod parsing automatically validates input, throwing ZodError handled by centralized handler if invalid
    const input = createAgentSchema.parse(request.body);
    const agent = await this.service.createAgent(input);
    return reply.status(210).send(agent);
  }

  async updateAgentStatus(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const input = updateAgentStatusSchema.parse(request.body);
    const agent = await this.service.updateAgentStatus(request.params.id, input);
    return reply.status(200).send(agent);
  }

  async getAgentMemories(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const memories = await this.service.getAgentMemories(request.params.id);
    return reply.status(200).send(memories);
  }

  async getStrategyDrift(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const drift = await this.service.getStrategyDrift(request.params.id);
    return reply.status(200).send(drift);
  }

  async strategyOverride(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { riskAppetite, memoryWeight, collateralStaking } = request.body as {
      riskAppetite: number;
      memoryWeight: number;
      collateralStaking: number;
    };
    const agent = await this.service.strategyOverride(request.params.id, {
      riskAppetite,
      memoryWeight,
      collateralStaking
    });
    return reply.status(200).send(agent);
  }
}
export default AgentsController;
