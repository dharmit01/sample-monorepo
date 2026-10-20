import assert from "node:assert/strict";
import { test } from "node:test";

process.env.JWT_SECRET = "x".repeat(32);
const { hashPassword, readCookie, signToken, verifyPassword, verifyToken } = await import("./auth.ts");

test("password hash round-trips and rejects wrong password", async () => {
  const stored = await hashPassword("correct horse");
  assert.equal(await verifyPassword("correct horse", stored), true);
  assert.equal(await verifyPassword("wrong", stored), false);
  assert.equal(await verifyPassword("x", "garbage"), false);
});

test("jwt round-trips and rejects tampering", async () => {
  const token = await signToken("user-1");
  assert.equal(await verifyToken(token), "user-1");
  assert.equal(await verifyToken(token.slice(0, -2) + "xx"), null);
});

test("readCookie finds value among others", () => {
  assert.equal(readCookie("a=1; session=abc.def=; b=2", "session"), "abc.def=");
  assert.equal(readCookie(null, "session"), null);
});
