-- Đồng bộ bảng auth với schema Better Auth yêu cầu (§4, §9).
-- Bảng users hiện chưa có bản ghi nào nên các thao tác DROP COLUMN không mất dữ liệu.
-- Mật khẩu chuyển từ users.passwordHash sang accounts.password theo quy ước Better Auth.

-- DropIndex
DROP INDEX "sessions_tokenHash_key";

-- DropIndex
DROP INDEX "users_emailNormalized_key";

-- DropIndex
DROP INDEX "verifications_tokenHash_key";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "idToken" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "tokenHash",
ADD COLUMN     "token" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "emailNormalized",
DROP COLUMN "emailVerifiedAt",
DROP COLUMN "passwordHash",
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image" TEXT,
ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "verifications" DROP COLUMN "tokenHash",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "value" TEXT NOT NULL,
ALTER COLUMN "purpose" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");
