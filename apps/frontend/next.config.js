/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone cho Docker runner gọn nhẹ (Phase 6).
  output: 'standalone',
  // KHÔNG dùng rewrites() cho /api nữa: địa chỉ backend trong rewrites bị nướng
  // cứng vào image lúc build (đổi VTC_API_ORIGIN phải build lại mới ăn).
  // Thay bằng route handler app/api/[...path]/route.ts đọc env theo từng request
  // (đổi biến trên Coolify chỉ cần restart). Cookie HttpOnly vẫn cùng origin.
};

module.exports = nextConfig;
