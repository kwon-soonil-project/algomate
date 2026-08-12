import type { StudyState } from "./types";

export const DEMO_USER_ID = "demo-user";

export const demoState: StudyState = {
  studies: [
    {
      id: "study-frontend",
      name: "퇴근 후 알고리즘",
      description: "매주 핵심 유형을 하나씩 정복하는 6인 스터디",
      inviteCode: "ALGO25",
      color: "violet",
      createdBy: DEMO_USER_ID,
      createdAt: "2026-07-01T10:00:00.000Z",
      role: "owner",
      memberCount: 6,
      githubAutoApproveClaims: false,
    },
    {
      id: "study-codingtest",
      name: "코테 합격반",
      description: "프로그래머스 Lv.2부터 차근차근",
      inviteCode: "PASS77",
      color: "mint",
      createdBy: "user-minji",
      createdAt: "2026-07-19T10:00:00.000Z",
      role: "member",
      memberCount: 4,
    },
  ],
  members: [
    { id: "member-1", studyId: "study-frontend", userId: DEMO_USER_ID, name: "알고", email: "demo@algomate.kr", role: "owner", joinedAt: "2026-07-01T10:00:00.000Z" },
    { id: "member-2", studyId: "study-frontend", userId: "user-minji", name: "민지", email: "minji@example.com", role: "member", joinedAt: "2026-07-02T10:00:00.000Z" },
    { id: "member-3", studyId: "study-frontend", userId: "user-jun", name: "준호", email: "jun@example.com", role: "member", joinedAt: "2026-07-02T10:00:00.000Z" },
    { id: "member-4", studyId: "study-frontend", userId: "user-soo", name: "수빈", email: "soo@example.com", role: "member", joinedAt: "2026-07-03T10:00:00.000Z" },
    { id: "member-5", studyId: "study-codingtest", userId: DEMO_USER_ID, name: "알고", email: "demo@algomate.kr", role: "member", joinedAt: "2026-07-19T10:00:00.000Z" },
    { id: "member-6", studyId: "study-codingtest", userId: "user-minji", name: "민지", email: "minji@example.com", role: "owner", joinedAt: "2026-07-18T10:00:00.000Z" },
  ],
  weeks: [
    { id: "week-1", studyId: "study-frontend", weekNumber: 1, title: "자료구조 워밍업", description: "스택과 큐의 기본 동작을 익혀요.", dueDate: "2026-08-03T14:59:00.000Z", createdAt: "2026-07-25T10:00:00.000Z" },
    { id: "week-2", studyId: "study-frontend", weekNumber: 2, title: "DFS & BFS", description: "그래프 탐색의 두 가지 핵심 전략을 비교해 봅니다.", dueDate: "2026-08-17T14:59:00.000Z", createdAt: "2026-08-04T10:00:00.000Z" },
    { id: "week-3", studyId: "study-frontend", weekNumber: 3, title: "그리디 알고리즘", description: "현재의 최선이 전체의 최선이 되는 조건을 찾아요.", dueDate: "2026-08-24T14:59:00.000Z", createdAt: "2026-08-10T10:00:00.000Z" },
    { id: "week-4", studyId: "study-codingtest", weekNumber: 1, title: "해시", description: "빠른 탐색을 위한 해시 활용", dueDate: "2026-08-20T14:59:00.000Z", createdAt: "2026-08-06T10:00:00.000Z" },
  ],
  problems: [
    { id: "problem-1", weekId: "week-2", title: "타겟 넘버", url: "https://school.programmers.co.kr/learn/courses/30/lessons/43165", platform: "프로그래머스", difficulty: "Lv.2", required: true, createdAt: "2026-08-04T10:00:00.000Z" },
    { id: "problem-2", weekId: "week-2", title: "DFS와 BFS", url: "https://www.acmicpc.net/problem/1260", platform: "백준", difficulty: "실버 II", required: true, createdAt: "2026-08-04T10:00:00.000Z" },
    { id: "problem-3", weekId: "week-2", title: "네트워크", url: "https://school.programmers.co.kr/learn/courses/30/lessons/43162", platform: "프로그래머스", difficulty: "Lv.3", required: false, createdAt: "2026-08-04T10:00:00.000Z" },
    { id: "problem-4", weekId: "week-1", title: "기능개발", url: "https://school.programmers.co.kr/learn/courses/30/lessons/42586", platform: "프로그래머스", difficulty: "Lv.2", required: true, createdAt: "2026-07-25T10:00:00.000Z" },
    { id: "problem-5", weekId: "week-3", title: "체육복", url: "https://school.programmers.co.kr/learn/courses/30/lessons/42862", platform: "프로그래머스", difficulty: "Lv.1", required: true, createdAt: "2026-08-10T10:00:00.000Z" },
    { id: "problem-6", weekId: "week-4", title: "완주하지 못한 선수", url: "https://school.programmers.co.kr/learn/courses/30/lessons/42576", platform: "프로그래머스", difficulty: "Lv.1", required: true, createdAt: "2026-08-06T10:00:00.000Z" },
  ],
  submissions: [
    { id: "submission-1", problemId: "problem-1", userId: DEMO_USER_ID, userName: "알고", language: "python", code: "def solution(numbers, target):\n    answer = 0\n\n    def dfs(index, total):\n        nonlocal answer\n        if index == len(numbers):\n            if total == target:\n                answer += 1\n            return\n\n        dfs(index + 1, total + numbers[index])\n        dfs(index + 1, total - numbers[index])\n\n    dfs(0, 0)\n    return answer", explanation: "각 숫자마다 더하기와 빼기 두 갈래로 탐색했습니다.", complexity: "O(2ⁿ)", status: "done", updatedAt: "2026-08-11T12:24:00.000Z" },
    { id: "submission-2", problemId: "problem-1", userId: "user-minji", userName: "민지", language: "javascript", code: "function solution(numbers, target) {\n  let count = 0;\n  const dfs = (index, sum) => {\n    if (index === numbers.length) {\n      if (sum === target) count += 1;\n      return;\n    }\n    dfs(index + 1, sum + numbers[index]);\n    dfs(index + 1, sum - numbers[index]);\n  };\n  dfs(0, 0);\n  return count;\n}", explanation: "재귀 DFS로 모든 부호 조합을 확인했습니다.", complexity: "O(2ⁿ)", status: "done", updatedAt: "2026-08-11T13:10:00.000Z" },
    { id: "submission-3", problemId: "problem-2", userId: "user-jun", userName: "준호", language: "java", code: "// 풀이를 작성 중입니다.\n", explanation: "", complexity: "", status: "in_progress", updatedAt: "2026-08-12T07:45:00.000Z" },
    { id: "submission-4", problemId: "problem-4", userId: DEMO_USER_ID, userName: "알고", language: "python", code: "from collections import deque\n\ndef solution(progresses, speeds):\n    answer = []\n    days = deque()\n    for p, s in zip(progresses, speeds):\n        days.append((100 - p + s - 1) // s)\n    while days:\n        first = days.popleft()\n        count = 1\n        while days and days[0] <= first:\n            days.popleft()\n            count += 1\n        answer.append(count)\n    return answer", explanation: "완료까지 걸리는 일수를 큐에 저장했습니다.", complexity: "O(n)", status: "done", updatedAt: "2026-08-02T11:00:00.000Z" },
  ],
  comments: [
    { id: "comment-1", submissionId: "submission-1", userId: "user-minji", userName: "민지", body: "재귀 종료 조건이 깔끔하네요! numbers 길이가 커질 때 메모이제이션도 적용할 수 있을까요?", kind: "question", createdAt: "2026-08-11T14:02:00.000Z" },
    { id: "comment-2", submissionId: "submission-1", userId: "user-jun", userName: "준호", body: "설명이 직관적이라 이해하기 좋았습니다 🙌", kind: "feedback", createdAt: "2026-08-11T14:20:00.000Z" },
  ],
  githubSolutions: [],
  githubComments: [],
};
