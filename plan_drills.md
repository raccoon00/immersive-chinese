Below is a complete implementation plan for the MVP.

## 1. Product definition

Build a **translation-prompted Hanzi recall widget**.

The user is given a list of pairs:

```ts id="d8j11c"
{
  hanzi: "学生",
  translation: "student"
}
```

During the attempt, the user sees only:

```text id="o4bn7c"
student
[blank white drawing square]
```

The user does not know:

```text id="cvu1nk"
学生
number of characters = 2
```

They draw one character at a time. Pressing **Draw next** moves the current canvas to the left as a small preview and opens a new blank square. Pressing **Finish** freezes the attempt and only then starts validation.

---

## 2. Recommended stack

Use:

```text id="s924a4"
SvelteKit + TypeScript + Canvas/SVG + local static Hanzi data
```

Svelte supports TypeScript inside components, and SvelteKit can be built as a static site with `adapter-static`, which is enough for this first personal app. ([svelte.dev][1])

Recommended packages:

```bash id="ux1aju"
npm create svelte@latest hanzi-practice
cd hanzi-practice
npm install
npm install hanzi-writer-data
npm install -D vitest
```

You may install `hanzi-writer` too, but for this app I would use its **data**, not its quiz engine. Hanzi Writer is an open-source JavaScript library for stroke-order animations and quizzes, and its data comes from Make Me a Hanzi. ([hanziwriter.org][2])

---

## 3. Data sources

### 3.1 User word list

Your primary learning data is user-provided:

```csv id="zec4fc"
hanzi,translation
学生,student
老师,teacher
猫,cat
```

Initial format options:

```text id="9jh2lg"
Option A: public/cards.csv
Option B: src/lib/data/cards.json
Option C: user pastes list into UI
```

For the MVP, use a static file:

```ts id="xjczz9"
export type WordCard = {
  id: string;
  hanzi: string;
  translation: string;
  tags?: string[];
};
```

### 3.2 Stroke-order character data

Use `hanzi-writer-data`.

The `hanzi-writer-data` repository provides the character data used by Hanzi Writer, can be installed via npm, and can also be loaded from jsDelivr CDN. ([GitHub][3])

The underlying Make Me a Hanzi dataset provides graphical data for over 9000 common simplified and traditional Chinese characters. Its `graphics.txt` data contains ordered SVG stroke paths and stroke medians. ([GitHub][4])

The relevant fields are:

```ts id="lwh9mj"
type RawHanziWriterData = {
  strokes: string[];      // SVG path data, ordered by correct stroke order
  medians: number[][][];  // one polyline per stroke
};
```

Make Me a Hanzi states that `strokes` are SVG path data ordered by proper stroke order, and `medians` are stroke centerlines in the same coordinate system. ([GitHub][4])

The stroke graphics use a 1024×1024 coordinate system with an inverted y-axis convention, so preprocess them into normal canvas coordinates before comparing user strokes. ([GitHub][4])

### 3.3 Licensing note

The Hanzi Writer character data is licensed separately from the Hanzi Writer source code, and the character graphics data is redistributed under the Arphic Public License. ([GitHub][3])

For a private personal app, this is probably fine. For publishing, include the license file and attribution.

---

## 4. Core requirements

### Functional requirements

| ID  | Requirement                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------- |
| R1  | Load a list of `{ hanzi, translation }` cards.                                                                              |
| R2  | Randomize card order.                                                                                                       |
| R3  | Show only the translation during the attempt.                                                                               |
| R4  | Hide the Hanzi and hide word length during the attempt.                                                                     |
| R5  | Let the user draw one character per white square.                                                                           |
| R6  | Let the user press **Draw next** without validation.                                                                        |
| R7  | Shrink completed character canvases and place them to the left.                                                             |
| R8  | Let the user press **Finish** at any point.                                                                                 |
| R9  | Only after **Finish**, compare the full attempt to the hidden Hanzi.                                                        |
| R10 | Detect missing characters, extra characters, wrong stroke count, wrong stroke order, wrong direction, and bad stroke shape. |
| R11 | Highlight missed target stroke regions.                                                                                     |
| R12 | Reveal the correct Hanzi after validation.                                                                                  |
| R13 | Store basic local progress.                                                                                                 |

### Non-functional requirements

| ID | Requirement                                                         |
| -- | ------------------------------------------------------------------- |
| N1 | Must work offline after build.                                      |
| N2 | Must work with mouse, touch, and stylus.                            |
| N3 | Drawing should feel immediate; no server roundtrips.                |
| N4 | Validation should be deterministic and debuggable.                  |
| N5 | Matching thresholds should be configurable.                         |
| N6 | Core algorithms should be framework-independent TypeScript modules. |

---

## 5. High-level architecture

```text id="m0egjv"
Word cards
   ↓
Card queue / randomizer
   ↓
Practice session state machine
   ↓
Drawing components
   ↓
Raw user strokes
   ↓
Finish pressed
   ↓
Batch validator
   ↓
Character-level feedback
   ↓
Word-level result
   ↓
Progress storage
```

Keep the app split into three layers:

```text id="zgb46t"
UI layer:
  Svelte components

Domain layer:
  practice state, validation, scoring

Data layer:
  word cards, preprocessed Hanzi stroke data, local progress
```

