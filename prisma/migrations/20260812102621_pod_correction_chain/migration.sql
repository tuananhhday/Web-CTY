-- DropIndex
DROP INDEX "proof_of_deliveries_shipmentId_key";

-- AlterTable
ALTER TABLE "proof_of_deliveries" ADD COLUMN     "supersededAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "proof_of_deliveries_shipmentId_supersededAt_idx" ON "proof_of_deliveries"("shipmentId", "supersededAt");

-- ---------------------------------------------------------------------------
-- Ràng buộc viết tay: mỗi chuyến chỉ có ĐÚNG MỘT biên bản giao hàng đang hiệu lực (§18).
--
-- Prisma không diễn đạt được partial unique index nên phải viết SQL. Không có ràng buộc
-- này thì một lỗi ở tầng ứng dụng sẽ tạo hai biên bản cùng hiệu lực cho một chuyến, và
-- không ai biết bản nào mới là bằng chứng thật.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "proof_of_deliveries_one_active_per_shipment"
  ON "proof_of_deliveries" ("shipmentId")
  WHERE "supersededAt" IS NULL;

-- Bản điều chỉnh phải trỏ về một bản khác, không tự trỏ về chính nó.
ALTER TABLE "proof_of_deliveries"
  ADD CONSTRAINT "proof_of_deliveries_correction_not_self"
  CHECK ("correctionOfId" IS NULL OR "correctionOfId" <> "id");
