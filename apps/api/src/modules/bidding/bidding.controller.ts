import { FastifyReply, FastifyRequest } from 'fastify';
import { BiddingService } from './bidding.service';
import { submitBidSchema } from './bidding.schema';

export class BiddingController {
  constructor(private service: BiddingService) {}

  async getAllBids(_request: FastifyRequest, reply: FastifyReply) {
    const bids = await this.service.getAllBids();
    return reply.status(200).send(bids);
  }

  async getBidsByTaskId(request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) {
    const bids = await this.service.getBidsByTaskId(request.params.taskId);
    return reply.status(200).send(bids);
  }

  async submitBid(request: FastifyRequest, reply: FastifyReply) {
    const input = submitBidSchema.parse(request.body);
    const bid = await this.service.submitBid(input);
    return reply.status(201).send(bid);
  }

  async acceptBid(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const bid = await this.service.acceptBid(request.params.id);
    return reply.status(200).send(bid);
  }
}
export default BiddingController;
