app_home := env_var_or_default("HERDR_APP_HOME", env_var("HOME") / ".config/herdr-app")

default:
    @just --list

# Unit tests for the pure modules (no Herdr, no kata)
test:
    node --test tests/

# Load the mod once in Herdr and check its first render
check:
    herdr-app check "{{justfile_directory()}}/mods/kata-todo"

# Copy the mod into Herdr, which hot-reloads it
install: test check
    mkdir -p "{{app_home}}/mods/kata-todo"
    rsync -a "{{justfile_directory()}}/mods/kata-todo/" "{{app_home}}/mods/kata-todo/"
