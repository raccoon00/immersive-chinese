I could read the repo. The current project is already in the right shape for this feature: SvelteKit/TypeScript, Svelte 5, Tailwind, Vitest, `hanzi-writer`, and `hanzi-writer-data` are already installed, and the app already has drill construction, server-side file storage, dynamic Hanzi stroke-data loading, and server-side validation.

Below is the implementation plan for **Study Text**.

---

# Feature: Study Text

## 1. Goal

Add a section where the user can import Chinese text from the clipboard, split it into paragraphs and sentences, select sentences to study, manually segment each sentence into words/spans, choose contextual translations for each span, and generate/update a related drill deck.

This feature should become the pipeline before the existing drill system:

```text
Internet text
  ↓
Study Text
  ↓
Sentence selection
  ↓
Manual word/span segmentation
  ↓
Dictionary / HSK lookup
  ↓
Contextual translation selection
  ↓
Deck creation/update
  ↓
Existing hidden-Hanzi drill
```

The existing `StoredDrill` model already stores cards as `{ hanzi, translation }`, so the output of this feature can feed directly into the current drill system.

---

# 2. Existing project state relevant to this feature

The root page currently redirects to `/drill-constructor`.

The drill constructor lets the user edit rows of Hanzi/translation pairs and saves them with `PUT /api/drills/[id]`.

Drills are currently persisted as JSON files under `data/drills`.

The current `WordCard` type is already the right final shape for generated vocabulary cards:

```ts
type WordCard = {
  id: string;
  hanzi: string;
  translation: string;
  tags?: string[];
};
```

The app already loads target Hanzi stroke data dynamically for the active drill, instead of requiring every character to be precompiled globally.

So for this feature, do **not** create a separate “deck” model unless needed. Reuse `StoredDrill` as the final deck format.

---

# 3. Requirements

## 3.1 Functional requirements

| ID    | Requirement                                                                                              |
| ----- | -------------------------------------------------------------------------------------------------------- |
| ST-1  | User opens `/study-text` and sees existing study texts.                                                  |
| ST-2  | User presses **Create new from clipboard**.                                                              |
| ST-3  | App reads clipboard text in the browser and sends it to the server.                                      |
| ST-4  | App parses raw text into paragraphs and sentences.                                                       |
| ST-5  | User selects which sentences to study.                                                                   |
| ST-6  | User can copy/share/open Google Translate for whole text.                                                |
| ST-7  | User can copy/share/open Google Translate for current selected sentence.                                 |
| ST-8  | User can paste translation for the whole text.                                                           |
| ST-9  | Whole-text translation is split into translated sentences and mapped sequentially to source sentences.   |
| ST-10 | User can paste/edit translation for one selected sentence.                                               |
| ST-11 | App proposes automatic word splits for each selected sentence.                                           |
| ST-12 | User can edit splits manually on mobile.                                                                 |
| ST-13 | For each resulting span/token, app shows dictionary matches, pinyin, HSK level, and translation options. |
| ST-14 | User can mark a span as a named entity.                                                                  |
| ST-15 | User selects one contextual translation per non-named-entity span.                                       |
| ST-16 | Named entities cannot use dictionary translation selection, but can have pinyin/manual note.             |
| ST-17 | User can save progress at any point.                                                                     |
| ST-18 | User can create or update the deck related to this text.                                                 |
| ST-19 | Duplicate words are merged into one drill card.                                                          |
| ST-20 | If the same Hanzi appears with different chosen translations, translations are joined with semicolons.   |

## 3.2 Non-functional requirements

| ID   | Requirement                                                                   |
| ---- | ----------------------------------------------------------------------------- |
| NF-1 | Works well on mobile.                                                         |
| NF-2 | Core parsing/segmentation logic is framework-independent TypeScript.          |
| NF-3 | Clipboard/share buttons degrade gracefully when browser APIs are unavailable. |
| NF-4 | Dictionary lookup is server-side, deterministic, and cacheable.               |
| NF-5 | User edits must be saved as explicit state, not recomputed destructively.     |
| NF-6 | Auto-splitting is only a proposal; user edits are authoritative.              |

---

# 4. Browser API constraints

Clipboard import should use `navigator.clipboard.readText()` from a click handler. It returns a promise with the textual contents of the system clipboard and requires a secure context. ([Mozilla Developer Network][1])

Copy buttons should use `navigator.clipboard.writeText(text)`, which writes text to the system clipboard and also requires a secure context. ([Mozilla Developer Network][2])

Mobile sharing should use `navigator.share({ text })` where available. It invokes the device-native share sheet, but MDN marks it as limited availability and it must be triggered by a user action. ([Mozilla Developer Network][3])

For sentence splitting and fallback word segmentation, `Intl.Segmenter` is relevant: it provides locale-sensitive segmentation into graphemes, words, or sentences and is useful for languages that do not use spaces between words. ([Mozilla Developer Network][4])

---

