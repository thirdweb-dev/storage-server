-- CreateTable
CREATE TABLE "Uploads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cid" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isScanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),

    CONSTRAINT "Uploads_pkey" PRIMARY KEY ("id")
);
