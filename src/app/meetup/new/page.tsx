import Link from "next/link";
import { redirect } from "next/navigation";
import { MeetupCreateForm } from "@/components/meetup-create-form";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "发起约搭",
};

export default async function MeetupNewPage() {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/meetup/new")}`);
  }

  return (
    <div className="container py-10 sm:py-12">
      <div className="mb-6">
        <Link
          href="/meetup"
          className="text-sm text-[var(--brand)]"
        >
          ← 返回约搭广场
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">发起约搭</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          写清时间地点与人数，搭子看到就能报名。你本人自动占一席。
        </p>
      </div>
      <MeetupCreateForm />
    </div>
  );
}
