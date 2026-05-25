import { FastifyReply, FastifyRequest } from 'fastify';
import { TasksService } from './tasks.service';
import { createTaskSchema } from './tasks.schema';

export class TasksController {
  constructor(private service: TasksService) {}

  async getAllTasks(_request: FastifyRequest, reply: FastifyReply) {
    const tasks = await this.service.getAllTasks();
    return reply.status(200).send(tasks);
  }

  async getTaskById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const task = await this.service.getTaskById(request.params.id);
    return reply.status(200).send(task);
  }

  async createTask(request: FastifyRequest, reply: FastifyReply) {
    const input = createTaskSchema.parse(request.body);
    const task = await this.service.createTask(input);
    return reply.status(201).send(task);
  }

  async getTaskLineage(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const lineage = await this.service.getTaskLineage(request.params.id);
    return reply.status(200).send(lineage);
  }
}
export default TasksController;
