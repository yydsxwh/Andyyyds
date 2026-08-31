/** Next.js 路由入口（网址不变）。segment 配置必须写在本文件。 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "MathCode · 文档转 LaTeX",
  description:
    "上传公式截图、PDF、Word、WPS、PPT、表格或 Markdown，由 AI 转为可编辑的 LaTeX 源码。",
};

export { default } from "@andyyyds/mathcode/routes/products/mathcode/page";
