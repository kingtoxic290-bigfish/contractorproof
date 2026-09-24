import type { Request, Response, NextFunction } from "express";
import { contractorService } from "../services/contractor.service";

export async function listContractors(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const contractors = await contractorService.list();
    res.json({ contractors });
  } catch (error) {
    next(error);
  }
}

export async function getContractor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const contractor = await contractorService.getById(req.params.contractorId);
    res.json({ contractor });
  } catch (error) {
    next(error);
  }
}
