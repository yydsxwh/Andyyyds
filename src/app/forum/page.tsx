/** Next.js 路由入口（网址不变）。dynamic/metadata 必须写在本文件，Next 才能静态识别。 */
import type { Metadata } from "next";
import { getPortalNavPageTitle } from "@andyyyds/shared/portal-nav-title";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const title = await getPortalNavPageTitle("forum", "论坛");
  return {
    title,
    description: "大学论坛、兴趣圈子、本地同城与单位机构，按分区交流",
  };
}

export { default } from "@andyyyds/forum/routes/forum/page";
