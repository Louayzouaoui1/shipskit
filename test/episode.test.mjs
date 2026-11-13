import assert from "node:assert/strict";
import { test } from "node:test";
import { problems } from "../lib/episode.mjs";

const good = {
  title: "A fix",
  lines: [
    { who: "dev", text: "It crashed!", act: "panic", screen: { state: "crash", lines: ["✗ CRASH"] } },
    { who: "bot", text: "Fixed it.", act: "proud", shot: "screen", screen: { state: "diff", lines: ["- a", "+ b"] } },
  ],
};

test("a correct episode has no problems", () => assert.deepEqual(problems(good), []));
test("mistakes are named", () => {
  const bad = structuredClone(good);
  bad.lines[0].act = "explain"; // a robot act on the developer
  bad.lines[1].screen.lines[0] = "x".repeat(31);
  bad.lines[1].typo = 1;
  assert.equal(problems(bad).length, 3);
});
test("a screen shot needs words on the screen", () => {
  const bad = structuredClone(good);
  bad.lines[1].screen = { state: "code" };
  assert.match(problems(bad).join(), /no words to show/);
});
