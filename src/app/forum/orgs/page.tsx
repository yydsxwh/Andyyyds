/** Next.js 路由入口。dynamic/metadata 必须写在本文件，Next 才能静态识别。 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "单位机构",
  description: "按单位或机构交流：讨论、通知、招聘与活动",
};

export { default } from "@andyyyds/forum/routes/forum/orgs/page";
