# tfa-cat — cases & design notes

`tfa-cat` = `cat` + `todoforai:` refs + skill refs + image attach. Lives in `api-apps/tfa-cat`, on bridge PATH
(`~/.todoforai/tools/bin` / `~/.local/bin`). Always runs on the machine whose bash called it → never cross-machine.

## Prerequisite: bash can return images
Today BashTool returns text only (`agent/src/tool/edge/BashTool.jl:87`, `ProcessResult`). Native edge already
detects whole-output `data:image/...;base64` → `contentType` (`edge/bun/src/functions.ts:290-315`), but
`EdgeTransport.t_exec` ignores it; bridge (C) has no detection. See `shell-image-output.md`.

Options:
- **(a) in-band marker** (preferred): tfa-cat prints a marker line (e.g. `data:image/png;base64,...`), BashTool
  parses it after `t_exec` → attachment (reuse ReadTool validation: magic bytes, size caps, base64 check).
  Bridge output policy (10k head + 10k tail, `main.c:195-197`, `ob_resolve` `:1508`) must exempt marker lines,
  or the call needs `output=full` (256 KB).
- **(b) side-channel dir** `TFA_ATTACH_DIR` per exec: bridge creates/exports, ships files back. Needs bridge + backend relay.
- **(c) upload** via `POST /resources/show` with `TODOFORAI_API_TOKEN/URL/TODO_ID/BLOCK_ID`: separate block,
  not attached to the bash result. Fallback for big images.

"What gets recorded": only the bash output stream (the marker line); BashTool turns it into an attachment.

## Cases

```sh
# --- plain text: identical to cat ---
bash: tfa-cat README.md                 # → text, as cat
bash: tfa-cat a.txt b.txt | grep foo    # pipes work, stdout is raw bytes

# --- images ---
bash: tfa-cat shot.png                  # stdout is TTY-less pipe → raw bytes? NO: default for images = attach marker
                                        # (decision: images → marker by default ONLY when stdout is the agent capture,
                                        #  i.e. not redirected; see below)
bash: tfa-cat shot.png > copy.png       # stdout redirected to file → raw bytes, no marker (must not corrupt)
bash: tfa-cat --attach shot.png         # force attach marker → model sees the image
bash: tfa-cat --raw shot.png | base64   # force raw bytes
bash: tfa-cat big.png                   # > size cap → downscale/recompress, or fallback (c) upload + text note

# --- todoforai: refs (served via backend API, env token) ---
bash: tfa-cat todoforai:todos/$TODOFORAI_TODO_ID/report.pdf      # attachment → pdf/text
bash: tfa-cat todoforai:projects/<id>/memory/notes.md            # text
bash: tfa-cat todoforai:skills/pptx/SKILL.md                     # builtin skill body
bash: tfa-cat todoforai:x.md > local.md                          # download to file (raw)

# --- skill refs (resolved locally on THIS machine) ---
bash_pc1:   tfa-cat skill:deploy                 # pc1 workspace has deploy/SKILL.md → prints it
bash_pc1:   tfa-cat skill:deploy/scripts/run.sh  # sub-file of the skill dir
bash_pc2:   tfa-cat skill:blender                # blender only on pc2 → works here
bash_pc1:   tfa-cat skill:blender                # not on pc1 → error: "skill 'blender' not on this machine
                                                 #   (available on pc2: use bash_pc2 / read skill:blender)"
bash_pc1:   tfa-cat skill:pptx                   # builtin → falls back to todoforai:skills/pptx/SKILL.md
# Output first line: "Skill dir: /home/u/proj/.claude/skills/deploy" so scripts can be run with relative paths.
# Short form `tfa-cat blender` (no prefix): only if no local file named `blender` exists — TBD, maybe drop.

# --- read tool equivalent (agent-side, multi-machine) ---
read skill:blender        # agent registry: name → (machine, dir) → reads from pc2, no machine knowledge needed by model
read todoforai:...        # BackendRef, unchanged
```

## Open questions
- Image default: marker only when stdout isn't a file/pipe to another command? (`isatty` doesn't help: capture is a
  pipe/pty too.) Simplest: text default, images need `--attach`; or bridge sets `TFA_CAPTURE=1` and tfa-cat checks
  that stdout is the capture fd (fstat inode compare). Undecided.
- Bridge truncation exemption for marker lines vs. requiring `output=full`.
- Bare `tfa-cat <name>` as skill lookup — ambiguity with files.
- Skill discovery on the machine: reuse edge `get_skills` walk logic (workspace paths from env? need
  `TODOFORAI_WORKSPACE_PATHS` injected by bridge).
