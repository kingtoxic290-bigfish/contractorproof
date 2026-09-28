import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import {
  listBlockchainHistory,
  reconcileBlockchainEvent,
} from "../controllers/blockchain.controller";

export const blockchainRouter = Router();

blockchainRouter.use(authenticate);
blockchainRouter.get("/", listBlockchainHistory);
blockchainRouter.post("/:eventId/reconcile", reconcileBlockchainEvent);
