import { describe, expect, it } from "vitest";
import { SESSION_COOKIE, SESSION_MAX_AGE, isSessionId } from "@/lib/session";

describe("isSessionId", () => {
  /*
   * The cookie comes back from the browser, so it is input. Anything that gets
   * past this flows into a `varchar(64)` column and into `WHERE session_id = …`,
   * which is why the check is a whitelist of the exact shape proxy mints rather
   * than a length cap.
   */
  it("accepts the UUID proxy mints", () => {
    expect(isSessionId(crypto.randomUUID())).toBe(true);
    expect(isSessionId("6BA7B810-9DAD-11D1-80B4-00C04FD430C8")).toBe(true);
  });

  it("rejects anything that is not one", () => {
    for (const value of [
      undefined,
      null,
      "",
      "not-a-uuid",
      // Right shape, wrong alphabet.
      "zzzzzzzz-9dad-11d1-80b4-00c04fd430c8",
      // Right prefix, trailing payload — the case a `startsWith` check misses.
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8' OR '1'='1",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c",
      " 6ba7b810-9dad-11d1-80b4-00c04fd430c8 ",
    ]) {
      expect(isSessionId(value), String(value)).toBe(false);
    }
  });

  it("rejects a value long enough to overflow the column", () => {
    expect(isSessionId("a".repeat(500))).toBe(false);
  });
});

describe("session constants", () => {
  it("uses a name that cannot collide with UploadThing's or Next's own", () => {
    expect(SESSION_COOKIE).toBe("hhg_sid");
  });

  it("outlives the tab the pass was made in", () => {
    expect(SESSION_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });
});
