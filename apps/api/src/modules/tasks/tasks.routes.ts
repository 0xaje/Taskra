import { FastifyPluginAsync } from 'fastify';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

const tasksRoutes: FastifyPluginAsync = async (server) => {
  const service = new TasksService(server.io);
  const controller = new TasksController(service);

  server.get('/', controller.getAllTasks.bind(controller));
  server.get('/:id', controller.getTaskById.bind(controller));
  server.post('/', controller.createTask.bind(controller));
};

export default tasksRoutes;
export { tasksRoutes };
