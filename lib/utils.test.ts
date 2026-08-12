import { describe, expect, it } from "vitest";
import { cn, initials, languageExtension, platformFromUrl } from "./utils";

describe("utility helpers", () => {
  it("joins conditional class names", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b");
  });

  it("builds compact initials", () => {
    expect(initials("김 알고")).toBe("김알");
  });

  it("maps code languages to file extensions", () => {
    expect(languageExtension("python")).toBe("py");
    expect(languageExtension("unknown")).toBe("txt");
  });

  it("detects algorithm platforms", () => {
    expect(platformFromUrl("https://school.programmers.co.kr/learn/courses/30/lessons/42576")).toBe("프로그래머스");
    expect(platformFromUrl("https://www.acmicpc.net/problem/1260")).toBe("백준");
  });
});
