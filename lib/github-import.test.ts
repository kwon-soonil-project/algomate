import { describe, expect, it } from "vitest";
import { parseGitHubRepoUrl, parseStudyTree, problemMetadata } from "./github-import";

describe("GitHub study importer", () => {
  it("parses a standard GitHub repository URL", () => {
    expect(parseGitHubRepoUrl("https://github.com/team/algostudy.git")).toEqual({ owner: "team", repo: "algostudy", url: "https://github.com/team/algostudy" });
  });

  it("maps week/problem/member files from the team convention", () => {
    const result = parseStudyTree([
      { path: "week01/swea1529/minji.java", type: "blob", sha: "abc", size: 1200 },
      { path: "week02/boj1260/junho.py", type: "blob", sha: "def", size: 900 },
      { path: "README.md", type: "blob", sha: "nope", size: 20 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ weekNumber: 1, problemKey: "swea1529", authorLabel: "minji", language: "java" });
    expect(result[1]).toMatchObject({ weekNumber: 2, problemKey: "boj1260", authorLabel: "junho", language: "python" });
  });

  it("supports a member directory containing nested source files", () => {
    const result = parseStudyTree([
      { path: "solutions/week01/swea1529/minji/Main.java", type: "blob", sha: "abc", size: 1200 },
      { path: "solutions/week01/swea1529/junho/src/Solution.java", type: "blob", sha: "def", size: 900 },
      { path: "solutions/week01/swea1529/minji/build/Main.class", type: "blob", sha: "skip", size: 900 },
    ], "solutions");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ authorLabel: "minji", filePath: "solutions/week01/swea1529/minji/Main.java" });
    expect(result[1]).toMatchObject({ authorLabel: "junho", filePath: "solutions/week01/swea1529/junho/src/Solution.java" });
  });

  it("does not truncate repositories with more than 200 solution files", () => {
    const tree = Array.from({ length: 250 }, (_, index) => ({
      path: `week01/swea1529/member${index}.java`,
      type: "blob" as const,
      sha: `sha-${index}`,
      size: 100,
    }));

    expect(parseStudyTree(tree)).toHaveLength(250);
  });

  it("creates known platform metadata", () => {
    expect(problemMetadata("boj1260").url).toBe("https://www.acmicpc.net/problem/1260");
    expect(problemMetadata("programmers42576").title).toBe("프로그래머스 42576");
  });
});
