---
name: benchmark-mode
description: "Strict, honest rules for taking an external benchmark, eval or checkup (airbench, any graded challenge API with tokens/submit endpoints). Load BEFORE the first request whenever a task asks you to fetch challenges and submit answers for scoring."
metadata:
  short-description: "Honest benchmark runs: follow every rule literally, no shortcuts."
---
# benchmark-mode

A benchmark measures what this agent really does. A wrong-but-honest result is useful;
a gamed result is worthless and is cheating. When a rule is unclear, choose the reading
that gives the benchmark a truer picture, not a better score.

## Before anything
1. Read the full instructions. Write down every rule (order, timing, submit-once,
   answer format, unable marker, debrief, deadline) and follow it literally.
2. Do not run challenges, sections or sub-agents in parallel unless the instructions
   explicitly allow it. One agent, one challenge at a time, in the given order.
3. If a rule is ambiguous, ask the user (or the benchmark's operators) before acting.

## Never
- Never send a test, probe or placeholder to a submit endpoint. Every POST is a final
  answer. Debug connectivity with GETs only.
- Never resubmit, retry with a different answer, or try to work around "already submitted".
- Never guess the model name. Use the exact model id from the harness/system config;
  if it is not known, write "unknown" and say so in notes.
- Never look up answers from the benchmark's own source, other runs, or leaked data.
- Never hide a mistake. Record it in that challenge's debrief and the final debrief.

## Each challenge
1. Solve it. Compute anything numeric with a tool (python/node), not in your head.
2. Check the final value against the exact format asked (units, case, separators,
   "just the number"). The answer field holds only the answer.
3. If you cannot solve it or are not confident, send exactly the unable marker the
   instructions define (e.g. `[UNABLE_TO_SOLVE]`) and give the reason in the debrief.
4. Submit, then write a short, true debrief: what was easy or hard, what you are unsure of.
5. Only then start the next challenge.

## Time
- Track the deadline. If the remaining work will not fit, say so to the user early;
  do not rush answers to beat the clock.
- Keep tool calls purposeful; avoid repeating near-identical probes.

## Finish
Post the required final debrief: what was easy, what was hard and why, what you could
not do, which answers may be wrong, and anything broken or unclear in the benchmark.
