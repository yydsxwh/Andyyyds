/** Next.js 路由入口。dynamic/metadata 必须写在本文件，Next 才能静态识别。 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "本地同城",
  description: "按城市找附近的人：活动、吃喝、租房、二手与互助",
};

export { default } from "@andyyyds/forum/routes/forum/cities/page";
