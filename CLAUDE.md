# sp-context CLI Reference

## Commands (via Bash, pipe mode auto-outputs JSON)

```
sp search <query> [--type <t>] [--tags <t1,t2>] [--limit <n>] [--mode or] [--snippet]
sp get <path>
sp list <category> [--project <name>]
sp push --title <t> --type <type> [--tags <t1,t2>] [--content <text> | --file <path>]
sp add <file|dir> [--to <path>] [--yes]
sp delete <path>
sp move <path> --to <dir>
sp doctor
sp schema
sp gc [--yes]
sp sync
sp config list|add|switch
```

## Types

reference | learning | decision | meeting | status | playbook | personal

## Categories

context/ | decisions/ | experience/ | meetings/ | plans/ | playbook/ | people/

## Progressive loading

Session start injects catalog overview (~100 tokens). Use `sp search` for summaries, `sp get` for full docs.

## Skills

- `/sp-context:sp-setup` — Check dependencies and guide installation
- `/sp-context:sp-quick` — Low-friction one-line knowledge capture
- `/sp-context:sp-harvest` — Batch sync from claude-mem
- `/sp-context:sp-health` — Knowledge quality check + auto-fix