---

## 6. Project structure

```text id="u4t1bu"
src/
  routes/
    +page.svelte

  lib/
    data/
      cards.ts
      generated/
        hanziStrokeData.ts

    practice/
      types.ts
      createQueue.ts
      practiceMachine.ts
      validateWordAttempt.ts

    hanzi/
      types.ts
      loadHanziData.ts
      normalizeHanziData.ts
      preprocessHanziData.ts

    drawing/
      types.ts
      pointerCapture.ts
      strokeProcessing.ts
      geometry.ts

    scoring/
      compareStroke.ts
      compareCharacter.ts
      alignStrokes.ts
      classifyErrors.ts
      thresholds.ts

    components/
      HiddenWordPractice.svelte
      TranslationPrompt.svelte
      DrawingCanvas.svelte
      AttemptStrip.svelte
      MiniCharacterPreview.svelte
      PracticeControls.svelte
      ResultView.svelte
      CharacterFeedback.svelte

scripts/
  build-hanzi-data.ts
```

---

## 7. Main TypeScript interfaces

### Cards

```ts id="u21mjm"
export type WordCard = {
  id: string;
  hanzi: string;
  translation: string;
  tags?: string[];
};
```

### Geometry

```ts id="u5zghm"
export type Point = {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  t?: number;
  pressure?: number;
};

export type Polyline = Point[];
```

### Target Hanzi data

```ts id="dylxqn"
export type TargetStroke = {
  index: number;
  svgPath: string;
  medianRaw: number[][];
  median: Polyline;       // normalized 0..1
  resampled: Polyline;    // fixed-length representation
};

export type TargetCharacter = {
  char: string;
  strokes: TargetStroke[];
};
```

### User attempt

```ts id="bfg4iw"
export type UserStroke = {
  points: Polyline;
  processed?: Polyline;
};

export type UserCharacterAttempt = {
  id: string;
  strokes: UserStroke[];
};

export type WordAttempt = {
  cardId: string;
  characters: UserCharacterAttempt[];
};
```

### Validation result

```ts id="58ibou"
export type StrokeMatchStatus =
  | "matched"
  | "bad_shape"
  | "wrong_direction"
  | "missing"
  | "extra";

export type StrokeValidationResult = {
  status: StrokeMatchStatus;
  targetStrokeIndex?: number;
  userStrokeIndex?: number;
  score?: number;
  missedSegments?: Array<{ from: Point; to: Point }>;
};

export type CharacterValidationResult = {
  targetChar: string;
  userCharacterIndex: number;
  status: "ok" | "bad" | "missing" | "extra";
  strokeResults: StrokeValidationResult[];
  totalScore: number;
};

export type WordValidationResult = {
  status: "ok" | "missing_characters" | "extra_characters" | "bad_characters";
  targetHanzi: string;
  userCharacterCount: number;
  targetCharacterCount: number;
  characterResults: CharacterValidationResult[];
};
```

---

## 8. State machine

The widget should have four states:

```ts id="v80sr2"
type PracticeMode =
  | "loading"
  | "attempting"
  | "validating"
  | "result";
```

Session state:

```ts id="p5dz1s"
type PracticeSession = {
  mode: PracticeMode;
  queue: WordCard[];
  currentCard: WordCard;
  activeCharacterIndex: number;
  characters: UserCharacterAttempt[];
  result?: WordValidationResult;
};
```

Transitions:

```text id="mh4648"
loading
  ↓ data loaded
attempting
  ↓ Finish
validating
  ↓ validation complete
result
  ↓ Next card
attempting
```

Important rule:

```text id="wffufr"
Draw next:
  saves current canvas
  creates a new blank character canvas
  performs no similarity check

Finish:
  saves current canvas
  freezes the full attempt
  runs validation
```

---

## 9. Component responsibilities

### `HiddenWordPractice.svelte`

Top-level orchestrator.

Responsibilities:

```text id="rwbxme"
- Own current PracticeSession
- Load next card
- Pass active character attempt to DrawingCanvas
- Handle Draw next
- Handle Finish
- Call validateWordAttempt
- Show ResultView after validation
```

Connections:

```text id="l0m8a8"
HiddenWordPractice
  → TranslationPrompt
  → AttemptStrip
  → DrawingCanvas
  → PracticeControls
  → ResultView
```

### `TranslationPrompt.svelte`

Displays only the translation.

```ts id="beh7vd"
export let translation: string;
```

### `DrawingCanvas.svelte`

Captures raw strokes.

Responsibilities:

```text id="xnlnnb"
- Handle pointerdown / pointermove / pointerup
- Store current stroke
- Draw current strokes
- Emit updated UserCharacterAttempt
- Support undo stroke and clear
```

Use pointer events, not mouse-only events.

```ts id="kjyxht"
type DrawingCanvasEvents = {
  change: UserCharacterAttempt;
};
```

### `AttemptStrip.svelte`

Shows previous character boxes as small previews.

```ts id="8zdxtd"
export let characters: UserCharacterAttempt[];
export let activeCharacterIndex: number;
```

### `PracticeControls.svelte`

Buttons:

