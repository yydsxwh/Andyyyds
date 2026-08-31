/** Next.js 路由入口（网址不变）。dynamic/metadata 必须写在本文件，Next 才能静态识别。 */
export const dynamic = "force-dynamic";

export { default, generateMetadata } from "@andyyyds/forum/routes/forum/[slug]/p/[postId]/page";
