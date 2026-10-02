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
- **No** `.git`, no `package.json`, no build/test/lint config — this is a data repo.

## Source (game, read-only)
`D:\Program Files\Steam\steamapps\common\Limbus Company\LimbusCompany_Data\Assets\Resources_moved\Localize`
- `en/`, `kr/`, `jp/` — original strings. File names carry a **language prefix**: `EN_AbEvents.json`, `EN_1D101A.json`, `EN_Announcer_Dante_1.json`.
- `etc/VoiceTable.json`, `RemoteLocalizeFileList.json` — the canonical (unprefixed) file list.
- The **logical** file name is the name **without** the language prefix (`EN_AbEvents.json` → `AbEvents`).

## Output (game, publish here)
`D:\Program Files\Steam\steamapps\common\Limbus Company\LimbusCompany_Data\Lang`
- `config.json` — `{"lang": "HK_V270926_By_AI", ...}` points at the current output folder.
- `HK_<date>_By_AI/` — one folder per release. File names match `Work/` (**no** language prefix). Existing: `HK_V270926_By_AI/`. The date is `ddmmyy` (day/month/year) of the release; the observed folder adds a `V` (version) prefix (`V270926` = 27/09/2026).

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

## Git (change history)
No repo yet. Initialize once, then commit per logical batch:
- `git init` (in `D:\Workspace\Trans Limbus`)
- `git add -A && git commit -m "<verb> <what>, <scope>"` (e.g. `git commit -m "translate AbEvents a1c9p1"`)
- `git status` / `git log --oneline` / `git diff` to inspect.
- Commit before publishing to `Lang/` so the published set is traceable.

## Pitfalls
- `.codegraph/codegraph.db` is generated — never commit or edit it by hand (`.codegraph/.gitignore` already excludes it).
- `Work/` files can be very large (some >300 KB, e.g. `Skills_Abnormality-a1c9p3.json`); `git diff` on them is slow.
- The game reads `Lang/config.json["lang"]` to pick the output folder — publishing to a new `HK_...` folder without updating `config.json` leaves the game on the old one.
- Some translated content is still in progress (incomplete). Do not overwrite finished work with a partial pass.