# 5. Data sources

## 5.1 User text

Created from clipboard.

```ts
type RawStudyTextInput = {
  rawText: string;
  createdFrom: 'clipboard' | 'manual';
};
```

## 5.2 Dictionary data

Use **CC-CEDICT** as the first dictionary source.

CC-CEDICT is a downloadable Chinese-English dictionary with pinyin, and MDBG currently distributes it under Creative Commons Attribution-ShareAlike 4.0 International. ([mdbg.net][5])

Server-side preprocessing should convert CC-CEDICT into a lookup index:

```ts
type DictionaryEntry = {
  traditional: string;
  simplified: string;
  pinyinNumbered: string;
  pinyinPretty: string;
  definitions: string[];
  source: 'cc-cedict';
};
```

Recommended indexes:

```ts
type DictionaryIndex = {
  bySimplified: Record<string, DictionaryEntry[]>;
  byTraditional: Record<string, DictionaryEntry[]>;
};
```

## 5.3 HSK lists

Add local HSK vocabulary data as a pinned versioned file.

```ts
type HskEntry = {
  hanzi: string;
  level: number;
  system: 'hsk2' | 'hsk3';
};
```

For the MVP, choose **one** system and pin it. I would start with HSK 2.0 if your materials are beginner-oriented, then add HSK 3.0 later as a second tag system.

## 5.4 Impl.Splitter

I could not verify `Impl.Splitter` in the repository because code search timed out for that term. Treat it as an adapter, not as a hard dependency in the UI.

Create this interface:

```ts
export type SplitterToken = {
  text: string;
  start: number;
  end: number;
  confidence?: number;
  source: 'impl-splitter' | 'dictionary-max-match' | 'intl-segmenter' | 'manual';
};

export type ChineseSplitter = {
  splitSentence(sentence: string): Promise<SplitterToken[]>;
};
```

Then implement adapters in this order:

```text
1. ImplSplitterAdapter
2. DictionaryMaxMatchSplitter
3. IntlSegmenterFallback
4. CharacterByCharacterFallback
```

---

# 6. Main data model

Create:

```text
src/lib/study-text/types.ts
```

## 6.1 Study text

```ts
export type StudyTextStatus = 'draft' | 'in_progress' | 'ready';

export type StudyText = {
  id: string;
  title: string;
  rawText: string;

  paragraphs: StudyParagraph[];
  sentences: StudySentence[];

  selectedSentenceIds: string[];

  wholeTranslation?: string;
  relatedDrillId?: string;

  status: StudyTextStatus;
  createdAt: string;
  updatedAt: string;
};
```

## 6.2 Paragraphs and sentences

```ts
export type StudyParagraph = {
  id: string;
  index: number;
  text: string;
  sentenceIds: string[];
};

export type StudySentence = {
  id: string;
  paragraphId: string;
  indexInParagraph: number;
  globalIndex: number;

  text: string;
  startOffset: number;
  endOffset: number;

  selected: boolean;
  translation?: string;

  segmentation: SentenceSegmentation;
};
```

## 6.3 Segmentation

```ts
export type SentenceSegmentation = {
  sentenceId: string;
  source: 'auto' | 'manual' | 'mixed';
  tokens: StudyToken[];
  updatedAt: string;
};
```

## 6.4 Tokens/spans

```ts
export type StudyTokenKind =
  | 'word'
  | 'named_entity'
  | 'punctuation'
  | 'unknown';

export type StudyToken = {
  id: string;
  sentenceId: string;

  start: number;
  end: number;
  text: string;

  kind: StudyTokenKind;

  autoProposed: boolean;
  manuallyEdited: boolean;

  pinyin?: string;
  selectedTranslation?: string;
  manualTranslation?: string;

  dictionaryMatches: DictionaryMatch[];
  hskLevels: HskTag[];
};
```

## 6.5 Dictionary matches

```ts
export type DictionaryMatch = {
  entryId: string;
  simplified: string;
  traditional: string;
  pinyin: string;
  definitions: string[];
  source: 'cc-cedict';
};

export type HskTag = {
  system: 'hsk2' | 'hsk3';
  level: number;
};
```

---

# 7. Storage architecture

Follow the existing file-based pattern used by drills.

Current drills are stored under `data/drills` and read/written with server helpers.

Add:

```text
data/
  drills/
    drill_x.json

  study-texts/
    study_x.json

  dictionary/
    cedict.json
    hsk2.json
    hsk3.json
```

Create:

```text
src/lib/server/studyTexts.ts
src/lib/server/dictionary.ts
src/lib/server/hsk.ts
src/lib/server/splitter.ts
```

Use the same style as `src/lib/server/drills.ts`, which already has `readDrill`, `createEmptyDrill`, and `saveDrill`.

---

# 8. Routes and APIs

## 8.1 Pages

```text
/study-text
/study-text/[id]
```

### `/study-text`

Lists existing studies.

Main actions:

