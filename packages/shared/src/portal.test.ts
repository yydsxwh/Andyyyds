import assert from "node:assert/strict";
import { ACCOUNT_CENTER_HREF, ACADEMIC_HREF, parsePortal } from "./portal";

function isEnabled(item: { enabled?: boolean } | undefined) {
  return Boolean(item && item.enabled !== false);
}

{
  const portal = parsePortal(null);
  const item = portal.nav.find((link) => link.key === "account-center");
  assert.ok(item);
  assert.equal(item?.href, ACCOUNT_CENTER_HREF);
  assert.equal(isEnabled(item), true);
}

{
  const portal = parsePortal(
    JSON.stringify({
      nav: [
        { key: "home", label: "首页", href: "/" },
        {
          key: "account-center",
          label: "账号中心",
          href: "/account",
          enabled: false,
        },
      ],
    }),
  );
  const item = portal.nav.find((link) => link.key === "account-center");
  assert.ok(item);
  assert.equal(item?.href, ACCOUNT_CENTER_HREF);
  assert.equal(isEnabled(item), true);
}

{
  const portal = parsePortal(
    JSON.stringify({
      nav: [{ key: "home", label: "首页", href: "/" }],
    }),
  );
  const item = portal.nav.find((link) => link.key === "account-center");
  assert.ok(item);
  assert.equal(item?.href, ACCOUNT_CENTER_HREF);
  assert.equal(isEnabled(item), true);
}

{
  const nav = Array.from({ length: 20 }, (_, index) => ({
    key: `item-${index}`,
    label: `项${index}`,
    href: `/p${index}`,
  }));
  const portal = parsePortal(JSON.stringify({ nav }));
  const item = portal.nav.find((link) => link.key === "account-center");
  assert.ok(item);
  assert.equal(item?.href, ACCOUNT_CENTER_HREF);
  assert.equal(portal.nav.length <= 22, true);
  assert.ok(portal.nav.some((item) => item.key === "academic"));
}

{
  const portal = parsePortal(null);
  const labels = portal.nav.map((item) => item.label);
  const person = labels.indexOf("个人介绍");
  const academic = labels.indexOf("教务");
  const courses = labels.indexOf("网课资料");
  assert.ok(person >= 0 && academic === person + 1 && courses === academic + 1);
  assert.equal(portal.nav[academic]?.href, ACADEMIC_HREF);
  assert.equal(ACADEMIC_HREF.startsWith("https://academic.yydsxwh.com"), true);
}

{
  const portal = parsePortal(
    JSON.stringify({
      nav: [
        { key: "home", label: "首页", href: "/" },
        { key: "person", label: "个人 IP", href: "/about/person" },
        { key: "courses", label: "网课资料", href: "/courses" },
      ],
    }),
  );
  const labels = portal.nav.map((item) => item.label);
  const person = labels.indexOf("个人 IP");
  const academic = labels.indexOf("教务");
  const courses = labels.indexOf("网课资料");
  assert.equal(academic, person + 1);
  assert.equal(courses, academic + 1);
  assert.equal(portal.nav[academic]?.href, ACADEMIC_HREF);
}

console.log("portal tests passed");
