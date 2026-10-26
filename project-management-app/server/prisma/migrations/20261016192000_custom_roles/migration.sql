-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isManager" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_projectId_name_key" ON "Role"("projectId", "name");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing projects keep a Manager role and a Member role.
INSERT INTO "Role" ("id", "projectId", "name", "isManager")
SELECT 'role_manager_' || "id", "id", 'Manager', true FROM "Project";

INSERT INTO "Role" ("id", "projectId", "name", "isManager")
SELECT 'role_member_' || "id", "id", 'Member', false FROM "Project";

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN "roleId" TEXT;

UPDATE "ProjectMember"
SET "roleId" = 'role_manager_' || "projectId"
WHERE "role" = 'OWNER';

UPDATE "ProjectMember"
SET "roleId" = 'role_member_' || "projectId"
WHERE "role" = 'MEMBER';

ALTER TABLE "ProjectMember" ALTER COLUMN "roleId" SET NOT NULL;

ALTER TABLE "ProjectMember" DROP COLUMN "role";

DROP TYPE "ProjectRole";

-- CreateIndex
CREATE INDEX "ProjectMember_roleId_idx" ON "ProjectMember"("roleId");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