```text id="kkdtu3"
Undo stroke
Clear current
Remove character
Draw next
Finish
```

### `ResultView.svelte`

Shows:

```text id="e5se2o"
- Correct Hanzi
- User attempt previews
- Per-character result
- Per-stroke result
- Missed-stroke highlights
```

---

## 10. Data preprocessing plan

### Input

```text id="2v8rq0"
src/lib/data/cards.ts
```

Example:

```ts id="ivmfve"
export const cards = [
  { id: "xuesheng", hanzi: "学生", translation: "student" },
  { id: "laoshi", hanzi: "老师", translation: "teacher" },
];
```

### Step 1: Extract unique characters

```ts id="wth29e"
const chars = new Set(cards.flatMap(card => Array.from(card.hanzi)));
```

Use `Array.from`, not `split("")`, because some CJK extension characters may be surrogate pairs.

### Step 2: Load character JSON from `hanzi-writer-data`

For each unique character:

```ts id="951mj9"
import charData from "hanzi-writer-data/学.json";
```

Dynamic imports from `node_modules` can be annoying in Vite, so for the MVP use a Node preprocessing script.

### Step 3: Normalize target medians

Make Me a Hanzi medians use the same coordinate system as the SVG paths. The SVG display transform maps the data into a normal 1024×1024 view box. ([GitHub][4])

Use:

```ts id="2scs6k"
function normalizeTargetPoint([x, y]: [number, number]): Point {
  return {
    x: x / 1024,
    y: (900 - y) / 1024,
  };
}
```

### Step 4: Resample every target median

Precompute fixed-length versions:

```ts id="a0b0sa"
const RESAMPLED_POINTS = 64;
```

Each target stroke gets:

```ts id="25fps1"
{
  median,
  resampled: resampleByArcLength(median, 64)
}
```

### Step 5: Generate static app data

Output:

```text id="vzm8i1"
src/lib/data/generated/hanziStrokeData.ts
```

Example shape:

```ts id="odawze"
export const hanziStrokeData: Record<string, TargetCharacter> = {
  "学": {
    char: "学",
    strokes: [...]
  },
  "生": {
    char: "生",
    strokes: [...]
  }
};
```

---

## 11. Drawing capture algorithm

Inside `DrawingCanvas.svelte`:

```text id="oswnk2"
pointerdown:
  start new stroke
  capture pointer

pointermove:
  append normalized point

pointerup:
  finish stroke
  simplify/process stroke
```

Normalize user coordinates immediately:

```ts id="e8tocy"
function eventToPoint(e: PointerEvent, rect: DOMRect): Point {
  return {
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height,
    t: performance.now(),
    pressure: e.pressure,
  };
}
```

Stroke preprocessing:

```text id="p8ub39"
raw points
  ↓
remove duplicate / near-duplicate points
  ↓
light smoothing
  ↓
resample by arc length to 64 points
```

Recommended MVP functions:

```ts id="8dlncr"
removeTinyMoves(points, minDistance)
smoothMovingAverage(points, windowSize)
resampleByArcLength(points, count)
polylineLength(points)
```

---

## 12. Validation algorithm

Validation runs only after **Finish**.

```text id="2pxiij"
validateWordAttempt(card, attempt)
  ↓
split target hanzi into characters
  ↓
compare target character count vs user character count
  ↓
for each aligned character:
      compareCharacter(targetChar, userCharAttempt)
  ↓
collect missing / extra characters
  ↓
return WordValidationResult
```

### 12.1 Word-level validation

```ts id="wa7xf4"
function validateWordAttempt(
  card: WordCard,
  attempt: WordAttempt,
  targetData: Record<string, TargetCharacter>
): WordValidationResult {
  const targetChars = Array.from(card.hanzi);
  const userChars = attempt.characters;

  const maxLen = Math.max(targetChars.length, userChars.length);

  const characterResults = [];

  for (let i = 0; i < maxLen; i++) {
    const targetChar = targetChars[i];
    const userChar = userChars[i];

    if (!targetChar && userChar) {
      characterResults.push(markExtraCharacter(i, userChar));
    } else if (targetChar && !userChar) {
      characterResults.push(markMissingCharacter(i, targetChar));
    } else {
      characterResults.push(
        compareCharacter(targetData[targetChar], userChar, thresholds)
      );
    }
  }

  return summarizeWordResult(card.hanzi, userChars.length, characterResults);
}
```

### 12.2 Character-level validation

For a target character:

```text id="36n2m1"
target strokes: T0, T1, T2, ...
user strokes:   U0, U1, U2, ...
```

Use dynamic programming to align strokes.

This is better than simply comparing stroke `i` to stroke `i`, because the user may skip a stroke or draw an extra stroke.

Allowed alignment operations:

| Operation       | Meaning                            |
| --------------- | ---------------------------------- |
| `match(Ti, Uj)` | User stroke attempts target stroke |
| `missing(Ti)`   | Target stroke was not drawn        |
| `extra(Uj)`     | User drew an extra stroke          |

MVP does not need split/merge strokes. Add that later.

```text id="jqrmf1"
dp[i][j] =
  best cost for first i target strokes and first j user strokes
```

Transitions:

