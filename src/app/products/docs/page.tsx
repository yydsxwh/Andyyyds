/** Next.js 路由入口（网址不变）。segment 配置必须写在本文件。 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "网页文档",
  description:
    "在浏览器里写文档：标题、正文、列表、插图、表格；可打开/另存文件，设置页眉页脚页码并打印。",
};

export { default } from "@andyyyds/docs/routes/products/docs/page";
