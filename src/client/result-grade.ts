export type ResultGrade = "S+" | "S" | "A+" | "A" | "B";
export type ResultGradeTone = "yellow" | "green" | "blue";

export interface GradedResult {
  grade: ResultGrade;
  tone: ResultGradeTone;
}

/** 목표 깊이와 실제 이동 횟수로 성공 등급 계산 */
export function gradeResult(moves: number, targetDepth: number): GradedResult {
  if (moves < targetDepth) return { grade: "S+", tone: "yellow" };
  if (moves === targetDepth) return { grade: "S", tone: "yellow" };
  if (moves < targetDepth + 5) return { grade: "A+", tone: "green" };
  if (moves < targetDepth + 10) return { grade: "A", tone: "green" };
  return { grade: "B", tone: "blue" };
}
