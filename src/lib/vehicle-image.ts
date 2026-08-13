import { getImageSource } from "@/data/image-sources";
import type { ImageSource } from "@/types";

/**
 * Ảnh minh họa cho nhóm phương tiện.
 *
 * Khi doanh nghiệp chưa tải ảnh xe thật (`VehicleType.imageKey` còn trống), dùng ảnh stock
 * có giấy phép theo nhóm xe. Đây là ảnh MINH HỌA, không phải xe của doanh nghiệp — trang
 * /nguon-hinh-anh ghi rõ nguồn (§27).
 *
 * Khi có ảnh thật, quản trị viên tải lên và `imageKey` sẽ trỏ tới object storage; hàm này
 * chỉ còn dùng làm dự phòng.
 */

const CATEGORY_IMAGE: Record<string, string> = {
  LIGHT_TRUCK: "fleet-warehouse",
  MEDIUM_TRUCK: "fleet-warehouse",
  HEAVY_TRUCK: "domestic-transport",
  BOX_TRUCK: "cargo-loading",
  TARPAULIN_TRUCK: "domestic-transport",
  SPECIALIZED: "cargo-loading",
};

const DEFAULT_IMAGE_ID = "fleet-warehouse";

export function getVehicleImage(vehicle: {
  imageKey: string | null;
  category: string;
}): ImageSource {
  // imageKey do quản trị viên đặt phải là id hợp lệ trong danh mục nguồn ảnh; nếu không
  // khớp thì rơi về ảnh theo nhóm xe thay vì làm hỏng trang.
  if (vehicle.imageKey) {
    try {
      return getImageSource(vehicle.imageKey);
    } catch {
      // Bỏ qua và dùng ảnh theo nhóm bên dưới.
    }
  }

  return getImageSource(CATEGORY_IMAGE[vehicle.category] ?? DEFAULT_IMAGE_ID);
}
