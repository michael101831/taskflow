-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('TEAM', 'GROUP', 'DIRECT');

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "kind" "ConversationKind" NOT NULL,
    "directKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("conversationId","userId")
);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "conversationId" TEXT;

-- Backfill one team chat per project and attach existing messages
INSERT INTO "Conversation" ("id", "projectId", "name", "kind", "createdAt", "updatedAt")
SELECT 'conv_team_' || "id", "id", 'Team', 'TEAM', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Project";

INSERT INTO "ConversationMember" ("conversationId", "userId", "joinedAt")
SELECT 'conv_team_' || "projectId", "userId", CURRENT_TIMESTAMP
FROM "ProjectMember";

UPDATE "Message"
SET "conversationId" = 'conv_team_' || "projectId"
WHERE "conversationId" IS NULL;

ALTER TABLE "Message" ALTER COLUMN "conversationId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_projectId_directKey_key" ON "Conversation"("projectId", "directKey");

-- CreateIndex
CREATE INDEX "Conversation_projectId_updatedAt_idx" ON "Conversation"("projectId", "updatedAt");

-- One team chat per project. Prisma does not model partial unique indexes.
CREATE UNIQUE INDEX "Conversation_one_team_per_project" ON "Conversation"("projectId") WHERE "kind" = 'TEAM';

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

-- CreateIndex
CREATE INDEX "Message_projectId_idx" ON "Message"("projectId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- DropIndex
DROP INDEX "Message_projectId_createdAt_idx";

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