```text
Create new from clipboard
Open existing
Delete existing
Open related deck
```

### `/study-text/[id]`

Main editor.

Layout:

```text
Header
  title
  save status
  related deck link

Whole text block
  copy / share / google translate buttons
  paste whole translation

Sentence selection area
  paragraphs
  sentence checkboxes/toggles

Selected sentence workspace
  current sentence duplicate
  sentence-level copy/share/google buttons
  paste sentence translation
  segmentation editor
  token info cards
  deck update controls
```

## 8.2 API endpoints

```text
GET    /api/study-texts
POST   /api/study-texts
GET    /api/study-texts/[id]
PUT    /api/study-texts/[id]
DELETE /api/study-texts/[id]

POST   /api/study-texts/[id]/parse-translation
POST   /api/study-texts/[id]/lookup-tokens
POST   /api/study-texts/[id]/update-deck
```

Important: **clipboard reading happens client-side**, not server-side.

```ts
const rawText = await navigator.clipboard.readText();

await fetch('/api/study-texts', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ rawText })
});
```

---

# 9. Component architecture

```text
src/lib/components/study-text/
  StudyTextList.svelte
  ClipboardImportButton.svelte
  StudyTextEditor.svelte
  TextActionToolbar.svelte
  ParagraphSentenceSelector.svelte
  SentenceWorkspace.svelte
  SentenceTranslationEditor.svelte
  SegmentEditor.svelte
  TokenInfoList.svelte
  TokenInfoCard.svelte
  DictionaryMatchPicker.svelte
  NamedEntityControls.svelte
  DeckUpdatePanel.svelte
```

## 9.1 `ClipboardImportButton.svelte`

Responsibilities:

```text
- Read clipboard text.
- Show permission/error state.
- POST raw text to server.
- Navigate to created study.
```

## 9.2 `TextActionToolbar.svelte`

Reusable for whole text and sentence.

Props:

```ts
type TextActionToolbarProps = {
  text: string;
  label: 'text' | 'sentence';
};
```

Actions:

```text
Copy
Share
Google Translate
```

Implementation:

```ts
function googleTranslateUrl(text: string): string {
  const query = encodeURIComponent(text);
  return `https://translate.google.com/?sl=zh-CN&tl=en&text=${query}&op=translate`;
}
```

## 9.3 `ParagraphSentenceSelector.svelte`

Responsibilities:

```text
- Display parsed paragraphs.
- Render sentence boundaries.
- Let user select/unselect sentences.
- On click, make sentence current.
```

Do not use native text selection as the primary mechanism. On mobile, sentence selection should be explicit: tap a sentence card/chip.

## 9.4 `SentenceWorkspace.svelte`

Shows the selected sentence duplicate below the text.

Contains:

```text
- selected sentence text
- sentence translation field
- SegmentEditor
- TokenInfoList
```

## 9.5 `SegmentEditor.svelte`

This is the most important custom UI component.

It should not use `contenteditable` in the MVP. Use structured spans.

Render sentence as characters/graphemes plus tappable separator zones:

```text
[我] | [喜欢] | [学习] | [中文]
```

Internally store boundaries, not raw HTML.

```ts
type BoundaryIndex = number;

type SegmentEditorState = {
  chars: string[];
  boundaries: Set<BoundaryIndex>;
};
```

A boundary index means:

```text
boundary 0: before first char
boundary 1: between char 0 and char 1
boundary n: after last char
```

Actions:

| Gesture            | Action                              |
| ------------------ | ----------------------------------- |
| Tap gap            | Toggle separator                    |
| Swipe across chars | Select span                         |
| Tap selected span  | Merge into one token                |
| Long press token   | Mark named entity / split           |
| Undo               | Restore previous segmentation state |

For mobile, separator hit zones should be wide, about `24–32px`, even if the visible separator is thin.

## 9.6 `TokenInfoList.svelte`

Renders token cards in token order.

Each card shows:

```text
- Hanzi span
- pinyin
- HSK level
- dictionary matches
- selected contextual translation
- named entity toggle
- manual translation input
```

---

# 10. Parsing algorithms

## 10.1 Text normalization

Keep the original raw text unchanged, but create a normalized parsing version.

```ts
type ParsedText = {
  paragraphs: StudyParagraph[];
  sentences: StudySentence[];
};
```

Normalization rules:

```text
- Convert CRLF to LF.
- Trim outer whitespace.
- Preserve paragraph boundaries.
- Collapse excessive internal spaces only in derived display text, not raw source.
```

## 10.2 Paragraph splitting

```ts
function splitParagraphs(rawText: string): string[] {
  return rawText
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}
```

## 10.3 Sentence splitting

Use:

```text
1. Intl.Segmenter('zh-CN', { granularity: 'sentence' }) if available.
2. Regex fallback.
```

Fallback regex:

```ts
const sentenceRegex = /[^。！？!?…]+[。！？!?…]*/g;
```

Important: every sentence must keep offsets into the paragraph/text so token spans can be persisted.

---

# 11. Auto word splitting

## 11.1 Adapter interface

```ts
export async function splitChineseSentence(sentence: string): Promise<SplitterToken[]> {
  const implResult = await tryImplSplitter(sentence);
  if (implResult.length > 0) return implResult;

  const dictionaryResult = dictionaryMaxMatch(sentence);
  if (dictionaryResult.length > 0) return dictionaryResult;

  const intlResult = intlSegmenterSplit(sentence);
  if (intlResult.length > 0) return intlResult;

  return characterByCharacterSplit(sentence);
}
```

## 11.2 Dictionary maximum matching fallback

Use dictionary keys from CC-CEDICT.

Algorithm:

```text
for i in sentence:
  try longest substring sentence[i:j] that exists in dictionary
  if found:
    emit token
    i = j
  else:
    emit one character
    i += 1
