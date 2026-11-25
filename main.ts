// Famous Last Words: The Funniest Epitaph
// Entry program (program/v1, Node 22).
//
// The program composes a pool of original one-line epitaphs (all written
// for this entry, none copied from examples), scores each one against the
// judge's published criteria, and writes the winning line — exactly one
// line, no trailing newline — to /output/entry.txt.
//
// Deterministic: no network, no randomness, no environment secrets, no
// files read from outside this repository. The same input always yields
// the same winning line.

import { mkdirSync, writeFileSync } from "node:fs";

const MAX_CHARS = 150;
const OUT_DIR = "/output";
const OUT_FILE = "/output/entry.txt";

// ---------------------------------------------------------------------------
// Candidate pool. Every line below is an original epitaph drafted for this
// bounty. Design rules each candidate was written against:
//   * one sentence or two short sentences, one line, no stage directions;
//   * a genuine joke with a twist that lands on the final word(s);
//   * reads like something actually carved on a stone, not explained;
//   * short enough to repeat to a friend from memory.
// Banned on purpose: "I told you I was sick", "Here lies...", generic
// "RIP", and generic doctor jokes — all well-worn, all unoriginal.
// ---------------------------------------------------------------------------

type Candidate = {
  text: string;
  // Short note on where the joke turns, used by the scorer.
  twist: "final-word" | "final-clause" | "implicit";
  // How the line speaks: dying speech in the first person, the stone
  // speaking for the dead, or a bare statement about the dead.
  voice: "last-words" | "stone-speaks" | "third-person" | "bare";
};

const CANDIDATES: Candidate[] = [
  {
    text: "My last words were 'what's the worst that could happen?' This.",
    twist: "final-word",
    voice: "last-words",
  },
  {
    text: "My last words were 'watch this.' You're reading the result.",
    twist: "final-clause",
    voice: "last-words",
  },
  {
    text: "Finally out of the group chat.",
    twist: "implicit",
    voice: "bare",
  },
  {
    text: "He finally won the argument. He can't tell anyone.",
    twist: "final-clause",
    voice: "third-person",
  },
  {
    text: "I died doing what I loved: ignoring the warning label.",
    twist: "final-clause",
    voice: "stone-speaks",
  },
  {
    text: "Turns out 'forever' ends on a Tuesday.",
    twist: "final-clause",
    voice: "bare",
  },
  {
    text: "Yes, I'm dead. No, you can't have my parking spot.",
    twist: "final-clause",
    voice: "stone-speaks",
  },
  {
    text: "He read the terms and conditions. All of them. Still clicked agree.",
    twist: "final-clause",
    voice: "third-person",
  },
];

// Phrases that would mark a line as a copy of a circulating epitaph joke.
const BANNED_PHRASES = [
  "i told you i was sick",
  "here lies",
  "rest in peace",
  "r.i.p.",
  "gone but not forgotten",
];

// ---------------------------------------------------------------------------
// Scoring. Mirrors the judge's brief, most important first:
//   1. is a one-line epitaph of famous last words (voice);
//   2. earns a real laugh (twist that lands cleanly at the end);
//   3. turns on a surprise / double meaning (punch placement);
//   4. reads carved in stone (short, no explanation, addresses the reader);
//   5. stays in the head (short, concrete, quotable).
// ---------------------------------------------------------------------------

function lengthScore(text: string): number {
  const n = [...text].length;
  if (n >= 40 && n <= 90) return 30; // sweet spot: long enough to joke, short enough to carve
  if (n >= 91 && n <= 120) return 22;
  if (n >= 20 && n < 40) return 20;
  if (n > 120) return 12;
  return 8;
}

function voiceScore(voice: Candidate["voice"]): number {
  switch (voice) {
    case "last-words": return 20; // literally framed as dying speech
    case "stone-speaks": return 15; // the stone answers the visitor
    case "third-person": return 12; // classic epitaph voice
    case "bare": return 6;
  }
}

