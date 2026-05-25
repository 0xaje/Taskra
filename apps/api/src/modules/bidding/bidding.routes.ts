import { FastifyPluginAsync } from 'fastify';
import { BiddingService } from './bidding.service';
import { BiddingController } from './bidding.controller';

const biddingRoutes: FastifyPluginAsync = async (server) => {
  const service = new BiddingService(server.realtime);
  const controller = new BiddingController(service);

  server.get('/', controller.getAllBids.bind(controller));
  server.get('/task/:taskId', controller.getBidsByTaskId.bind(controller));
  server.post('/', controller.submitBid.bind(controller));
  server.post('/:id/accept', controller.acceptBid.bind(controller));
};

export default biddingRoutes;
export { biddingRoutes };