```

Set maximum lookup length to maybe 6–8 Hanzi for speed.

## 11.3 User edits override auto split

Every token should track:

```ts
autoProposed: boolean;
manuallyEdited: boolean;
```

If the user edits a sentence, do not overwrite it with a new auto split unless they explicitly press **Reset to auto split**.

---

# 12. Dictionary and HSK lookup algorithm

For each token:

```text
1. Ignore punctuation.
2. Exact lookup in CC-CEDICT simplified index.
3. Exact lookup in CC-CEDICT traditional index.
4. Lookup HSK level by exact Hanzi.
5. Attach matches to token.
```

Server endpoint:

```text
POST /api/study-texts/[id]/lookup-tokens
```

Request:

```ts
type LookupTokensRequest = {
  sentenceId: string;
  tokens: Array<{
    id: string;
    text: string;
    start: number;
    end: number;
  }>;
};
```

Response:

```ts
type LookupTokensResponse = {
  tokens: StudyToken[];
};
```

Update dictionary information after each completed separator edit, not during every pointer move. Use a debounce or explicit “commit” event after tap/swipe ends.

---

# 13. Translation mapping

## 13.1 Whole-text translation paste

User pastes translation for the whole text.

Process:

```text
1. Split translation into sentences.
2. Take selected source sentences or all source sentences.
3. Map sequentially.
4. If counts differ, show warning.
5. Allow manual correction.
```

```ts
type TranslationMappingResult = {
  sourceSentenceCount: number;
  translatedSentenceCount: number;
  pairs: Array<{
    sourceSentenceId: string;
    translation: string;
    confidence: 'exact_position' | 'count_mismatch';
  }>;
  warnings: string[];
};
```

## 13.2 Sentence translation paste

Simpler:

```text
Selected sentence
  ↓
Paste translation
  ↓
Store sentence.translation
```

---

# 14. Named entity behavior

A token can be marked:

```ts
kind: 'named_entity'
```

Then:

```text
- Disable dictionary translation picker.
- Keep pinyin display if available.
- Allow manual note/translation field.
- Exclude from deck by default.
- Add checkbox: “Include named entities in deck”.
```

This avoids adding people/place names as ordinary vocabulary unless the user explicitly wants that.

---

# 15. Deck creation/update algorithm

The existing drill save path expects rows of `{ hanzi, translation }`.

Create:

```text
src/lib/server/studyDeck.ts
```

Algorithm:

```ts
function collectDeckRows(study: StudyText): DrillRowInput[] {
  const byHanzi = new Map<string, Set<string>>();

  for (const sentence of study.sentences) {
    if (!sentence.selected) continue;

    for (const token of sentence.segmentation.tokens) {
      if (token.kind === 'punctuation') continue;
      if (token.kind === 'named_entity') continue;

      const translation = token.selectedTranslation ?? token.manualTranslation;
      if (!translation) continue;

      if (!byHanzi.has(token.text)) {
        byHanzi.set(token.text, new Set());
      }

      byHanzi.get(token.text)!.add(translation.trim());
    }
  }

  return [...byHanzi.entries()].map(([hanzi, translations]) => ({
    hanzi,
    translation: [...translations].join('; ')
  }));
}
```

For updating an existing related deck:

```text
1. Read existing drill by study.relatedDrillId.
2. Convert existing cards into Map<hanzi, Set<translation>>.
3. Add newly collected rows.
4. Join translations with "; ".
5. Save drill.
6. Store relatedDrillId on StudyText.
```

Important: merge by exact `token.text` first. Later you can normalize simplified/traditional variants.

---

# 16. File layout to add

```text
src/lib/study-text/
  types.ts
  parseText.ts
  parseTranslation.ts
  segmentation.ts
  tokenBoundaries.ts
  deckExport.ts

src/lib/dictionary/
  types.ts
  parseCedict.ts
  lookup.ts
  hsk.ts

src/lib/server/
  studyTexts.ts
  dictionary.ts
  splitter.ts
  studyDeck.ts

