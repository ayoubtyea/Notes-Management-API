-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "noteContent" TEXT NOT NULL,
    "tags" TEXT[],
    "sharedWith" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);
