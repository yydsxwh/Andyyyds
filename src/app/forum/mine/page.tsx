/** Next.js 路由入口（网址不变）。dynamic/metadata 必须写在本文件，Next 才能静态识别。 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "我的论坛",
  description: "我发布的帖子、草稿、收藏和蹲蹲后续",
};

export { default } from "@andyyyds/forum/routes/forum/mine/page";
