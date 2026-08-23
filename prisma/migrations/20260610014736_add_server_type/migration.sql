-- CreateTable
CREATE TABLE "BenchmarkRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "pp" INTEGER NOT NULL DEFAULT 512,
    "tg" INTEGER NOT NULL DEFAULT 128,
    "concurrency" INTEGER NOT NULL DEFAULT 1,
    "runs" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tsTotal" REAL,
    "tsReq" REAL,
    "peakTs" REAL,
    "ttfr" REAL,
    "estPpt" REAL,
    "duration" REAL,
    "logOutput" TEXT,
    "notes" TEXT,
    "serverType" TEXT
);

-- CreateIndex
CREATE INDEX "BenchmarkRun_createdAt_idx" ON "BenchmarkRun"("createdAt");

-- CreateIndex
CREATE INDEX "BenchmarkRun_model_idx" ON "BenchmarkRun"("model");

-- CreateIndex
CREATE INDEX "BenchmarkRun_status_idx" ON "BenchmarkRun"("status");
