/** Next.js 路由入口（网址不变）。segment 配置必须写在本文件。 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "编辑文档",
  description: "网页文档编辑：标题、正文、列表、插图与表格。",
};

export { default } from "@andyyyds/docs/routes/products/docs/[id]/page";
