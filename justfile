app_home := env_var_or_default("HERDR_APP_HOME", env_var("HOME") / ".config/herdr-app")

default:
    @just --list

# Unit tests for the pure modules (no Herdr, no kata)
test:
    node --test tests/*.test.mjs

# Load the mod once in Herdr and check its first render
check:
    herdr-app check "{{justfile_directory()}}/mods/kata-todo"

# Claude Code in a Docker sandbox on this repo; reattaches if it exists. Extra args go to claude, e.g. `just sbx --continue`
sbx *args:
    sbx run --name claude-herdr-mod-kata-todo claude "{{justfile_directory()}}" -- {{args}}

# Copy the mod into Herdr, which hot-reloads it
install: test check
    mkdir -p "{{app_home}}/mods/kata-todo"
    rsync -a --exclude gpui-kit.d.ts --exclude herdr.d.ts --exclude jsconfig.json "{{justfile_directory()}}/mods/kata-todo/" "{{app_home}}/mods/kata-todo/"

# Re-render preview.png from docs/preview/preview.html with headless Chrome (macOS)
preview:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1728,1084 --screenshot="{{justfile_directory()}}/preview.png" "file://{{justfile_directory()}}/docs/preview/preview.html" 2>/dev/null
