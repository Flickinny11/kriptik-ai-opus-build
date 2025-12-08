# Vercel Deployment Configuration & Troubleshooting Guide

## Overview

This document details the Vercel auto-deployment setup for KripTik AI, which uses a **monorepo structure** with two separate Vercel projects:

1. **Frontend** (`kriptik-ai-opus-build`) - Root directory deployment
2. **Backend** (`kriptik-ai-opus-build-backend`) - Deploys from `server/` subdirectory

Both projects are connected to the same GitHub repository: `Flickinny11/kriptik-ai-opus-build`

---

## Project Configuration

### Frontend Project
- **Project ID**: `prj_MqCB45npYNv8fyQ37mLvtHfmOyqz`
- **Root Directory**: `null` (deploys from repo root)
- **Production URL**: `kriptik-ai-opus-build.vercel.app`

### Backend Project
- **Project ID**: `prj_WdJ8bvaORsFLf9C0TtHiBYTm3tPK`
- **Root Directory**: `server`
- **Production URL**: `kriptik-ai-opus-build-backend.vercel.app`

### Shared Configuration
- **Git Credential ID**: `cred_5c3b265fc0938795c7b3ea5dffdb8e0679774aa5`
- **Production Branch**: `main`
- **Git Provider Options**: `createDeployments: "enabled"`

---

## What Broke (December 8, 2025)

Auto-deployment stopped working. Pushes to the `main` branch were not triggering deployments.

### Symptoms
- Git pushes completed successfully to GitHub
- No new deployments appeared in Vercel
- Manual API deployments still worked
- The `sourceless: true` property was missing from project links

---

## Why It Broke

### Root Cause
The Vercel REST API was used to modify project settings, specifically:
1. PATCH calls to modify `gitProviderOptions`
2. DELETE calls to remove the GitHub link
3. POST calls to recreate the GitHub link

### The Critical Issue
When recreating the GitHub link via the REST API, the **`sourceless: true` property was NOT preserved**.

The `sourceless` property is what enables webhook-triggered auto-deployments. Without it, Vercel doesn't respond to GitHub push events.

### Why the API Doesn't Work
- The Vercel REST API does **NOT** support setting `sourceless: true` when creating a project link
- Even when passing `"sourceless": true` in the request body, the API ignores it
- This property is only properly set when connecting via:
  - Vercel Dashboard UI
  - Vercel CLI (`vercel git connect`)

### Chain of Events
1. API call modified backend project settings
2. GitHub link was deleted and recreated via API
3. `sourceless: true` was lost on the backend
4. Later, the same happened to the frontend during troubleshooting
5. Both projects stopped auto-deploying

---

## How to Fix Auto-Deployment Issues

### Prerequisites
- Vercel CLI installed: `npm install -g vercel`
- Vercel API token (or logged in via `vercel login`)

### Fix Procedure

**For EACH project that isn't auto-deploying:**

```bash
# 1. Navigate to the repository root
cd /path/to/kriptik-ai-opus-build

# 2. Link to the project
vercel link --yes --token=YOUR_TOKEN --project=PROJECT_NAME

# 3. Disconnect the git repository
vercel git disconnect --token=YOUR_TOKEN --yes

# 4. Reconnect the git repository
vercel git connect --token=YOUR_TOKEN --yes
```

### Example: Fix Backend Project
```bash
cd /path/to/repo
vercel link --yes --token=$VERCEL_TOKEN --project=kriptik-ai-opus-build-backend
vercel git disconnect --token=$VERCEL_TOKEN --yes
vercel git connect --token=$VERCEL_TOKEN --yes
```

### Example: Fix Frontend Project
```bash
cd /path/to/repo
vercel link --yes --token=$VERCEL_TOKEN --project=kriptik-ai-opus-build
vercel git disconnect --token=$VERCEL_TOKEN --yes
vercel git connect --token=$VERCEL_TOKEN --yes
```

### Important Notes
- You must do this for **BOTH** projects if both are affected
- The order matters: disconnect THEN connect
- The CLI properly establishes the webhook connection that the API cannot

---

## Verifying Auto-Deployment is Working

### Check via API
```bash
# Check latest deployments for backend
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?projectId=prj_WdJ8bvaORsFLf9C0TtHiBYTm3tPK&limit=1" \
  | jq '.deployments[0] | {sha: .meta.githubCommitSha, state: .state}'

# Check latest deployments for frontend
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?projectId=prj_MqCB45npYNv8fyQ37mLvtHfmOyqz&limit=1" \
  | jq '.deployments[0] | {sha: .meta.githubCommitSha, state: .state}'
```

### Test with a Push
1. Make a small change to both `server/` and root files
2. Commit and push to `main`
3. Check Vercel dashboard or API for new deployments
4. Both projects should show new deployments within 30-60 seconds

---

## Manual Deployment (Emergency)

If auto-deployment is broken and you need to deploy immediately:

```bash
# Deploy backend
curl -X POST -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
  "https://api.vercel.com/v13/deployments" \
  -d '{
    "name": "kriptik-ai-opus-build-backend",
    "project": "prj_WdJ8bvaORsFLf9C0TtHiBYTm3tPK",
    "target": "production",
    "gitSource": {
      "type": "github",
      "org": "Flickinny11",
      "repo": "kriptik-ai-opus-build",
      "ref": "main"
    }
  }'

# Deploy frontend
curl -X POST -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
  "https://api.vercel.com/v13/deployments" \
  -d '{
    "name": "kriptik-ai-opus-build",
    "project": "prj_MqCB45npYNv8fyQ37mLvtHfmOyqz",
    "target": "production",
    "gitSource": {
      "type": "github",
      "org": "Flickinny11",
      "repo": "kriptik-ai-opus-build",
      "ref": "main"
    }
  }'
```

**Note**: There's a rate limit of 100 API deployments per day on the Hobby plan.

---

## What NOT to Do

### ❌ Don't modify project links via REST API
```bash
# DON'T DO THIS - it will break auto-deploy
curl -X DELETE "https://api.vercel.com/v9/projects/$PROJECT_ID/link"
curl -X POST "https://api.vercel.com/v9/projects/$PROJECT_ID/link" -d '...'
```

### ❌ Don't assume `sourceless: true` can be set via API
The API will accept the property but silently ignore it.

### ❌ Don't disconnect one project without reconnecting both
If you disconnect the backend, it affects the shared webhook. You'll need to reconnect both projects.

---

## Key Learnings

1. **Use the CLI, not the API** for git connection management
2. **The `sourceless` property is critical** for webhook-triggered deployments
3. **Both projects share the same GitHub webhook** - changes to one can affect both
4. **Always test after changes** by pushing a commit and verifying both deploy

---

## Quick Reference

| Task | Command |
|------|---------|
| Install CLI | `npm install -g vercel` |
| Link project | `vercel link --project=NAME` |
| Disconnect git | `vercel git disconnect` |
| Connect git | `vercel git connect` |
| Check deployments | `vercel ls` or use API |

---

*Last updated: December 8, 2025*
*Issue resolved by: Using Vercel CLI to disconnect and reconnect git for both projects*