src/lib/components/study-text/
  ClipboardImportButton.svelte
  StudyTextList.svelte
  StudyTextEditor.svelte
  TextActionToolbar.svelte
  ParagraphSentenceSelector.svelte
  SentenceWorkspace.svelte
  SegmentEditor.svelte
  TokenInfoList.svelte
  TokenInfoCard.svelte
  DictionaryMatchPicker.svelte
  DeckUpdatePanel.svelte

src/routes/study-text/
  +page.server.ts
  +page.svelte

src/routes/study-text/[id]/
  +page.server.ts
  +page.svelte

src/routes/api/study-texts/
  +server.ts

src/routes/api/study-texts/[id]/
  +server.ts

src/routes/api/study-texts/[id]/lookup-tokens/
  +server.ts

src/routes/api/study-texts/[id]/parse-translation/
  +server.ts

src/routes/api/study-texts/[id]/update-deck/
  +server.ts

scripts/
  build-dictionary-data.ts
```

---

# 17. Implementation phases

## Phase 1 — Data model and storage

Implement:

```text
src/lib/study-text/types.ts
src/lib/server/studyTexts.ts
```

Use the same JSON-file style as drills.

Functions:

```ts
readStudyText(id)
listStudyTexts()
createStudyTextFromRawText(rawText)
saveStudyText(study)
deleteStudyText(id)
```

Deliverable:

```text
Can create/read/update/list study text JSON files.
```

---

## Phase 2 — Text parser

Implement:

```text
parseStudyText(rawText): ParsedText
```

It should return paragraphs, sentences, ids, indexes, and offsets.

Test with:

```text
你好。我是学生。
我喜欢学习中文！

