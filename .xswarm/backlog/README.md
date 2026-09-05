# Backlog

One file per work item. The gate reads `acceptance:` and refuses to let an
agent stop until it passes, so this is verification infrastructure.

`state`: inbox -> refined -> ready -> active -> review -> done, plus blocked.
`traces_to`: the goal line this serves.

    - text: what must be true
      check: shell command; non-zero means not met     # deterministic
    - text: what must be true                          # no check -> LLM-judged

An item with no executable check cannot reach `ready`.