function twistScore(c: Candidate): number {
  switch (c.twist) {
    // A one-word punch is sharp, but a deictic punch ("This.") makes the
    // reader resolve a reference: the judge's brief says a line that needs
    // an explanation to land has not landed, so it scores below a punch
    // clause that lands on its own.
    case "final-word": return 22;
    case "final-clause": return 25; // punch clause reframes everything before it
    case "implicit": return 12; // reader must supply the twist themselves
  }
}

function readerScore(text: string): number {
  // A stone that talks back to whoever reads it feels carved, not narrated.
  const lower = text.toLowerCase();
  if (/\byou('re| are)?\b/.test(lower) || /\bthis\.$/.test(lower)) return 10;
  return 0;
}

function memorabilityScore(text: string): number {
  const n = [...text].length;
  // Short, concrete, no filler words: easy to repeat to a friend.
  const filler = (text.toLowerCase().match(/\b(very|really|just|actually)\b/g) ?? []).length;
  if (n <= 70 && filler === 0) return 10;
  if (n <= 100 && filler === 0) return 6;
  return 2;
}

function clichePenalty(text: string): number {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.some((p) => lower.includes(p)) ? -40 : 0;
}

type Scored = { candidate: Candidate; total: number; parts: Record<string, number> };

function scoreCandidate(c: Candidate): Scored {
  const parts = {
    length: lengthScore(c.text),
    voice: voiceScore(c.voice),
    twist: twistScore(c),
    reader: readerScore(c.text),
    memorable: memorabilityScore(c.text),
    cliche: clichePenalty(c.text),
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { candidate: c, total, parts };
}

// Deterministic pick: highest total; ties break to the shorter line,
// then to the earliest candidate in the list. No randomness anywhere.
function pickWinner(scored: Scored[]): Scored {
  const ranked = [...scored].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const la = [...a.candidate.text].length;
    const lb = [...b.candidate.text].length;
    if (la !== lb) return la - lb;
    return CANDIDATES.indexOf(a.candidate) - CANDIDATES.indexOf(b.candidate);
  });
  return ranked[0];
}

// ---------------------------------------------------------------------------
// Gate validation: the same checks the sealed scorer applies.
// ---------------------------------------------------------------------------

function validate(text: string): string[] {
  const problems: string[] = [];
  const chars = [...text];
  if (chars.length < 1 || chars.length > MAX_CHARS) {
    problems.push(`length ${chars.length} is outside 1-${MAX_CHARS} characters`);
  }
  if (text.trim().length === 0) problems.push("line is only whitespace");
  if (text.includes("\n") || text.includes("\r")) {
    problems.push("line contains a newline");
  }
  // Must be valid UTF-8: a round trip through TextEncoder/TextDecoder.
  const roundTripped = new TextDecoder("utf-8", { fatal: true }).decode(
    new TextEncoder().encode(text),
  );
  if (roundTripped !== text) problems.push("line is not valid UTF-8");
  return problems;
}

function main(): void {
  const scored = CANDIDATES.map(scoreCandidate);

  for (const s of scored) {
    console.log(
      `[${String(s.total).padStart(3, " ")}] ${s.candidate.text} ` +
        `(len=${[...s.candidate.text].length} ` +
        `len=${s.parts.length} voice=${s.parts.voice} twist=${s.parts.twist} ` +
        `reader=${s.parts.reader} mem=${s.parts.memorable} cliche=${s.parts.cliche})`,
    );
  }

  const winner = pickWinner(scored);
  const line = winner.candidate.text;

  const problems = validate(line);
  if (problems.length > 0) {
    throw new Error(`winning line failed validation: ${problems.join("; ")}`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  // Exactly one line: write the text with NO trailing newline, so the
  // gate counts precisely the characters of the epitaph itself.
  writeFileSync(OUT_FILE, line, "utf8");

  console.log(`\nWinner (${[...line].length} chars): ${line}`);
  console.log(`Wrote ${OUT_FILE}`);
}

main();