```text id="edawpm"
dp[i+1][j+1] = dp[i][j] + compareStroke(Ti, Uj)
dp[i+1][j]   = dp[i][j] + missingStrokePenalty
dp[i][j+1]   = dp[i][j] + extraStrokePenalty
```

Backtrack through the DP table to produce stroke-level statuses.

---

## 13. Stroke comparison metric

Each target stroke and user stroke is a normalized, resampled polyline.

```ts id="thxmh8"
type StrokeComparison = {
  score: number;
  shapeDistance: number;
  endpointDistance: number;
  directionPenalty: number;
  lengthPenalty: number;
  missedSegments: Array<{ from: Point; to: Point }>;
};
```

Recommended weighted score:

```text id="igynpu"
score =
  0.45 * shapeDistance
+ 0.25 * endpointDistance
+ 0.20 * directionPenalty
+ 0.10 * lengthPenalty
```

### 13.1 Shape distance

For MVP, use ordered mean point distance:

```ts id="0e38bn"
function orderedMeanDistance(a: Polyline, b: Polyline): number {
  let total = 0;

  for (let i = 0; i < a.length; i++) {
    total += distance(a[i], b[i]);
  }

  return total / a.length;
}
```

Later, replace with DTW or discrete Fréchet distance if needed.

### 13.2 Direction penalty

Compute both forward and reversed distances:

```ts id="5fbq76"
const forward = orderedMeanDistance(target, user);
const reversed = orderedMeanDistance(target, [...user].reverse());

const directionPenalty =
  reversed < forward ? thresholds.reversedStrokePenalty : 0;
```

This catches cases where the user draws a stroke in the opposite direction.

### 13.3 Endpoint distance

```ts id="g3hhmx"
endpointDistance =
  distance(target[0], user[0]) +
  distance(target[target.length - 1], user[user.length - 1]);
```

### 13.4 Length penalty

```ts id="f69dmm"
lengthPenalty = Math.abs(
  polylineLength(user) / polylineLength(target) - 1
);
```

### 13.5 Missed segment highlighting

For every segment of the target median:

```text id="o036fw"
target segment is missed if:
  distance from segment midpoint to nearest point on user stroke > threshold
```

Return missed target segments. In `ResultView`, draw them in red over the target character.

---

## 14. Threshold configuration

Create one file:

```ts id="0ycwi4"
export const thresholds = {
  maxStrokeScore: 0.12,

  missingStrokePenalty: 0.35,
  extraStrokePenalty: 0.25,
  reversedStrokePenalty: 0.18,

  missedSegmentDistance: 0.08,

  endpointWeight: 0.25,
  shapeWeight: 0.45,
  directionWeight: 0.20,
  lengthWeight: 0.10,
};
```

Use normalized coordinates, so thresholds are fractions of canvas size.

Start loose. Then manually test with 20–30 characters and adjust.

---

## 15. Result classification

Per stroke:

```ts id="vczf1j"
function classifyStroke(c: StrokeComparison): StrokeMatchStatus {
  if (c.directionPenalty > 0) return "wrong_direction";
  if (c.score > thresholds.maxStrokeScore) return "bad_shape";
  return "matched";
}
```

Per character:

```text id="stcbdw"
ok:
  all required strokes matched

bad:
  at least one missing, extra, reversed, or bad-shape stroke

missing:
  whole character box missing

extra:
  user drew a character beyond target word length
```

Per word:

```text id="e97n3l"
ok:
  character count correct
  all characters ok

missing_characters:
  user drew fewer character boxes than target

extra_characters:
  user drew more character boxes than target

bad_characters:
  count is correct, but one or more characters failed
```

---

## 16. Rendering feedback

Use two render modes:

### Attempt preview

Draw user strokes only.

```text id="lu0zsf"
MiniCharacterPreview:
  small canvas or SVG
  gray/black user strokes
```

### Result feedback

Use SVG because target strokes are already SVG paths.

```text id="4dgz89"
CharacterFeedback:
  target character faint background
  user drawing overlay
  missed target segments in red
  wrong-direction stroke marker
  missing strokes highlighted
  extra user strokes highlighted
```

Use the original SVG paths for target stroke shape, but medians for scoring and missed-segment highlighting.

---

## 17. Step-by-step realization plan

### Phase 1: Static data and app skeleton

1. Create SvelteKit TypeScript project.
2. Add static `cards.ts`.
3. Add `WordCard` type.
4. Render first card translation only.
5. Add **Next card** button.
6. Add queue randomization.

Deliverable:

```text id="bc3qck"
Translation-only flashcard page with randomized cards.
```

---

### Phase 2: Drawing canvas

1. Build `DrawingCanvas.svelte`.
2. Implement pointer capture.
3. Store raw strokes.
4. Draw strokes live.
5. Add **Undo stroke**.
6. Add **Clear current**.

Deliverable:

```text id="tcrexg"
A white square where the user can draw multiple strokes.
```

---

### Phase 3: Multi-character attempt UI

1. Add `UserCharacterAttempt`.
2. Add **Draw next** button.
3. On **Draw next**, save current character and create a new blank canvas.
4. Add `AttemptStrip.svelte`.
5. Show previous character boxes as small previews on the left.
6. Add **Remove current character** or **Back**.

