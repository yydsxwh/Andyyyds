/** Next.js 路由入口（网址不变）。dynamic/metadata 必须写在本文件，Next 才能静态识别。 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "大学论坛管理",
};

export { default } from "@andyyyds/forum/routes/studio/forum/page";
