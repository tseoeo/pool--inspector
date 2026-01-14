# Collaboration Guide

Simple rules for working together on this project with Claude Code.

## Team Setup

| Person | Works on | Branch name |
|--------|----------|-------------|
| Ivan | Data integrations, sources, ingestion, database | `ivan` |
| Colleague | Frontend, SEO, visualization, UI | `frontend` |

## How Branches Work

Think of branches like separate workspaces. You each have your own, and changes don't affect each other until you merge.

```
main (the live version)
  ├── ivan (your data work)
  └── frontend (colleague's UI work)
```

## Starting Your Work Session

**First time only** - Create your branch:
```
create a branch called "ivan" and switch to it
```

**Every other time** - Switch to your branch and get latest:
```
switch to my ivan branch and pull latest changes, also pull any updates from main
```

## While Working

Work normally. Your changes only affect your branch.

- **Commit often** - Tell Claude: `commit these changes`
- **Push when done for the day** - Tell Claude: `push my changes`

## When Your Feature is Ready for the Live Site

1. **Make sure everything works locally**
   ```
   run the dev server and test
   ```

2. **Merge main into your branch first** (in case colleague deployed something)
   ```
   merge main into my branch and resolve any conflicts
   ```

3. **Merge your branch into main and deploy**
   ```
   switch to main, merge my ivan branch, push, and deploy to railway
   ```

4. **Tell your colleague** that you deployed

## Quick Commands Reference

| What you want | Tell Claude |
|---------------|-------------|
| See what branch you're on | `what branch am I on` |
| Switch to your branch | `switch to ivan branch` |
| See all branches | `show all git branches` |
| Save your work | `commit these changes` |
| Push your branch | `push my changes` |
| Get teammate's changes | `pull latest from main into my branch` |
| Deploy to live | `switch to main, merge ivan, push, deploy to railway` |

## File Ownership (Who Edits What)

This reduces conflicts. Try to stay in your areas:

### Ivan's Files (Data/Backend)
```
src/ingestion/          # All ingestion code
src/types/              # Type definitions
prisma/                 # Database schema and seeds
scripts/                # Data scripts
workers/                # Background workers
src/app/api/            # API endpoints
src/lib/                # Shared utilities
```

### Colleague's Files (Frontend/SEO)
```
src/app/page.tsx                    # Homepage
src/app/layout.tsx                  # Layout and nav
src/app/globals.css                 # Styling
src/app/(seo)/                      # All SEO pages
  ├── closures/
  ├── explore/
  ├── facilities/
  └── jurisdictions/
src/app/sitemap.ts                  # SEO sitemap
src/app/robots.ts                   # SEO robots
```

### Shared Files (Coordinate Before Editing)
```
package.json            # Dependencies
CLAUDE.md               # Documentation
CONTRIBUTING.md         # This file
```

## If You Need to Edit a Shared File

1. Tell your colleague first
2. Pull latest from main
3. Make your change, commit, push
4. Tell your colleague to pull

## Handling Conflicts

If Claude says there are merge conflicts:
```
show me the conflicts and help me resolve them
```

Usually means you both edited the same file. Claude will show you both versions and help pick the right one.

## Daily Workflow Example

**Starting your day:**
```
switch to my ivan branch and pull latest, also get any updates from main
```

**During work:**
```
[make changes with Claude]
commit these changes
```

**End of day:**
```
push my changes
```

**When feature is done:**
```
merge main into my branch, then switch to main, merge ivan, push, and deploy to railway
```

## Communication Template

When you deploy to main, tell your colleague:

```
Hey, I just deployed to main.

What I added:
- [describe changes]

You should:
- Pull main into your branch before continuing

Any issues: [none / describe]
```

## If Something Goes Wrong

### Site is broken after deploy
```
check railway logs and show me what's wrong
```

### Need to undo a deploy
```
show me recent commits on main and help me revert to the last working version
```

### Lost work somehow
```
show me the git reflog and help me recover my changes
```

## Project Links

- **GitHub:** https://github.com/tseoeo/pool--inspector
- **Railway Dashboard:** https://railway.com/project/dc717d4d-c3d8-4728-838e-a439e6a44f53