Deliverable:

```text id="48fr6r"
User can draw an unknown-length Hanzi word as multiple character boxes.
```

---

### Phase 4: Hanzi data preprocessing

1. Install `hanzi-writer-data`.
2. Write `scripts/build-hanzi-data.ts`.
3. Extract all unique characters from `cards.ts`.
4. Load each character JSON.
5. Validate that all characters exist.
6. Normalize medians to `[0, 1]`.
7. Resample each median to 64 points.
8. Generate `src/lib/data/generated/hanziStrokeData.ts`.

Deliverable:

```text id="mf34rb"
All target character stroke data available locally at build time.
```

---

### Phase 5: Geometry utilities

Implement:

```text id="3xss4t"
distance
polylineLength
removeTinyMoves
smoothMovingAverage
resampleByArcLength
nearestPointDistance
segmentMidpoint
```

Write tests for:

```text id="syrtg5"
- horizontal line resampling
- vertical line resampling
- polyline length
- reversed stroke detection
- nearest-point distance
```

Deliverable:

```text id="2okd9q"
Framework-independent geometry module.
```

---

### Phase 6: Stroke comparison

Implement:

```text id="aqwl8b"
compareStroke(targetStroke, userStroke, thresholds)
```

It should return:

```text id="66bcnw"
shapeDistance
endpointDistance
directionPenalty
lengthPenalty
score
missedSegments
```

Test cases:

```text id="v29ybr"
- identical stroke → low score
- reversed stroke → direction penalty
- shifted stroke → endpoint + shape penalty
- too short stroke → missed segments
- extra-long stroke → length penalty
```

Deliverable:

```text id="b6ueyq"
Single-stroke validator.
```

---

### Phase 7: Character validation

Implement dynamic-programming stroke alignment:

```text id="o4s6d9"
alignStrokes(targetStrokes, userStrokes)
```

Then implement:

```text id="1a4qfh"
compareCharacter(targetCharacter, userCharacterAttempt)
```

Test cases:

```text id="2st2vz"
- correct number of strokes
- missing stroke
- extra stroke
- reversed stroke
- wrong first stroke
```

Deliverable:

```text id="0a8b05"
Character-level validation with stroke-level feedback.
```

---

### Phase 8: Word validation after Finish

Implement:

```text id="5cu2py"
validateWordAttempt(card, attempt, hanziStrokeData)
```

Rules:

```text id="lllbj8"
- If user drew fewer boxes than target chars → missing_characters
- If user drew more boxes than target chars → extra_characters
- Compare aligned character boxes by index
- Do not validate before Finish
```

Deliverable:

```text id="e5h3h7"
Full hidden-word validation.
```

---

### Phase 9: Result UI

1. Reveal target Hanzi.
2. Show target translation.
3. Show user-drawn boxes.
4. Show per-character status.
5. Show per-stroke feedback.
6. Highlight missed target segments.

Deliverable:

```text id="dldy51"
Useful post-attempt feedback screen.
```

---

### Phase 10: Local progress

Store:

```ts id="sgtyzs"
type CardProgress = {
  cardId: string;
  attempts: number;
  successes: number;
  lastScore: number;
  lastAttemptAt: string;
};
```

Use `localStorage` first.

Later, if the data grows:

```text id="1vk7zy"
localStorage → IndexedDB/Dexie → backend sync
```

Deliverable:

```text id="9s5sw4"
Basic personal study history.
```

---

## 18. MVP build order

The shortest useful path is:

```text id="hd0505"
1. SvelteKit app
2. Static cards
3. Translation-only prompt
4. Drawing canvas
5. Draw next / Finish flow
6. Preprocess Hanzi stroke medians
7. Stroke comparison
8. Character comparison
9. Word comparison
10. Result screen
```

Do **not** start with authentication, backend storage, spaced repetition, or beautiful UI. The risky part is the **stroke matcher**, so get that working early.

---

## 19. Later extensions

After the MVP works:

```text id="3a94uh"
- spaced repetition scheduling
- pinyin hints
- tone/audio support
- import CSV from UI
- per-stroke replay
- support traditional/simplified variants
- relaxed mode vs strict mode
- split/merged stroke handling
- cloud sync
- mobile PWA install
```

For backend sync later, you can either use SvelteKit server routes with SQLite/Postgres, or add a small Phoenix backend if you specifically want Elixir. For the first version, keep everything client-side.

[1]: https://svelte.dev/docs/typescript?utm_source=chatgpt.com "TypeScript • Svelte Docs"
[2]: https://hanziwriter.org/ "Hanzi Writer - Chinese Character Stroke Order Animations and Practice Quizzes"
[3]: https://github.com/chanind/hanzi-writer-data "GitHub - chanind/hanzi-writer-data: The data used by Hanzi Writer · GitHub"
[4]: https://github.com/skishore/makemeahanzi "GitHub - skishore/makemeahanzi: Free, open-source Chinese character data · GitHub"


Add a **server-side development audit log** with two kinds of entries:

1. **Interaction log** — what the user did.
2. **System response log** — what the app/server did in response.

Use **JSON Lines**:

