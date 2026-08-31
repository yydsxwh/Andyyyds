/** Next.js 路由入口（网址不变）。dynamic/metadata 必须写在本文件，Next 才能静态识别。 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "大学论坛",
  description: "按高校分区交流：日常、美食、选课、二手、跑腿、资料与交友",
};

export { default } from "@andyyyds/forum/routes/forum/page";
