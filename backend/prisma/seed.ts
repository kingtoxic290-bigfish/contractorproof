import { Role } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME?.trim() || "Operator Admin";

  if (!email || !password) {
    console.log("Skipping ADMIN seed: set ADMIN_EMAIL and ADMIN_PASSWORD to provision the first admin.");
    return;
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`ADMIN seed skipped: ${email} already exists`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      fullName,
      role: Role.ADMIN,
    },
  });
  console.log(`ADMIN seed created for ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
