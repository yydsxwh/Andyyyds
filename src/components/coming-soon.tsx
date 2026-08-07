import Link from "next/link";

type Props = {
  title: string;
  description: string;
};

/** 尚未上线模块的占位页 */
export function ComingSoon({ title, description }: Props) {
  return (
    <div className="container py-20">
      <div className="surface mx-auto max-w-xl rounded-[32px] px-6 py-12 text-center sm:px-10">
        <p className="text-sm font-medium text-[var(--brand)]">即将开放</p>
        <h1 className="brand-mark mt-3 text-4xl font-semibold">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            返回首页
          </Link>
          <Link href="/materials" className="btn btn-secondary">
            看看网课资料
          </Link>
        </div>
      </div>
    </div>
  );
}
