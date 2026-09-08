import assert from "node:assert/strict";
import {
  buildPersonContactChips,
  normalizeExtraContacts,
  normalizePersonEntry,
  normalizePersonProfile,
  personEntryHref,
  personEntrySectionHref,
} from "./person-site";
import { classifyPersonFile, normalizePersonFiles } from "./person-files";

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
  assert.equal(personEntrySectionHref("RESUME"), "/about/person/resume");
  assert.equal(personEntrySectionHref("INTRO_VIDEO"), "/about/person/intro");
  assert.equal(entry.files.length, 0);
}

{
  assert.equal(normalizeExtraContacts("not-json").length, 0);
}

{
  assert.equal(classifyPersonFile("cv.pdf"), "pdf");
  assert.equal(classifyPersonFile("talk.pptx"), "office");
  assert.equal(classifyPersonFile("notes.tex"), "latex");
  assert.equal(classifyPersonFile("readme.md"), "markdown");
  assert.equal(classifyPersonFile("main.py"), "code");
  assert.equal(classifyPersonFile("src.zip"), "archive");
  assert.equal(classifyPersonFile("app.apk"), "program");
  assert.equal(classifyPersonFile("intro.mp4"), "video");
  const files = normalizePersonFiles([
    { name: "cv.pdf", url: "/uploads/a/cv.pdf", mime: "application/pdf", size: 12 },
    { name: "bad", url: "javascript:alert(1)" },
  ]);
  assert.equal(files.length, 1);
  assert.equal(files[0]?.kind, "pdf");
}

console.log("person-site tests ok");
