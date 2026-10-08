import { prisma } from "../src/lib/prisma";
async function main() {
  const state = await prisma.evidenceWorkerState.findUnique({ where: { id: "cleanup" } });
  const healthy = Boolean(state?.lastCleanupAt && Date.now() - state.lastCleanupAt.getTime() < 30 * 60000 && !state.lastError);
  console.log(JSON.stringify({ healthy, heartbeatAt: state?.heartbeatAt, lastCleanupAt: state?.lastCleanupAt, lastError: state?.lastError }));
  if (!healthy) process.exitCode = 1;
}
main().catch(() => { console.error("Evidence health unavailable"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