```text id="d3vddg"
logs/
  dev-session-2026-07-01.jsonl
```

Each line is one event:

```json id="wajzbl"
{
  "ts": "2026-07-01T12:34:56.123Z",
  "sessionId": "sess_abc",
  "attemptId": "attempt_001",
  "event": "finish_pressed",
  "payload": {}
}
```

Important constraint: the server can only log what it receives. So the client should send semantic events to a dev-only endpoint such as:

```text id="qhvz2l"
/api/dev-log
```

The server appends them to a local file. In production, disable this endpoint.

---

## 1. Global metadata to include in every log entry

Every event should include:

```ts id="blqh5n"
type BaseLogEvent = {
  ts: string;                 // server timestamp
  clientTs?: string;          // optional client timestamp
  event: string;

  sessionId: string;          // stable for browser session
  attemptId?: string;         // stable for one word attempt
  cardId?: string;

  appVersion?: string;
  dataVersion?: string;
  hanziDataVersion?: string;

  userAgent?: string;
  route?: string;

  payload: unknown;
};
```

Prefer **server timestamp** as authoritative. Client timestamp is useful only for latency and ordering diagnostics.

---

## 2. Session and app lifecycle events

Log when the user starts or reloads the practice page.

### `session_started`

When the practice widget initializes.

Log:

```ts id="9fef8t"
{
  sessionId,
  route,
  userAgent,
  viewport: { width, height },
  pointerSupport: {
    touch: boolean,
    pen: boolean,
    mouse: boolean
  },
  appVersion,
  dataVersion
}
```

Purpose:

```text id="af3qi0"
Debug device-specific issues, canvas scaling bugs, pointer problems.
```

### `cards_loaded`

When the card list is loaded.

Log:

```ts id="zi4jkk"
{
  cardCount,
  cardIds,
  uniqueHanziCount,
  missingStrokeDataChars
}
```

Do not log the entire card list every time unless debugging data loading.

### `queue_created`

When the randomized queue is generated.

Log:

```ts id="cyhmp0"
{
  queueSeed,
  queueCardIds
}
```

Use a seed so the exact card order can be reproduced.

---

## 3. Card attempt lifecycle events

### `card_presented`

When a new translation prompt is shown.

Server-side debug log may include hidden answer, because logs are for development.

Log:

```ts id="z5gnt9"
{
  cardId,
  translation,
  targetHanzi,
  targetCharCount,
  targetChars
}
```

Purpose:

```text id="xuqku1"
Reconstruct what the user was supposed to draw.
```

### `attempt_started`

When the user begins a new word attempt.

Log:

```ts id="1y0ezi"
{
  attemptId,
  cardId,
  startedAtClient
}
```

### `attempt_abandoned`

If the user moves away, refreshes, or skips.

Log:

```ts id="rrqpo9"
{
  attemptId,
  cardId,
  drawnCharacterCount,
  totalStrokeCount,
  reason: "skip" | "reload" | "navigation" | "new_card"
}
```

---

## 4. Drawing interaction events

Do **not** log every `pointermove` individually. That will create huge logs and poor performance.

Instead, log:

```text id="8i86fi"
- stroke started
- stroke committed
- stroke undone
- character cleared
- character finalized by Draw next
```

The full point sequence should be logged once per completed stroke.

### `stroke_started`

On `pointerdown`.

Log:

```ts id="ezy9cg"
{
  attemptId,
  characterIndex,
  strokeIndex,
  pointerType: "mouse" | "touch" | "pen",
  canvasSize: { width, height },
  startPoint: { x, y },
  pressure?: number
}
```

Purpose:

```text id="7nwqdq"
Debug wrong coordinate normalization and pointer-type behavior.
```

### `stroke_committed`

On `pointerup`.

Log:

```ts id="cou03g"
{
  attemptId,
  characterIndex,
  strokeIndex,

  pointerType,
  rawPointCount,
  processedPointCount,

  rawBoundingBox: {
    minX, minY, maxX, maxY
  },

  normalizedBoundingBox: {
    minX, minY, maxX, maxY
  },

  length,
  durationMs,

  rawPoints: [
    { x, y, t, pressure }
  ],

  normalizedPoints: [
    { x, y, t, pressure }
  ],

  processedPoints: [
    { x, y }
  ]
}
```

For matcher debugging, `processedPoints` are the most important. For input debugging, `rawPoints` are useful.

If logs become too large, store only:

```text id="ik63fv"
rawPointsSampled
normalizedPoints
processedPoints
```

### `stroke_cancelled`

If pointer capture is lost or the stroke is discarded.

Log:

```ts id="4at1tx"
{
  attemptId,
  characterIndex,
  strokeIndex,
  reason: "pointercancel" | "lostpointercapture" | "too_few_points" | "outside_canvas"
}
```

### `undo_stroke_pressed`

When the user undoes the last stroke.

Log:

```ts id="srmxl6"
{
  attemptId,
  characterIndex,
  removedStrokeIndex,
  remainingStrokeCount
}
```

### `clear_character_pressed`

When the user clears the current character canvas.

Log:

```ts id="mufc7v"
{
  attemptId,
  characterIndex,
  removedStrokeCount
}
```

### `remove_character_pressed`