这是第二段。
```

Deliverable:

```text
Raw text becomes selectable paragraphs/sentences.
```

---

## Phase 3 — `/study-text` list page

Add page:

```text
/study-text
```

Features:

```text
- list existing studies
- create new from clipboard
- open study
- open related drill if present
```

Clipboard import must run in the browser with `navigator.clipboard.readText()`.

Deliverable:

```text
User can create a study from copied text.
```

---

## Phase 4 — Study editor page

Add:

```text
/study-text/[id]
```

Initial UI:

```text
- title
- whole text
- sentence selection
- selected sentence panel
- save button
```

Deliverable:

```text
User can select sentences and save progress.
```

---

## Phase 5 — Copy/share/Google Translate toolbar

Create reusable:

```text
TextActionToolbar.svelte
```

Use it twice:

```text
- whole text toolbar
- current sentence toolbar
```

Behavior:

```text
Copy: navigator.clipboard.writeText(text)
Share: navigator.share({ text }) if available, else fallback to copy
Google Translate: open target URL in new tab
```

Deliverable:

```text
User can send text/sentence to external translation tools.
```

---

## Phase 6 — Translation paste/mapping

Implement:

```text
parseTranslation.ts
POST /api/study-texts/[id]/parse-translation
```

Features:

```text
- paste whole translation
- split translated text into sentences
- map sequentially to source sentences
- warning on count mismatch
- manual correction per sentence
```

Deliverable:

```text
Study text can store whole-text and per-sentence translations.
```

---

## Phase 7 — Dictionary preprocessing

Add script:

```text
scripts/build-dictionary-data.ts
```

Input:

```text
CC-CEDICT text file
HSK JSON/CSV files
```

Output:

```text
data/dictionary/cedict.json
data/dictionary/hsk2.json
```

Server module:

```text
src/lib/server/dictionary.ts
```

Functions:

```ts
lookupDictionary(text: string): DictionaryMatch[]
lookupHsk(text: string): HskTag[]
```

Deliverable:

```text
Server can return dictionary and HSK data for a Hanzi span.
```

---

## Phase 8 — Auto splitter

Implement:

```text
src/lib/server/splitter.ts
```

Priority:

```text
1. Impl.Splitter adapter, if available.
2. Dictionary longest-match.
3. Intl.Segmenter fallback.
4. Character-by-character fallback.
```

Deliverable:

```text
Every selected sentence gets an editable initial segmentation.
```

---

## Phase 9 — Mobile segmentation editor

Build:

```text
SegmentEditor.svelte
```

Use structured characters and separators, not `contenteditable`.

Core operations:

```text
- toggle separator
- merge selected span
- split token
- undo edit
- reset to auto
```

After each completed edit:

```text
tokens = boundariesToTokens(sentence, boundaries)
POST lookup-tokens
update TokenInfoList
```

Deliverable:

```text
User can comfortably correct Chinese word splits on mobile.
```

---

## Phase 10 — Token information cards

Build:

```text
TokenInfoList.svelte
TokenInfoCard.svelte
DictionaryMatchPicker.svelte
NamedEntityControls.svelte
```

Each token card shows:

```text
- span text
- pinyin
- HSK level
- dictionary matches
- selected translation
- manual translation
- named entity toggle
```

Rules:

```text
- dictionary translations selectable only for normal words
- named entities disable dictionary picker
- manual translation allowed
```

Deliverable:

```text
User can choose context-fitting translations for each token.
```

---

## Phase 11 — Save progress

Wire every major editor state into `StudyText`.

Save triggers:

```text
- manual save button
- optional autosave debounce
- before leaving page warning if dirty
```

Persist:

```text
selected sentences
translations
segmentation
named entity flags
selected token translations
related deck id
```

Deliverable:

```text
User can leave and later continue the same study.
```

---

## Phase 12 — Create/update related deck

Implement:

```text
POST /api/study-texts/[id]/update-deck
```

Behavior:

```text
- collect selected tokens
- ignore punctuation
- ignore named entities by default
- require selectedTranslation or manualTranslation
- merge duplicates by Hanzi
- join translations with "; "
- create related drill if missing
- update related drill if present
```

Because the current drill system already accepts Hanzi/translation rows, this feature can generate standard drill cards and then redirect to `/drill?id=...`.

Deliverable:

```text
Study Text produces a usable hidden-Hanzi drill deck.
```

---

# 18. Suggested MVP cut

Do not implement everything at once. The useful MVP is:

```text
1. /study-text list
2. create from clipboard
3. paragraph/sentence parsing
4. sentence selection
5. copy/share/google buttons
6. sentence translation paste
7. auto segmentation fallback
8. manual separator editing
9. dictionary lookup
10. selected translation per token
11. update related drill
```

Postpone:

```text
- whole-text translation mismatch UI polish
- HSK 3.0 support
- multiple dictionaries
- OCR/import from URL
- cloud sync
- fancy spaced repetition
- named-entity recognition automation
```

---

# 19. Main risk areas

The hardest part is not storage or routing. It is the **mobile segmentation editor**.

Avoid native selection. Render custom token/character components with explicit separator hit zones.

The second risk is translation mapping. Sequential mapping works for copied Google Translate output only when source and target sentence counts align. Always show mismatch warnings and keep manual correction available.

The third risk is dictionary licensing. CC-CEDICT is usable, but if you redistribute dictionary data with the app, include attribution and license text. ([cc-cedict.org][6])

---

# 20. Recommended next coding order

Start with this exact order:

```text
1. StudyText types
2. server/studyTexts.ts
3. parseStudyText()
4. /study-text list page
5. ClipboardImportButton
6. /study-text/[id] editor page
7. sentence selection
8. TextActionToolbar
9. sentence translation field
10. SegmentEditor with manual separators
11. dictionary lookup endpoint
12. token info cards
13. selected translation state
14. deck export/update endpoint
15. link to existing /drill?id=...
```

This keeps the feature vertical: after each phase, the app remains usable.

[1]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText "Clipboard: readText() method - Web APIs | MDN"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText "Clipboard: writeText() method - Web APIs | MDN"
[3]: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share "Navigator: share() method - Web APIs | MDN"
[4]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter "Intl.Segmenter - JavaScript | MDN"
[5]: https://www.mdbg.net/chinese/dictionary?page=cedict "MDBG Chinese Dictionary"
[6]: https://cc-cedict.org/wiki/ "CC-CEDICT Home [CC-CEDICT WIKI]"




UPDATED STORAGE SECTION:
Agreed. Use **one merged lexicon**, not separate dictionary/HSK stores.

The revised plan should replace the earlier `dictionary + hsk` split with a single normalized lexical database.

## Revised lexical data model

```ts id="g88l6e"
export type LexiconEntry = {
  id: string;

  // Simplified Chinese word/span.
  word: string;

  // One pronunciation per entry.
  // Polyphonic words/characters are represented as separate entries.
  pinyin: string;

  // Flat list of candidate English/Russian/etc. meanings.
  translations: string[];

  // Metadata from all sources.
  // Examples:
  // "source:cedict"
  // "hsk:1"
  // "hsk-system:hsk3"
  // "frequency:124"
  // "pos:noun"
  tags: string[];
};
```

Key point: **polyphonic entries are duplicated by `(word, pinyin)`**, not represented as:

```ts id="gz8kdw"
pinyin: string[]
```

So this is correct:

```ts id="jpyqf3"
[
  {
    word: "行",
    pinyin: "xíng",
    translations: ["to walk", "to be okay", "capable"],
    tags: ["source:cedict"]
  },
  {
    word: "行",
    pinyin: "háng",
    translations: ["row", "line", "profession"],
    tags: ["source:cedict"]
  }
]
```

This is **not** what we want:

```ts id="sg1cra"
{
  word: "行",
  pinyin: ["xíng", "háng"],
  translations: [...]
}
```

The existing `WordCard`/deck model can stay unchanged, because generated drill cards only need `hanzi` and `translation`. Your current `WordCard` already has exactly that shape, plus optional tags.

---

## Revised storage layout

Instead of:

```text id="i1tom4"
data/dictionary/cedict.json
data/dictionary/hsk2.json
data/dictionary/hsk3.json
```

Use:

```text id="8iqz3q"
data/lexicon/
  cedict_ts.u8              // downloaded raw CC-CEDICT
  complete.json             // already downloaded HSK/frequency/etc. data
  lexicon.generated.json    // merged normalized output
