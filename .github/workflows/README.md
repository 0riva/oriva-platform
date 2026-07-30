# `.github/workflows/` — the `*.disabled` files are Symphony, deliberately switched off

Any file here ending `.disabled` is **preserved, not dead**. GitHub only reads `.yml` / `.yaml` in this directory, so a `.yml.disabled` file cannot trigger, cannot produce a check, and costs no compute — while the work that went into writing it stays in front of you instead of in a commit hunt.

## Why they are off

Chairman, 2026-07-30: *"symphony should not be auto promoting, we are not currently using symphony"* — and then, on keeping them: *"don't delete the hard work we did to create them, just disable them so we can re-explore it in future."*

They were first deleted outright (`timebinder/operations`#65), which went further than intended, then restored here as disabled files (`timebinder/operations`#67). **Symphony is not in use.** Nothing auto-claims an issue, auto-promotes a PR, moves a card, or closes a ticket on merge; a `symphony/*` label on an old ticket is historical residue.

## 🔴 Do NOT just rename them back — they were already broken in two ways

Both predate the deletion, so re-enabling as-is would restore something that did not work correctly:

1. **They point at a dead board.** `symphony-add-to-project.yml` and `symphony-label-to-status.yml` target `users/timebinder/projects/4` (`PVT_kwHOAIHtkM4BW6tN`) — the **retired** Symphony Queue, never a live brand board. A revival must retarget them at the live board (Oriva #5 / Originals #6 / Ultra #7 / Boutique #8) and re-map the Status option IDs, which differ per board.
2. **On the `timebinder` account, Actions cannot run at all** — it is billing-blocked; jobs return `steps: []` with *"The job was not started because recent account payments have failed"*. `0riva` and `Limohawk-Technologies` are **not** blocked and their Actions do execute. So the same file behaves differently depending on which repo it sits in.

⚠️ `conclusion: failure` alone does not prove a billing block — check whether steps ran (`steps: []` = runner never started; executed steps = a real failure).

## Re-enabling, when that is a deliberate decision

```bash
# 1. bring one back
git mv .github/workflows/symphony-merge-promote.yml.disabled \
       .github/workflows/symphony-merge-promote.yml

# 2. BEFORE committing: retarget the board + Status option IDs (see point 1 above)
# 3. confirm this repo's account can run Actions at all (see point 2 above)
```

Full context, the daemon/PM2 setup, and the per-repo restore commits: the `symphony` skill (`~/.claude/skills/symphony/SKILL.md`).
