import { NextRequest, NextResponse } from "next/server";
import { parseGitHubRepoUrl, parseStudyTree, type GitHubTreeItem } from "@/lib/github-import";
import type { GitHubImportEntry } from "@/lib/types";

export const runtime = "nodejs";

const githubHeaders: HeadersInit = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "AlgoMate-Importer",
};

function headers() {
  const result = new Headers(githubHeaders);
  if (process.env.GITHUB_TOKEN) result.set("Authorization", `Bearer ${process.env.GITHUB_TOKEN}`);
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("YOUR_PROJECT")) {
      const authorization = request.headers.get("authorization");
      if (!authorization) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: supabaseAnonKey, Authorization: authorization },
        cache: "no-store",
      });
      if (!authResponse.ok) return NextResponse.json({ error: "로그인 세션이 만료되었습니다." }, { status: 401 });
    }

    const body = await request.json();
    const { owner, repo, url } = parseGitHubRepoUrl(String(body.repoUrl ?? ""));
    const branch = String(body.branch || "main").trim();
    const rootPath = String(body.rootPath || "").trim();

    const treeResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers: headers(), cache: "no-store" },
    );

    if (treeResponse.status === 404) {
      return NextResponse.json({ error: "저장소나 브랜치를 찾을 수 없습니다. 비공개 저장소라면 GITHUB_TOKEN 설정을 확인해 주세요." }, { status: 404 });
    }
    if (!treeResponse.ok) {
      const remaining = treeResponse.headers.get("x-ratelimit-remaining");
      const message = remaining === "0" ? "GitHub 요청 한도를 초과했습니다. 잠시 후 다시 시도하거나 GITHUB_TOKEN을 설정해 주세요." : "GitHub 저장소를 읽지 못했습니다.";
      return NextResponse.json({ error: message }, { status: treeResponse.status });
    }

    const treeData = await treeResponse.json() as { tree?: GitHubTreeItem[]; truncated?: boolean };
    const files = parseStudyTree(treeData.tree ?? [], rootPath).slice(0, 200);
    if (!files.length) {
      return NextResponse.json({ error: "week01/문제폴더/이름.java 형태의 파일을 찾지 못했습니다." }, { status: 422 });
    }

    const entries: GitHubImportEntry[] = [];
    for (let index = 0; index < files.length; index += 10) {
      const chunk = files.slice(index, index + 10);
      const loaded = await Promise.all(chunk.map(async (file) => {
        const contentResponse = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${file.filePath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
          { headers: new Headers({ ...Object.fromEntries(headers()), Accept: "application/vnd.github.raw+json" }), cache: "no-store" },
        );
        if (!contentResponse.ok) return null;
        const code = await contentResponse.text();
        return {
          ...file,
          code,
          htmlUrl: `${url}/blob/${encodeURIComponent(branch)}/${file.filePath.split("/").map(encodeURIComponent).join("/")}`,
        } satisfies GitHubImportEntry;
      }));
      entries.push(...loaded.filter((entry): entry is GitHubImportEntry => entry !== null));
    }

    return NextResponse.json({ repoUrl: url, branch, rootPath, truncated: Boolean(treeData.truncated), entries });
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "가져오기에 실패했습니다." }, { status: 400 });
  }
}