```

Then server code reads only:

```text id="0j8diq"
data/lexicon/lexicon.generated.json
```

I could not verify the exact path of `complete.json` through the connector: code search timed out, and the obvious paths I tried were not present. The plan should therefore make the path configurable.

```ts id="whxl4y"
const CEDICT_PATH = 'data/lexicon/cedict_ts.u8';
const HSK_COMPLETE_PATH = 'data/lexicon/complete.json';
const LEXICON_OUTPUT_PATH = 'data/lexicon/lexicon.generated.json';
```

---

## Build script

Add:

```text id="92ea3k"
scripts/build-lexicon.ts
```

And in `package.json`:

```json id="7g2roe"
{
  "scripts": {
    "build:lexicon": "tsx scripts/build-lexicon.ts"
  }
}
```

The project already uses `tsx` for build scripts and already has a `build:hanzi-data` script, so this fits the current style.

---

## Merging algorithm

### Input 1: CC-CEDICT

Parse each entry into:

```ts id="0n1zwl"
type CedictEntry = {
  simplified: string;
  pinyin: string;
  translations: string[];
};
```

Ignore traditional writing completely.

### Input 2: `complete.json`

Normalize each HSK/frequency item into:

```ts id="2jvoow"
type HskCompleteEntry = {
  word: string;
  tags: string[];
};
```

For example:

```ts id="6t60yq"
{
  word: "学生",
  tags: ["hsk:1", "frequency:834"]
}
```

The exact parser depends on the actual shape of `complete.json`.

---

## Lexicon key

Use this key:

```ts id="qk3dpr"
function lexiconKey(word: string, pinyin: string): string {
  return `${word}\u0000${pinyin}`;
}
```

Why not just `word`?

Because polyphonic entries must stay separate.

```text id="num955"
行 + xíng → one entry
行 + háng → another entry
```

But for deck export later, duplicates are merged by **word only**, because the drill card does not currently store pinyin.

---

## Generated output format

```ts id="47hh73"
export type GeneratedLexicon = {
  entries: LexiconEntry[];

  byWord: Record<string, string[]>;

  version: {
    generatedAt: string;
    cedictSource: string;
    hskSource: string;
  };
};
```

Example:

```json id="8yjal0"
{
  "entries": [
    {
      "id": "lex_000001",
      "word": "学生",
      "pinyin": "xué sheng",
      "translations": ["student", "schoolchild"],
      "tags": ["source:cedict", "hsk:1", "frequency:834"]
    }
  ],
  "byWord": {
    "学生": ["lex_000001"]
  },
  "version": {
    "generatedAt": "2026-07-02T00:00:00.000Z",
    "cedictSource": "cedict_ts.u8",
    "hskSource": "complete.json"
  }
}
```

---

## Server module

Replace the earlier dictionary/HSK modules with:

```text id="mh21eq"
src/lib/server/lexicon.ts
```

```ts id="zvjp5q"
export type LexiconLookupResult = {
  word: string;
  entries: LexiconEntry[];
};

export async function lookupLexicon(word: string): Promise<LexiconLookupResult> {
  const lexicon = await loadLexicon();
  const ids = lexicon.byWord[word] ?? [];

  return {
    word,
    entries: ids.map((id) => lexicon.entriesById[id])
  };
}
```

Internally, after loading JSON, build an in-memory index:

```ts id="5420dp"
type LoadedLexicon = {
  entriesById: Record<string, LexiconEntry>;
  byWord: Record<string, string[]>;
};
```

---

## Updated token model

Replace `dictionaryMatches` and `hskLevels` with one field:

```ts id="66p9x0"
export type StudyToken = {
  id: string;
  sentenceId: string;

  start: number;
  end: number;
  text: string;

  kind: 'word' | 'named_entity' | 'punctuation' | 'unknown';

  autoProposed: boolean;
  manuallyEdited: boolean;

  lexiconEntries: LexiconEntry[];

  selectedLexiconEntryId?: string;
  selectedTranslation?: string;

  manualPinyin?: string;
  manualTranslation?: string;
};
```

For a normal word:

```text id="u3nu2w"
token.text
  ↓
lookupLexicon(token.text)
  ↓
token.lexiconEntries
  ↓
user selects one entry/pronunciation
  ↓
user selects one translation from that entry
```

For a named entity:

```text id="mt7qri"
kind = "named_entity"
  ↓
disable lexicon translation picker
  ↓
allow manualPinyin
  ↓
