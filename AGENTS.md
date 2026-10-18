# Trans Limbus — AGENTS.md

Vietnamese localization (dịch) project for the mobile game **Limbus Company**. There is no application code to build: the deliverable is a set of translated JSON data files plus two TTF fonts, copied from the game's original data, translated, then published into the game's `Lang/` folder. Git and CodeGraph track the history of these data changes.

## Repository layout
- `Work/` — the working set of translated data. 2405 JSON files + 2 TTF, **no language prefix** on file names.
  - Top-level: `AbEvents.json`, `Skills.json`, `AbDlg_*.json`, `AbnormalityGuides.json`, `ActionEvents.json`, ...
  - `Work/StoryData/` — story files named `1D101A.json`, `1D102A.json`, ...
  - `Work/RPGSystem/` — `rpg-loc-dialogue-floor-1.json`, `rpg-loc-dialogue-common.json`, ...
  - `Work/BattleAnnouncerDlg/`, `Work/BgmLyrics/`, `Work/EGOVoiceDig/`, `Work/PersonalityVoiceDlg/`
  - `Work/Font/Context/vi2.ttf`, `Work/Font/Title/vi.ttf`
- `.codegraph/` — CodeGraph index. **Do not hand-edit `codegraph.db`.**
- `.git/` — git repo, batch-based history. `tools/qa/` — QA/progress tooling (Node, no dependencies). No `package.json`, no build/test/lint config — this is a data repo.

## Source (game, read-only)
`D:\Program Files\Steam\steamapps\common\Limbus Company\LimbusCompany_Data\Assets\Resources_moved\Localize`
- `en/`, `kr/`, `jp/` — original strings. File names carry a **language prefix**: `EN_AbEvents.json`, `EN_1D101A.json`, `EN_Announcer_Dante_1.json`.
- `etc/VoiceTable.json`, `RemoteLocalizeFileList.json` — the canonical (unprefixed) file list.
- The **logical** file name is the name **without** the language prefix (`EN_AbEvents.json` → `AbEvents`).

## Output (game, publish here)
`D:\Program Files\Steam\steamapps\common\Limbus Company\LimbusCompany_Data\Lang`
- `config.json` — `{"lang": "HK_V081026_By_AI", ...}` points at the current output folder.
- `HK_<date>_By_AI/` — one folder per release. File names match `Work/` (**no** language prefix). Existing: `HK_V081026_By_AI/` (current). The date is `ddmmyy` (day/month/year) of the release; the observed folder adds a `V` (version) prefix (`V081026` = 08/10/2026).

## Workflow (copy → translate → publish)
1. Copy the needed files from `Localize/en/` into `Work/`, stripping the `EN_` prefix so the name matches the logical name.
2. Translate the string values to Vietnamese; keep the schema, ids, keys and structure intact.
3. Publish: copy `Work/` files into `Lang/HK_<ddmmyy>_By_AI/` (create the folder if new), then set `"lang"` in `Lang/config.json` to that folder name.
- There is **no automated build/test/lint** for this repo. Correctness is verified by opening the published folder in the game.

## File formats & conventions (must preserve)
- **UTF-8 with BOM** (`EF BB BF`) and **CRLF** line endings. Most `Work/` files already have this; some (e.g. `Skills.json`, `BgmLyrics/`) do not. Match the source file you copied.
- Every JSON is a single root object with a `dataList` array of records.
- Preserve `id`, `key`, `personalityid`, `teller`, `speaker`, indices, and all non-string fields. Translate only human-readable string values (`dialog`, `desc`, `title`, `content`, `text`, `name`, ...).
- Do **not** translate: `[OnSucceedAttack]`-style mechanic tokens, `<color=#ebcaa2>` tags, `{0}`/`{1}` placeholders, or the Korean `model` values (e.g. `그레고르`) — those are identifiers the game uses.
- Naming is the #1 source of bugs: `Work/` and `Lang/HK_*/` use **no prefix**; only the game's `Localize/en|kr|jp/` folders use `EN_`/`KR_`/`JP_`.

## CodeGraph (query the data)
CLI v1.6.0 is installed. The index is currently **empty (0 files)** — rebuild it after touching `Work/`:
- `codegraph init "D:\Workspace\Trans Limbus"` — init + first index.
- `codegraph index "D:\Workspace\Trans Limbus"` — full re-index.
- `codegraph sync "D:\Workspace\Trans Limbus"` — incremental update after edits.
- `codegraph status "D:\Workspace\Trans Limbus"` — verify node/file counts.
- `codegraph query "AbEvents"` / `codegraph explore "dialogue"` / `codegraph files "D:\Workspace\Trans Limbus"` — search/query.

## QA workflow (`tools/qa/`)
The repo is being run through systematic translation QA in numbered batches (see `git log --oneline`; per-file state in `tools/qa/progress.json`).
- `node tools/qa/progress.mjs status|next|claim|start|done|fail|skip|reset|info` — track per-file progress; `claim` moves pending files to `in_progress`.
- `node tools/qa/progress.mjs order <file>` — full work brief: rules, glossary, safe-edit template, reporting requirements.
- `node tools/qa/progress.mjs dump <file> <start> <count>` — EN↔VI string pairs as JSON lines (`i/key/path/en/vi`, recurses into `levelList`/`coinlist`); use for large files instead of reading them whole.
- `node tools/qa/apply.mjs <file> <replacements.json>` — apply `[{"old","new"}]` exact-value replacements safely (round-trip check on BOM/CRLF/indent, prints hit counts).
- `node tools/qa/progress.mjs verify <file...>` — structural check vs EN/KR: record/id alignment, field shape, mechanic tokens `[]<>{}` and `\n` counts (recursive). Fix all ERRORs and token WARNs before marking done.
- Editing rules: only string values; keep every token/tag/placeholder and the record structure; natural Vietnamese matching EN (cross-check KR when ambiguous); repo normalizations (e.g. EN "Inflict" → "Gây", "Kỹ năng" → "Kĩ năng", Clash (cơ chế) → "Đối kháng") — full list in `order` output + `glossary.json`; pending repo-wide decisions in `open-items.json`.
- Worker discipline: edit only the assigned `Work/` file (plus temp files outside the repo), never run git, never touch `progress.json`; the coordinator updates progress and commits per batch.

## Git (change history)
Repo exists; commit per logical batch:
- `git add <files> && git commit -m "<verb> <what>, <scope>"` — QA passes use e.g. `QA improve batch 45: <files> (~N edits)`.
- `git status` / `git log --oneline` / `git diff` to inspect.
- Commit before publishing to `Lang/` so the published set is traceable.

## Pitfalls
- `.codegraph/codegraph.db` is generated — never commit or edit it by hand (`.codegraph/.gitignore` already excludes it).
- `Work/` files can be very large (some >300 KB, e.g. `Skills_Abnormality-a1c9p3.json`); `git diff` on them is slow.
- The game reads `Lang/config.json["lang"]` to pick the output folder — publishing to a new `HK_...` folder without updating `config.json` leaves the game on the old one.
- Some translated content is still in progress (incomplete). Do not overwrite finished work with a partial pass.
