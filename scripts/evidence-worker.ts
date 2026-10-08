import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { acquireLease, cleanupEvidence, processOne, recoverJobs } from "../src/lib/evidence/worker";
const owner = randomUUID();
let stopped = false;
process.on("SIGTERM", () => { stopped = true; });
process.on("SIGINT", () => { stopped = true; });
async function main() {
  if (!await acquireLease(owner)) throw new Error("Another evidence worker holds the lease");
  await recoverJobs(owner);
  const heartbeat = setInterval(() => {
    void acquireLease(owner).then(ok => { if (!ok) stopped = true; }).catch(() => { stopped = true; });
  }, 30000);
  let lastCleanup = 0;
  try {
    while (!stopped) {
      if (Date.now() - lastCleanup >= 15 * 60000) {
        await cleanupEvidence(owner); lastCleanup = Date.now();
      }
      if (!await processOne(owner)) await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } finally {
    clearInterval(heartbeat);
    await prisma.evidenceWorkerState.updateMany({ where: { id: "main", owner }, data: { leaseUntil: new Date(0) } });
    await prisma.$disconnect();
  }
}
main().catch(async () => { console.error("Evidence worker stopped; check its heartbeat and configuration."); await prisma.$disconnect(); process.exitCode = 1; });
