import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // webpack 生产构建不会自动编译工作区源码包，需显式转译。
  transpilePackages: [
    "@andyyyds/shared",
    "@andyyyds/company",
    "@andyyyds/person",
    "@andyyyds/forum",
    "@andyyyds/meetup",
    "@andyyyds/courses",
    "@andyyyds/mathcode",
    "@andyyyds/docs",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "2048mb",
    },
    // Next 对 middleware/proxy 克隆请求体默认 10MB；本地/小文件代理回退需要更大缓冲。
    // 大视频主路径为浏览器直传 VOD/OSS，不依赖此值。
    proxyClientMaxBodySize: "2048mb",
  },
};

export default nextConfig;
