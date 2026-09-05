/** Next.js 路由入口（网址不变）。segment 配置必须写在本文件。 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { GET, POST } from "@andyyyds/mathcode/api/mathcode/access/route";
