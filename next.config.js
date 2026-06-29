/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // โหลดภาพต้นไม้จาก public ได้ปกติ (เราใช้ <img>/background อยู่แล้ว ไม่ต้อง optimizer)
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
