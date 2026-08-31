/** Next.js 路由入口。dynamic/metadata 必须写在本文件，Next 才能静态识别。 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "兴趣圈子",
  description: "按兴趣主题交流：讨论、分享、约局与问答",
};

export { default } from "@andyyyds/forum/routes/forum/circles/page";
