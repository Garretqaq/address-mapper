import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // EdgeOne Pages 配置
  // 支持 SSR/ISR 以使用 API routes
  // 如果需要纯静态导出，可以设置 output: "export"，但会禁用 API routes
};

export default nextConfig;
