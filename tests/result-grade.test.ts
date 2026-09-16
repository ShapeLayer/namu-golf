import { expect, test } from "bun:test";
import { gradeResult } from "../src/client/result-grade";

test("grades successful results against the target depth", () => {
  expect(gradeResult(4, 5)).toEqual({ grade: "S+", tone: "yellow" });
  expect(gradeResult(5, 5)).toEqual({ grade: "S", tone: "yellow" });
  expect(gradeResult(6, 5)).toEqual({ grade: "A+", tone: "green" });
  expect(gradeResult(9, 5)).toEqual({ grade: "A+", tone: "green" });
  expect(gradeResult(10, 5)).toEqual({ grade: "A", tone: "green" });
  expect(gradeResult(14, 5)).toEqual({ grade: "A", tone: "green" });
  expect(gradeResult(15, 5)).toEqual({ grade: "B", tone: "blue" });
});
