/** Next.js 路由入口（网址不变）。dynamic/metadata 必须写在本文件，Next 才能静态识别。 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "约搭",
  description: "找人一起玩：运动、美食、游戏、学习、出行结伴广场",
};

export { default } from "@andyyyds/meetup/routes/meetup/page";
