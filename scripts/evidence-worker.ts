// Original videos are verified during confirmation; no persistent worker is needed.
console.error("The conversion worker is retired. Schedule POST /api/admin/evidence-cleanup every 15 minutes instead.");
process.exitCode = 1;
