import { describe, expect, test } from "bun:test";
import { escapeXml } from "../../src/services/Launchd.js";

describe("escapeXml", () => {
  test("escapes ampersand", () => {
    expect(escapeXml("a & b")).toBe("a &amp; b");
  });

  test("escapes angle brackets", () => {
    expect(escapeXml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&apos;xss&apos;)&lt;/script&gt;",
    );
  });

  test("escapes double quotes", () => {
    expect(escapeXml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  test("escapes single quotes", () => {
    expect(escapeXml("it's")).toBe("it&apos;s");
  });

  test("handles all special chars together", () => {
    expect(escapeXml(`<a href="x" data='y'>&z`)).toBe(
      "&lt;a href=&quot;x&quot; data=&apos;y&apos;&gt;&amp;z",
    );
  });

  test("passes through safe strings unchanged", () => {
    expect(escapeXml("hello world 123")).toBe("hello world 123");
  });
});
