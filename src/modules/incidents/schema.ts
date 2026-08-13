import { z } from "zod";
import {
  INCIDENT_TYPES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
} from "@/modules/incidents/state-machine";

/** Zod schema cho sự cố (§19). */

/**
 * Tài xế hoặc điều phối báo sự cố.
 *
 * KHÔNG có trường `severity`: tài xế đang đứng giữa đường không phải là người đánh giá mức
 * nghiêm trọng, và để họ tự chọn thì mức độ mất tính so sánh được giữa các sự cố. Hệ thống
 * suy ra từ loại; điều phối điều chỉnh sau khi xác minh (§19).
 */
export const reportIncidentSchema = z.object({
  /** Sự cố luôn gắn với một chuyến — sự cố không thuộc chuyến nào là việc của phiếu hỗ trợ. */
  trackingCode: z.string().trim().min(1, "Thiếu mã chuyến"),

  type: z.enum(INCIDENT_TYPES, { message: "Vui lòng chọn loại sự cố" }),

  title: z
    .string()
    .trim()
    .min(5, "Tiêu đề tối thiểu 5 ký tự")
    .max(200, "Tiêu đề tối đa 200 ký tự"),

  description: z
    .string()
    .trim()
    .min(10, "Vui lòng mô tả rõ hơn, tối thiểu 10 ký tự")
    .max(5000, "Mô tả tối đa 5000 ký tự"),

  /** Vị trí lúc xảy ra. Dữ liệu bổ trợ, không phải bằng chứng duy nhất (§17, §18). */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),

  /** Bỏ trống thì lấy thời điểm gửi báo cáo. */
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

export type ReportIncidentInput = z.infer<typeof reportIncidentSchema>;

export const updateIncidentSchema = z.object({
  code: z.string().trim().min(1),
  severity: z.enum(INCIDENT_SEVERITIES).optional(),
  assigneeId: z.string().trim().min(1).nullable().optional(),
});

export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

export const changeIncidentStatusSchema = z.object({
  code: z.string().trim().min(1),
  toStatus: z.enum(INCIDENT_STATUSES),
  resolution: z.string().trim().max(3000).optional(),
});

export type ChangeIncidentStatusInput = z.infer<typeof changeIncidentStatusSchema>;
