import Link from "next/link";
import { redirect } from "next/navigation";
import { MeetupEditorForm } from "@/components/meetup-editor-form";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { canManageMeetups } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "创建约搭",
};

export default async function StudioMeetupNewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageMeetups(session.role)) redirect("/studio");

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <StudioNav current="meetup" area="admin" />
      <div>
        <Link href="/studio/meetup" className="text-sm text-[var(--brand)]">
          ← 返回约搭管理
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">创建约搭</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          站长创建后你本人为发起人并自动占第一档一席；可设价格、分档与图文详情。
        </p>
      </div>
      <MeetupEditorForm
        mode="create"
        apiPath="/api/studio/meetups"
        successHref={(id) => `/studio/meetup/${id}/edit`}
        submitLabel="创建并保存"
      />
    </div>
  );
}
