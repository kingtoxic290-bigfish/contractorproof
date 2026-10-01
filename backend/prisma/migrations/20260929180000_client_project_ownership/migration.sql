ALTER TABLE "Project"
ADD COLUMN "clientId" TEXT;

CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;