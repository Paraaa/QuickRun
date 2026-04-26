# QuickRun – Code Improvement Checklist

Focused on clean code: naming, single responsibility, duplication, and unnecessary complexity.

---

### 1. Rename `customCommand` to `command`

**Files:** [src/types.ts](src/types.ts), everywhere it is referenced

The word "custom" carries no meaning — every command in this extension is a command. The prefix adds noise to every property access, every destructure, and every template string throughout the codebase.

---

### 2. Split `CommandPanel.getHtml()` into smaller methods

**File:** [src/CommandPanel.ts:106-588](src/CommandPanel.ts#L106-L588)

One 480-line method contains all the CSS, all the HTML markup, and all the inline JavaScript. It is hard to navigate and impossible to test any part in isolation. Break it into focused helpers, e.g. `getStyles()`, `getScript()`, and `getBody()`, called from a short `getHtml()`.

---

### 3. Move `GROUP_COLOR_OPTIONS` out of `extension.ts`

**File:** [src/extension.ts:12-20](src/extension.ts#L12-L20)

This constant is pure data — a lookup table of color names and their VS Code token values. It has nothing to do with extension activation. Move it to `types.ts` or a new `constants.ts`.

---

### 4. Extract the duplicated `source` strip into a helper

**File:** [src/ConfigLoader.ts:50-51](src/ConfigLoader.ts#L50-L51) and [src/ConfigLoader.ts:76-77](src/ConfigLoader.ts#L76-L77)

Both `saveProject` and `saveGlobal` do the same transformation:

```ts
commands.map(({ source: _s, ...rest }) => rest)
```

This pattern appears four times (twice for commands, twice for groups). Extract it into a small helper like `stripSource`.

---

### 5. Resolve the `notes` type mismatch between `SuggestedCommand` and `QuickRunCommand`

**Files:** [src/AutoSetupLM.ts:8](src/AutoSetupLM.ts#L8), [src/types.ts:7](src/types.ts#L7), [src/AutoSetup.ts:98](src/AutoSetup.ts#L98)

`SuggestedCommand.notes` is `string | null` but `QuickRunCommand.notes` is `string | undefined`. The mismatch forces an explicit `?? undefined` conversion at the call site. Pick one — `undefined` is the idiomatic TypeScript choice.

---

### 6. Replace the `recheckMode` boolean flag with two clear functions

**File:** [src/AutoSetup.ts:6](src/AutoSetup.ts#L6), [src/extension.ts:129](src/extension.ts#L129)

`runAutoSetup(commandStore, recheckMode = false)` is a function with two personalities controlled by a boolean flag. This is a classic clean code smell. Rename the existing function to `runAutoSetup` (always does a full setup) and extract a `runAutoSetupRecheck` (or inline the recheck branch into its call site in `extension.ts`).

---

### 7. Remove the redundant comment in `utils.ts`

**File:** [src/utils.ts:10](src/utils.ts#L10)

```ts
// All available codicons as a JS array
export const ALLICONS = [
```

The constant name and its type already say this. Delete the comment.

---

### 8. Remove the file-path comment at the top of `GroupItem.ts`

**File:** [src/GroupItem.ts:1](src/GroupItem.ts#L1)

```ts
// src/GroupItem.ts
```

The editor, the import statement, and the filesystem all show the filename. This comment is noise.

---

### 9. Deduplicate the `source` description label logic

**Files:** [src/CommandItem.ts:88](src/CommandItem.ts#L88), [src/GroupItem.ts:13](src/GroupItem.ts#L13)

Both classes contain:

```ts
this.description = data.source === 'global' ? 'global' : 'project';
```

Extract a shared helper, e.g. `sourceLabel(source: ConfigScope): string`, into `utils.ts`.

---

### 10. Make `add()` and `addGroup()` consistent about ID generation

**File:** [src/CommandStore.ts:48-49](src/CommandStore.ts#L48-L49) vs [src/CommandStore.ts:93-94](src/CommandStore.ts#L93-L94)

`add()` always generates a new ID and ignores any ID on the incoming data. `addGroup()` respects an existing ID if provided (`data.id ?? crypto.randomUUID()`). The inconsistency is visible in `AutoSetup.ts`, which pre-generates a group ID so it can build a `groupIdMap` before the save completes.

Either make both methods always generate the ID (and return the generated ID so callers can use it), or make both accept an optional incoming ID. The current asymmetry is confusing.

---

### 11. Fix duplicate entries in the `selectModel()` quick pick

**File:** [src/AutoSetupLM.ts:184-188](src/AutoSetupLM.ts#L184-L188)

```ts
const items = [
  ...known.map(toItem),          // recognized models (e.g. Claude, GPT-5)
  { label: 'All available models', kind: Separator },
  ...models.map(toItem),         // ALL models, including the known ones again
];
```

The `known` models appear twice — once at the top and again in the full list. The "All available models" section should contain only the models *not* already shown above the separator.



---

### 12. Align the `_` underscore convention for private members

**Files:** throughout the codebase

Private fields and methods use a mix of underscore prefix (`_saving`, `_persist`, `_onDidChange`) and no prefix (`saveProject`, `loadGlobal`). TypeScript's `private` keyword already marks visibility — the prefix is redundant when present and misleading when absent. Pick one style and apply it consistently: either always use `private` without underscore, or reserve the underscore for a specific meaning (e.g. internal-only helpers that bypass normal logic).
