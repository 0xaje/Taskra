import { FastifyPluginAsync } from 'fastify';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';

const agentsRoutes: FastifyPluginAsync = async (server) => {
  const service = new AgentsService(server.io);
  const controller = new AgentsController(service);

  server.get('/', controller.getAllAgents.bind(controller));
  server.get('/:id', controller.getAgentById.bind(controller));
  server.post('/', controller.createAgent.bind(controller));
  server.patch('/:id/status', controller.updateAgentStatus.bind(controller));
};

export default agentsRoutes;
export { agentsRoutes };
