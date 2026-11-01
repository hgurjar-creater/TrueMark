# Creator test protocol — Round 3, commitment 2

Measures whether TrueMark's suggested changes **preserve the creator's intent**.
Target: at least 60% of suggestions are **accepted or lightly edited** across
five creator tests. The sample size, method and limitations are reported with
the result — this is a small usability study, not a statistical benchmark.

## Participants

Five people who write content for a club, small business or study project.
They should not be members of the TrueMark team. Record for each: name or
initials, background, and whether they have used the product before.

## Setup per participant

1. A clean workspace with the seeded demo guidance (8 approved rules, 5 facts,
   6 terms) and the participant registered as a **Creator**.
2. One prepared draft (~100–150 words) containing 3–5 realistic issues the
   approved guidance flags. Do not tell the participant which issues were
   planted.
3. A timer and a note-taker (or screen recording).

## Tasks given to the participant (verbatim)

1. "Sign in and open the submission that is waiting for you."
2. "Read the review findings. For each one, decide what a careful creator
   would do: accept the suggested change, edit it, or dismiss it with a
   reason — exactly as you would for real content you are about to publish."
3. "When you are done, tell us in one or two sentences whether the suggested
   changes kept what you were trying to say."

## What to record (one JSON entry per participant)

- `participant`: initials or pseudonym, `background`, `priorUse`
- `startedAt` / `completedAt`: ISO timestamps (used for completion time)
- `suggestions`: one row per suggested change shown, with
  `decision: ACCEPTED | EDITED | DISMISSED` and what was changed
- `intentPreserved`: participant's own answer for task 3 (`yes | partly | no`)
  plus a short quote
- `feedback`: anything else they said (confusion, missing context, praise)

## Definition used for the rate

`acceptedOrLightlyEdited` = suggestions with decision `ACCEPTED` or `EDITED`
where the recorded edit keeps the suggested fix's substance. Dismissals count
against the rate even when justified — the target measures how often the
suggestion itself was usable.

## Reporting

Run `node scripts/creator-test-report.mjs` after the five sessions. It
validates the JSON, computes the acceptance rate, per-participant completion
times and the intent-preservation answers, and writes
`evaluation/creator-test-results.json` for the final PDF.

## Limitations to state in the report

Five participants and one prepared draft per session; the facilitator was
present; the guidance set is the demo library. The result indicates usability
of the suggestion feature for this sample and is not a general accuracy claim.
