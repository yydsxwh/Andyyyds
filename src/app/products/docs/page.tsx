/** Next.js 路由入口（网址不变）。segment 配置必须写在本文件。 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "网页文档",
  description:
    "在浏览器里写文档：标题、正文、加粗、多级标题、项目符号、可自定义的多级编号、插图和简单表格。",
};

export { default } from "@andyyyds/docs/routes/products/docs/page";
