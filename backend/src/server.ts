import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./repositories/prisma";

async function start(): Promise<void> {
  app.listen(env.port, () => {
    console.log(`ContractorProof API listening on http://localhost:${env.port}`);
  });
}

start().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
