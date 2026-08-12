export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function makeInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function languageExtension(language: string) {
  const extensions: Record<string, string> = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    java: "java",
    cpp: "cpp",
    c: "c",
    kotlin: "kt",
    go: "go",
    rust: "rs",
  };
  return extensions[language] ?? "txt";
}

export function platformFromUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("programmers")) return "프로그래머스";
    if (host.includes("swea")) return "SWEA";
    if (host.includes("acmicpc") || host.includes("boj")) return "백준";
    if (host.includes("leetcode")) return "LeetCode";
    return host.replace("www.", "");
  } catch {
    return "외부 문제";
  }
}
