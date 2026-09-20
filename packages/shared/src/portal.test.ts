import assert from "node:assert/strict";
import { ACCOUNT_CENTER_HREF, parsePortal } from "./portal";

{
  const portal = parsePortal(null);
  const item = portal.nav.find((link) => link.key === "account-center");
  assert.ok(item);
  assert.equal(item?.href, ACCOUNT_CENTER_HREF);
  assert.equal(item?.enabled, true);
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
  assert.equal(item?.enabled, true);
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
  assert.equal(item?.enabled, true);
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
  assert.equal(portal.nav.length <= 20, true);
}

console.log("portal tests passed");