When the user removes a whole character box.

Log:

```ts id="jyzo9d"
{
  attemptId,
  removedCharacterIndex,
  removedStrokeCount,
  characterCountBefore,
  characterCountAfter
}
```

---

## 5. Navigation inside one attempt

### `draw_next_pressed`

This is important because it defines the user’s perceived word segmentation.

Log:

```ts id="h4w67b"
{
  attemptId,
  fromCharacterIndex,
  toCharacterIndex,
  previousCharacterStrokeCount,
  characterCountAfter
}
```

No validation should happen here. But the log should prove that no validation happened.

Optional field:

```ts id="37fmn9"
{
  validationTriggered: false
}
```

### `back_to_previous_character_pressed`

If you support editing previous boxes.

Log:

```ts id="n8z4k3"
{
  attemptId,
  fromCharacterIndex,
  toCharacterIndex
}
```

### `active_character_changed`

If clicking a mini preview changes the active canvas.

Log:

```ts id="bq49se"
{
  attemptId,
  fromCharacterIndex,
  toCharacterIndex,
  reason: "preview_click" | "keyboard" | "button"
}
```

---

## 6. Finish and validation events

### `finish_pressed`

When the user freezes the attempt.

Log:

```ts id="85w2v8"
{
  attemptId,
  cardId,
  drawnCharacterCount,
  totalStrokeCount,
  characterStrokeCounts: [5, 7, 3],
  elapsedMs
}
```

This event should happen before validation.

### `validation_started`

When the batch validator starts.

Log:

```ts id="9bdn6u"
{
  attemptId,
  cardId,
  targetHanzi,
  targetChars,
  targetCharacterCount,
  userCharacterCount,
  thresholds
}
```

Purpose:

```text id="fy1doj"
Make validation reproducible.
```

### `word_count_validated`

Before stroke matching, log character count result.

```ts id="cux697"
{
  attemptId,
  targetCharacterCount,
  userCharacterCount,
  status: "same_count" | "missing_characters" | "extra_characters",
  missingCount,
  extraCount
}
```

### `character_validation_started`

For each aligned character.

```ts id="uzpu87"
{
  attemptId,
  characterIndex,
  targetChar,
  targetStrokeCount,
  userStrokeCount
}
```

### `stroke_alignment_computed`

After dynamic-programming stroke alignment.

Log:

```ts id="g48gjl"
{
  attemptId,
  characterIndex,
  targetChar,

  targetStrokeCount,
  userStrokeCount,

  alignment: [
    {
      op: "match",
      targetStrokeIndex: 0,
      userStrokeIndex: 0,
      cost: 0.043
    },
    {
      op: "missing",
      targetStrokeIndex: 1,
      cost: 0.35
    },
    {
      op: "extra",
      userStrokeIndex: 2,
      cost: 0.25
    }
  ],

  totalAlignmentCost
}
```

This is one of the most valuable logs. It tells you whether errors come from bad stroke comparison or bad alignment.

### `stroke_compared`

For every matched target/user stroke pair.

Log:

```ts id="73bpmh"
{
  attemptId,
  characterIndex,
  targetChar,

  targetStrokeIndex,
  userStrokeIndex,

  shapeDistance,
  endpointDistance,
  directionPenalty,
  lengthPenalty,
  totalScore,

  status: "matched" | "bad_shape" | "wrong_direction",

  targetStart: { x, y },
  targetEnd: { x, y },
  userStart: { x, y },
  userEnd: { x, y },

  targetLength,
  userLength,

  missedSegmentCount,
  missedSegments: [
    {
      from: { x, y },
      to: { x, y },
      distance: number
    }
  ]
}
```

Purpose:

```text id="bi3x9w"
Tune thresholds and inspect false positives/false negatives.
```

### `missing_stroke_detected`

For target strokes that were not aligned with any user stroke.

```ts id="uxkn23"
{
  attemptId,
  characterIndex,
  targetChar,
  targetStrokeIndex,
  penalty,
  targetStrokeLength
}
```

### `extra_stroke_detected`

For user strokes that were not aligned with a target stroke.

```ts id="6jzk3v"
{
  attemptId,
  characterIndex,
  userStrokeIndex,
  penalty,
  userStrokeLength,
  userStrokeBoundingBox
}
```

### `character_validation_completed`

After all strokes in one character are validated.

```ts id="y1iq3w"
{
  attemptId,
  characterIndex,
  targetChar,
  status: "ok" | "bad" | "missing" | "extra",
  totalScore,
  matchedStrokeCount,
  missingStrokeCount,
  extraStrokeCount,
  wrongDirectionCount,
  badShapeCount
}
```

### `validation_completed`

After the whole word is validated.

```ts id="wunigx"
{
  attemptId,
  cardId,
  targetHanzi,
  status: "ok" | "missing_characters" | "extra_characters" | "bad_characters",

  totalScore,
  userCharacterCount,
  targetCharacterCount,

  characterStatuses: [
    {
      index: 0,
      targetChar: "学",
      status: "ok",
      score: 0.05
    },
    {
      index: 1,
      targetChar: "生",
      status: "bad",
      score: 0.22
    }
  ],

  durationMs
}
```

---

## 7. Result-screen events

