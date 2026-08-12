import type { GitHubImportEntry } from "./types";

const extensionLanguages: Record<string, string> = {
  java: "java",
  py: "python",
  js: "javascript",
  ts: "typescript",
  cpp: "cpp",
  cc: "cpp",
  c: "c",
  kt: "kotlin",
  go: "go",
  rs: "rust",
};

export interface GitHubTreeItem {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

export interface ParsedGitHubFile {
  weekNumber: number;
  problemKey: string;
  problemTitle: string;
  problemUrl: string;
  authorLabel: string;
  language: string;
  filePath: string;
  blobSha: string;
}

export function parseGitHubRepoUrl(value: string) {
  const trimmed = value.trim().replace(/\.git$/, "");
  const match = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/i);
  if (!match) throw new Error("https://github.com/owner/repository 형식으로 입력해 주세요.");
  return { owner: match[1], repo: match[2], url: `https://github.com/${match[1]}/${match[2]}` };
}

export function problemMetadata(problemKey: string) {
  const normalized = problemKey.trim();
  const swea = normalized.match(/^swea[-_ ]?(\d+)$/i);
  if (swea) return { title: `SWEA ${swea[1]}`, url: "https://swexpertacademy.com/main/code/problem/problemList.do" };
  const boj = normalized.match(/^(?:boj|baekjoon)[-_ ]?(\d+)$/i);
  if (boj) return { title: `백준 ${boj[1]}번`, url: `https://www.acmicpc.net/problem/${boj[1]}` };
  const programmers = normalized.match(/^(?:programmers|pg)[-_ ]?(\d+)$/i);
  if (programmers) return { title: `프로그래머스 ${programmers[1]}`, url: `https://school.programmers.co.kr/learn/courses/30/lessons/${programmers[1]}` };
  return { title: normalized.replace(/[-_]/g, " "), url: "https://github.com" };
}

export function parseStudyTree(tree: GitHubTreeItem[], rootPath = "") {
  const root = rootPath.trim().replace(/^\/+|\/+$/g, "");
  const prefix = root ? `${root}/` : "";
  const parsed: ParsedGitHubFile[] = [];

  for (const item of tree) {
    if (item.type !== "blob" || !item.path.startsWith(prefix)) continue;
    const relative = item.path.slice(prefix.length);
    const parts = relative.split("/");
    if (parts.length !== 3) continue;
    const weekMatch = parts[0].match(/^week[-_ ]?0*(\d+)$/i);
    if (!weekMatch) continue;
    const fileMatch = parts[2].match(/^(.+)\.([a-z0-9]+)$/i);
    if (!fileMatch) continue;
    const language = extensionLanguages[fileMatch[2].toLowerCase()];
    if (!language) continue;
    if ((item.size ?? 0) > 500_000) continue;
    const metadata = problemMetadata(parts[1]);
    parsed.push({
      weekNumber: Number(weekMatch[1]),
      problemKey: parts[1],
      problemTitle: metadata.title,
      problemUrl: metadata.url,
      authorLabel: fileMatch[1],
      language,
      filePath: item.path,
      blobSha: item.sha,
    });
  }
  return parsed;
}

export function makeSampleGitHubEntries(repoUrl: string, branch: string): GitHubImportEntry[] {
  const samples = [
    { week: 1, key: "swea1529", author: "minji", code: "import java.util.*;\n\npublic class Minji {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        System.out.println(n);\n    }\n}" },
    { week: 1, key: "swea1529", author: "junho", code: "import java.io.*;\n\npublic class Junho {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        int n = Integer.parseInt(br.readLine());\n        System.out.println(n);\n    }\n}" },
    { week: 2, key: "boj1260", author: "minji", code: "import java.util.*;\n\npublic class Minji {\n    static boolean[] visited;\n    static List<Integer>[] graph;\n\n    static void dfs(int node) {\n        visited[node] = true;\n        for (int next : graph[node]) if (!visited[next]) dfs(next);\n    }\n}" },
  ];
  return samples.map((sample) => {
    const metadata = problemMetadata(sample.key);
    const filePath = `week${String(sample.week).padStart(2, "0")}/${sample.key}/${sample.author}.java`;
    return {
      weekNumber: sample.week,
      problemKey: sample.key,
      problemTitle: metadata.title,
      problemUrl: metadata.url,
      authorLabel: sample.author,
      language: "java",
      code: sample.code,
      filePath,
      htmlUrl: `${repoUrl}/blob/${branch}/${filePath}`,
      blobSha: `sample-${sample.week}-${sample.key}-${sample.author}`,
    };
  });
}