allow manualTranslation / note
```

This matches your rule: named entities should not use normal dictionary translation selection.

---

## Updated lookup endpoint

Use:

```text id="i0f8qg"
POST /api/study-texts/[id]/lookup-tokens
```

Request:

```ts id="rx4ucj"
type LookupTokensRequest = {
  sentenceId: string;
  tokens: Array<{
    id: string;
    text: string;
    start: number;
    end: number;
    kind: StudyToken['kind'];
  }>;
};
```

Response:

```ts id="671j3u"
type LookupTokensResponse = {
  tokens: Array<{
    tokenId: string;
    lexiconEntries: LexiconEntry[];
  }>;
};
```

No separate HSK lookup is needed. HSK/frequency/etc. are just tags on each `LexiconEntry`.

---

## UI changes

### Token info card

Instead of separate blocks:

```text id="u3y7la"
Dictionary matches
HSK levels
Frequency
```

show one list of lexicon entries:

```text id="be1pya"
学生
xué sheng
Tags: hsk:1 · frequency:834
Translations:
[student] [schoolchild]
```

If multiple pronunciations exist:

```text id="47d7jj"
行

Entry 1:
xíng
Tags: source:cedict
[to walk] [okay] [capable]

Entry 2:
háng
Tags: source:cedict
[row] [line] [profession]
```

Selection should be two-level:

```text id="k1uw96"
1. Select pronunciation / lexicon entry.
2. Select contextual translation from that entry.
```

For most words there will be only one entry, so the UI can auto-expand it.

---

## Auto-splitter change

The maximum-match fallback should use the merged lexicon:

```ts id="bs6i91"
function dictionaryMaxMatch(sentence: string, lexicon: LoadedLexicon): SplitterToken[] {
  // longest substring where lexicon.byWord[substring] exists
}
```

This is better than using CC-CEDICT alone because HSK-only/frequency-only words also become valid segmentation candidates.

Priority remains:

```text id="i9blq8"
1. Impl.Splitter
2. Lexicon longest-match
3. Intl.Segmenter
4. Character-by-character fallback
```

---

## Deck export rule

Study token state contains pinyin and tags, but current drill cards only store:

```ts id="jgyu5m"
{
  hanzi: string;
  translation: string;
}
```

The existing drill persistence normalizes rows into cards with `hanzi` and `translation`.

So deck export should merge by `token.text`, not by `(word, pinyin)`.

```ts id="4bkfjw"
function collectDeckRows(study: StudyText): DrillRowInput[] {
  const byWord = new Map<string, Set<string>>();

  for (const sentence of study.sentences) {
    if (!sentence.selected) continue;

    for (const token of sentence.segmentation.tokens) {
      if (token.kind === 'punctuation') continue;
      if (token.kind === 'named_entity') continue;

      const translation = token.selectedTranslation ?? token.manualTranslation;
      if (!translation) continue;

      if (!byWord.has(token.text)) {
        byWord.set(token.text, new Set());
      }

      byWord.get(token.text)!.add(translation.trim());
    }
  }

  return [...byWord.entries()].map(([hanzi, translations]) => ({
    hanzi,
    translation: [...translations].join('; ')
  }));
}
```

Example:

```text id="p3qi59"
学生 → student
学生 → schoolchild
```

becomes one card:

```ts id="luh7l2"
{
  hanzi: "学生",
  translation: "student; schoolchild"
}
```

This fits the existing `/api/drills/[id]` save endpoint, which accepts rows of `{ hanzi, translation }`.

---

## Revised file layout

```text id="tzqdse"
data/
  lexicon/
    cedict_ts.u8
    complete.json
    lexicon.generated.json

scripts/
  build-lexicon.ts

src/lib/lexicon/
  types.ts
  parseCedict.ts
  parseCompleteHsk.ts
  mergeLexicon.ts

src/lib/server/
  lexicon.ts
  splitter.ts

src/lib/study-text/
  types.ts
  parseText.ts
  segmentation.ts
  deckExport.ts
```

Remove the planned separate files:

```text id="nyb3sk"
src/lib/server/dictionary.ts
src/lib/server/hsk.ts
src/lib/dictionary/hsk.ts
```

They are unnecessary.

---

## Revised implementation order

Use this order:

```text id="qqva1u"
1. Add LexiconEntry type.
2. Add parseCedict.ts.
3. Add parseCompleteHsk.ts for complete.json.
4. Add mergeLexicon.ts.
5. Add scripts/build-lexicon.ts.
6. Generate data/lexicon/lexicon.generated.json.
7. Add server-side loadLexicon() with cache.
8. Add lookupLexicon(word).
9. Use lexicon.byWord in splitter fallback.
10. Use LexiconEntry[] in StudyToken.
11. Build TokenInfoCard around lexicon entries and tags.
12. Export selected translations into existing drill cards.
```

This keeps the data model simple:

```text id="9aj8hx"
one word
one pinyin
many translations
many tags
```

and all source-specific metadata becomes just tags.



