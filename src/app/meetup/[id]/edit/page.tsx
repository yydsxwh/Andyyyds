/** Next.js 路由入口（网址不变）。dynamic/metadata 必须写在本文件，Next 才能静态识别。 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "编辑约搭",
};

export { default } from "@andyyyds/meetup/routes/meetup/[id]/edit/page";
