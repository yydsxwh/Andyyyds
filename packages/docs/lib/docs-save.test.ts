import assert from "node:assert/strict";
import { isDocsSaveHotkey } from "./docs-save";

assert.equal(
  isDocsSaveHotkey({ key: "s", ctrlKey: true, metaKey: false, altKey: false }),
  true,
);
assert.equal(
  isDocsSaveHotkey({ key: "S", ctrlKey: false, metaKey: true, altKey: false }),
  true,
);
assert.equal(
  isDocsSaveHotkey({ key: "s", ctrlKey: false, metaKey: false, altKey: false }),
  false,
);
assert.equal(
  isDocsSaveHotkey({ key: "s", ctrlKey: true, metaKey: false, altKey: true }),
  false,
);
assert.equal(
  isDocsSaveHotkey({ key: "p", ctrlKey: true, metaKey: false, altKey: false }),
  false,
);

console.log("docs-save tests ok");
