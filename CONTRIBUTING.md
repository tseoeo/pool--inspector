# Collaboration Guide

Simple rules for working together on this project with Claude Code.

## The Golden Rule

**Only one person works on the project at a time.**

Before starting work, tell your colleague. When you're done, tell them. This avoids 90% of problems.

## Before You Start Working

1. **Pull the latest changes** - Tell Claude:
   ```
   pull the latest changes from git
   ```

2. **Check Railway is healthy** - Tell Claude:
   ```
   check railway status and logs
   ```

## While Working

- **Describe what you want clearly** - Claude will figure out the how
- **Ask Claude to explain** if you don't understand what it's doing
- **Test locally first** - Tell Claude: `run the dev server and check if it works`
- **Small changes are safer** - Don't try to change everything at once

## When You're Done

1. **Commit and push** - Tell Claude:
   ```
   commit and push these changes
   ```

2. **Deploy** - Tell Claude:
   ```
   deploy to railway
   ```

3. **Verify the live site works** - Check the deployed site in your browser

4. **Tell your colleague** you're done

## If Something Goes Wrong

### The site is broken
Tell Claude:
```
the site is broken, check railway logs and fix it
```

### Git says there are conflicts
This happens if you both edited the same file. Tell Claude:
```
there are git conflicts, help me resolve them
```

### You want to undo recent changes
Tell Claude:
```
show me the recent commits and help me revert to a working state
```

### The database seems wrong
Tell Claude:
```
check the database status with prisma studio
```

## Things to Avoid

- **Don't both work at the same time** - This causes merge conflicts
- **Don't force push** - If Claude suggests `git push --force`, say no unless you understand why
- **Don't delete the CLAUDE.md file** - It helps Claude understand the project
- **Don't change database schema casually** - Ask Claude to explain the impact first

## Useful Commands to Ask Claude

| What you want | What to tell Claude |
|---------------|---------------------|
| See what's changed | `show me git status` |
| Start the local server | `run the dev server` |
| Check if code is valid | `run typecheck and lint` |
| See recent changes | `show me the git log` |
| Open database viewer | `open prisma studio` |
| Check deployment | `check railway status` |
| See live site logs | `show railway logs` |

## Project Links

- **GitHub:** https://github.com/tseoeo/pool--inspector
- **Railway:** Check `railway status` for dashboard link

## Communication Template

When handing off to your colleague, share:

```
Hey, I just finished working on the project.

What I did:
- [describe changes]

Current state:
- Deployed: Yes/No
- Working: Yes/No
- Any issues: [describe or "none"]

You're good to start.
```