These help debug whether the feedback UI is understandable.

### `result_shown`

When feedback is displayed.

```ts id="ar4bka"
{
  attemptId,
  cardId,
  status,
  revealedHanzi,
  feedbackItemCount
}
```

### `feedback_detail_opened`

If the user expands a character/stroke detail.

```ts id="bqr4nb"
{
  attemptId,
  characterIndex,
  targetChar,
  strokeIndex?: number
}
```

### `replay_stroke_pressed`

If you later support replay.

```ts id="g9z4sp"
{
  attemptId,
  characterIndex,
  strokeIndex,
  source: "user" | "target"
}
```

### `next_card_pressed`

When the user leaves the result screen.

```ts id="3f52ev"
{
  attemptId,
  cardId,
  resultStatus,
  elapsedOnResultMs
}
```

---

## 8. Error and performance logs

### `client_error_reported`

Client sends caught errors to server.

```ts id="c2jz8n"
{
  message,
  stack,
  component,
  attemptId,
  cardId
}
```

### `server_error`

Logged directly by the server.

```ts id="b55r1m"
{
  route,
  message,
  stack,
  requestBodySummary
}
```

### `validation_performance`

Useful if validation becomes slow.

```ts id="9y7044"
{
  attemptId,
  targetHanzi,
  userCharacterCount,
  totalStrokeCount,
  totalPointCount,
  preprocessingMs,
  alignmentMs,
  comparisonMs,
  totalValidationMs
}
```

### `large_payload_received`

If a drawing payload is unexpectedly large.

```ts id="q7scpo"
{
  attemptId,
  payloadBytes,
  totalStrokeCount,
  totalPointCount
}
```

---

## 9. Server-only POV rule

For development, the server should be the only writer.

Good:

```text id="blsy9f"
Client → POST /api/dev-log → Server appends JSONL
Client → POST /api/validate-attempt → Server validates and appends JSONL
```

Avoid:

```text id="jcy9g5"
Client writing downloadable logs
Client console-only logs
Browser localStorage as the source of truth for debugging
```

Best structure:

```text id="v29kyl"
Client:
  records interaction event
  sends it to server

Server:
  receives event
  attaches server timestamp
  attaches request metadata
  writes JSONL line

Server validator:
  receives finished attempt
  validates it
  writes all validation logs
  returns result to client
```

This means validation should ideally run on the server during development, even if the app will later support client-side validation.

---

## 10. Recommended dev endpoints

### `POST /api/dev-log`

For interaction events.

Request:

```ts id="p9argx"
{
  sessionId: string;
  attemptId?: string;
  cardId?: string;
  event: string;
  clientTs: string;
  payload: unknown;
}
```

Server adds:

```ts id="l2ctjn"
{
  ts: new Date().toISOString(),
  ipHash,
  userAgent,
  route
}
```

### `POST /api/validate-attempt`

For Finish.

Request:

```ts id="dfr53i"
{
  sessionId: string;
  attemptId: string;
  cardId: string;
  attempt: WordAttempt;
}
```

Server does:

```text id="keboeh"
1. log finish_received
2. load target card
3. load stroke data
4. run validation
5. log validation_started
6. log character/stroke details
7. log validation_completed
8. return result
```

Response:

```ts id="s3ilgr"
{
  result: WordValidationResult
}
```

---

## 11. Log file organization

Use one JSONL file per day or per server run.

```text id="l15vb0"
logs/
  dev-2026-07-01.jsonl
  dev-2026-07-02.jsonl
```

Or, better for focused debugging:

```text id="ayni4n"
logs/
  sessions/
    sess_abc.jsonl
    sess_def.jsonl
```

For your use case, I would use:

```text id="vfjgws"
logs/dev-current.jsonl
```

at first, then rotate later.

---

## 12. Minimum useful logging set

Do not start with every possible event. Start with this:

```text id="3k9onj"
session_started
cards_loaded
queue_created
card_presented
attempt_started
stroke_committed
undo_stroke_pressed
clear_character_pressed
draw_next_pressed
finish_pressed
validation_started
stroke_alignment_computed
stroke_compared
character_validation_completed
validation_completed
result_shown
client_error_reported
server_error
```

This is enough to reconstruct almost every bug.

---

## 13. What not to log initially

Avoid logging:

```text id="5e46fs"
- every pointermove
- every animation frame
- every canvas redraw
- every hover
- every button disabled/enabled state
- full card list on every attempt
- repeated unchanged settings
```

These create noise without much debugging value.

---

## 14. Critical debugging scenarios covered

This logging plan lets you answer:

```text id="r41ohx"
Did the user draw too few/many characters?
Did Draw next accidentally trigger validation?
Was a stroke reversed?
Was a stroke shape bad or just shifted?
Was the threshold too strict?
Did preprocessing distort the user stroke?
Did stroke alignment match the wrong strokes?
Did the user draw correctly but the target data is weird?
Was the canvas coordinate system wrong?
Was the issue device-specific?
Was validation slow because of too many points?
```

The single most important logs for this app are:

```text id="rafntc"
stroke_committed
stroke_alignment_computed
stroke_compared
validation_completed
```

Those four are enough to debug the matcher.



