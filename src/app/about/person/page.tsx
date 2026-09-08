/** Next.js 路由入口（网址不变）。segment 配置必须写在本文件。 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "个人展示",
  description: "About me、项目、博客、作品集、荣誉与自媒体。",
};

export { default } from "@andyyyds/person/routes/about/person/page";
