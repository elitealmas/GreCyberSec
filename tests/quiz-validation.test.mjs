import assert from "node:assert/strict";
import test from "node:test";
import { hasValidQuizSubmissionInput, quizMatchesCourseContext } from "../lib/quiz-validation.ts";

const quizId = "91a1a312-48dd-4c6b-904b-ec99cf432e9b";
const courseId = "0239ee1e-81c8-42b0-afaa-cf8790680a29";
const moduleId = "744ecfbc-805c-419d-846b-0d90f6e91b0b";

test("allows syntactically valid course and module quiz submissions", () => {
  assert.equal(hasValidQuizSubmissionInput("networking-for-cybersecurity", quizId, "network-basics"), true);
  assert.equal(quizMatchesCourseContext({ courseId, quiz: { course_id: courseId, module_id: moduleId }, moduleSlug: "network-basics", moduleId }), true);
  assert.equal(quizMatchesCourseContext({ courseId, quiz: { course_id: courseId, module_id: null }, moduleSlug: "", moduleId: null }), true);
});

test("rejects malformed and nonexistent module slugs", () => {
  assert.equal(hasValidQuizSubmissionInput("networking-for-cybersecurity", quizId, "not_a_slug"), false);
  assert.equal(quizMatchesCourseContext({ courseId, quiz: { course_id: courseId, module_id: null }, moduleSlug: "missing-module", moduleId: null }), false);
});

test("rejects quiz course and module mismatches", () => {
  assert.equal(quizMatchesCourseContext({ courseId, quiz: { course_id: "d0e4be95-d34a-4637-9c17-82ec040022c0", module_id: moduleId }, moduleSlug: "network-basics", moduleId }), false);
  assert.equal(quizMatchesCourseContext({ courseId, quiz: { course_id: courseId, module_id: "780a39df-3aac-4d68-8ef9-7f24d7543bd6" }, moduleSlug: "network-basics", moduleId }), false);
});
