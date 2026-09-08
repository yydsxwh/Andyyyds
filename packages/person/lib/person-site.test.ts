import assert from "node:assert/strict";
import {
  buildPersonContactChips,
  normalizeExtraContacts,
  normalizePersonEntry,
  normalizePersonProfile,
  personEntryHref,
  personEntrySectionHref,
} from "./person-site";

{
  const profile = normalizePersonProfile({
    displayName: " 张三 ",
    email: "a@b.com",
    github: "octocat",
    extraContacts: [{ label: "工作微信", value: "work-wx", href: "" }],
    about: "x".repeat(20),
  });
  assert.equal(profile.displayName, "张三");
  assert.equal(profile.email, "a@b.com");
  const chips = buildPersonContactChips(profile);
  assert.ok(chips.some((chip) => chip.key === "email"));
  assert.ok(chips.some((chip) => chip.label === "工作微信"));
}

{
  const entry = normalizePersonEntry({
    kind: "PROJECT",
    title: "示范项目",
    sortOrder: 3,
    published: false,
    featured: true,
    images: ["https://example.com/a.png", "javascript:alert(1)"],
  });
  assert.equal(entry.kind, "PROJECT");
  assert.equal(entry.published, false);
  assert.equal(entry.featured, true);
  assert.equal(entry.images.length, 1);
  assert.equal(personEntryHref({ kind: "PROJECT", id: "abc" }), "/about/person/projects/abc");
  assert.equal(personEntryHref({ kind: "PORTFOLIO", id: "p1" }), "/about/person/e/p1");
  assert.equal(personEntrySectionHref("PHOTO"), "/about/person/photos");
}

{
  assert.equal(normalizeExtraContacts("not-json").length, 0);
}

console.log("person-site tests ok");
