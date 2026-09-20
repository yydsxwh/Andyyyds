import assert from "node:assert/strict";
import {
  isAuthLoopPath,
  nextFromCurrentLocation,
  safeNextPath,
} from "./safe-next-path";

assert.equal(safeNextPath("/forum"), "/forum");
assert.equal(safeNextPath("/meetup?join=1"), "/meetup?join=1");
assert.equal(safeNextPath("//evil.com"), "/");
assert.equal(safeNextPath("https://evil.com/"), "/");
assert.equal(safeNextPath("/foo://bar"), "/");
assert.equal(safeNextPath("/login?next=/forum"), "/");
assert.equal(safeNextPath("/register"), "/");
assert.equal(safeNextPath("/api/auth/callback"), "/");
assert.equal(safeNextPath(""), "/");
assert.equal(safeNextPath(null, "/shop"), "/shop");
assert.equal(isAuthLoopPath("/login"), true);
assert.equal(isAuthLoopPath("/api/auth/account/start"), true);
assert.equal(isAuthLoopPath("/forum"), false);
assert.equal(nextFromCurrentLocation("/courses", "cat=math"), "/courses?cat=math");
assert.equal(nextFromCurrentLocation("/login"), "/");
assert.equal(nextFromCurrentLocation("//evil"), "/");

console.log("safe-next-path tests passed");
