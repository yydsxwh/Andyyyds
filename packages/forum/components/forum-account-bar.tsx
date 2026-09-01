import Link from "next/link";

type Props = {
  loggedIn: boolean;
  name?: string;
  loginNext: string;
};

function authHref(path: "/login" | "/register", next: string) {
  return `${path}?next=${encodeURIComponent(next)}`;
}

/**
 * 论坛与全站同账号：不另开号。高校要实名；圈子/同城/单位登录即可发帖。
 */
export function ForumAccountBar({ loggedIn, name, loginNext }: Props) {
  if (loggedIn) {
    return (
      <p className="text-sm leading-6 text-[var(--muted)]">
        已用网站账号登录{name ? `：${name}` : ""}。论坛与课程、商城同一套登录，不用另开论坛号。
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
      <span>论坛不另开账号，微信 / 登录名 / 手机 / 邮箱都可以。</span>
      <Link
        href={authHref("/login", loginNext)}
        className="inline-flex min-h-11 items-center text-[var(--brand)]"
      >
        用网站账号登录
      </Link>
      <Link
        href={authHref("/register", loginNext)}
        className="inline-flex min-h-11 items-center text-[var(--brand)]"
      >
        没有账号再注册
      </Link>
    </div>
  );
}
