/** Next.js 路由入口。dynamic/metadata 必须写在本文件，Next 才能静态识别。 */
import type { Metadata } from "next";
import { getPortalNavPageTitle } from "@andyyyds/shared/portal-nav-title";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const title = await getPortalNavPageTitle("forum", "论坛");
  return {
    title,
    description: "按高校分区交流：日常、美食、选课、二手、跑腿、资料与交友",
  };
}

export { default } from "@andyyyds/forum/routes/forum/campus/page";
