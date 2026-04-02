"""GitHub API helper — reads JSON request from stdin, returns JSON to stdout."""
import json
import sys
import os
import base64

try:
    import requests
except ImportError:
    print(json.dumps({"error": "requests library not installed"}))
    sys.exit(1)

TOKEN = os.environ.get('GITHUB_TOKEN', '')
# Default: github.com. For GitHub Enterprise, set GITHUB_BASE_URL (e.g. https://github.khoury.northeastern.edu/api/v3)
BASE_URL = os.environ.get('GITHUB_BASE_URL', 'https://api.github.com')
MAX_PAGES = 3
TIMEOUT = 15


def api_get(endpoint, params=None):
    """GET with pagination, returns combined list or single object."""
    url = f"{BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    all_results = []
    pages = 0

    while url and pages < MAX_PAGES:
        resp = requests.get(url, headers=headers, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            all_results.extend(data)
        else:
            return data  # Single object
        url = None
        params = None
        link = resp.headers.get('Link', '')
        for part in link.split(','):
            if 'rel="next"' in part:
                url = part.split('<')[1].split('>')[0]
        pages += 1

    return all_results


def handle(req):
    action = req.get("action", "")
    params = req.get("params", {})

    if action == "list_repos":
        org = params.get("org")
        user = params.get("user")
        if org:
            data = api_get(f"/orgs/{org}/repos", {"per_page": 30, "sort": "updated"})
        elif user:
            data = api_get(f"/users/{user}/repos", {"per_page": 30, "sort": "updated"})
        else:
            return {"error": "org or user required"}
        return [{"name": r["name"], "full_name": r["full_name"], "private": r["private"], "updated_at": r.get("updated_at"), "html_url": r["html_url"]} for r in data]

    elif action == "repo_tree":
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        path = params.get("path", "")
        ref = params.get("ref")
        recursive = params.get("recursive", False)
        if not owner or not repo:
            return {"error": "owner and repo required"}
        if recursive:
            # Use Git Trees API for full recursive listing
            tree_ref = ref
            if not tree_ref:
                repo_info = api_get(f"/repos/{owner}/{repo}")
                tree_ref = repo_info.get("default_branch", "main") if isinstance(repo_info, dict) else "main"
            data = api_get(f"/repos/{owner}/{repo}/git/trees/{tree_ref}", {"recursive": "1"})
            if isinstance(data, dict) and "tree" in data:
                return [{"name": f["path"].split("/")[-1], "path": f["path"], "type": "file" if f["type"] == "blob" else "dir", "size": f.get("size", 0)} for f in data["tree"]]
            return data
        ep = f"/repos/{owner}/{repo}/contents/{path}"
        qp = {"ref": ref} if ref else None
        data = api_get(ep, qp)
        if isinstance(data, list):
            return [{"name": f["name"], "type": f["type"], "size": f.get("size")} for f in data]
        return data

    elif action == "commits":
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        if not owner or not repo:
            return {"error": "owner and repo required"}
        qp = {"per_page": int(params.get("limit", 20))}
        if params.get("author"):
            qp["author"] = params["author"]
        if params.get("path"):
            qp["path"] = params["path"]
        if params.get("sha"):
            qp["sha"] = params["sha"]
        data = api_get(f"/repos/{owner}/{repo}/commits", qp)
        return [{"sha": c["sha"][:8], "message": (c["commit"]["message"])[:200], "author": c["commit"]["author"]["name"], "date": c["commit"]["author"]["date"], "url": c["html_url"]} for c in data]

    elif action == "commit_detail":
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        sha = params.get("sha", "")
        if not owner or not repo or not sha:
            return {"error": "owner, repo, and sha required"}
        data = api_get(f"/repos/{owner}/{repo}/commits/{sha}")
        files = data.get("files", [])
        return {
            "sha": data["sha"],
            "message": data["commit"]["message"],
            "author": data["commit"]["author"]["name"],
            "date": data["commit"]["author"]["date"],
            "stats": data.get("stats"),
            "files": [{"filename": f["filename"], "status": f["status"], "additions": f["additions"], "deletions": f["deletions"], "patch": (f.get("patch") or "")[:500]} for f in files[:15]],
        }

    elif action == "pull_requests":
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        if not owner or not repo:
            return {"error": "owner and repo required"}
        state = params.get("state", "open")
        data = api_get(f"/repos/{owner}/{repo}/pulls", {"state": state, "per_page": 20})
        return [{"number": pr["number"], "title": pr["title"], "state": pr["state"], "user": pr["user"]["login"], "created_at": pr["created_at"], "updated_at": pr["updated_at"], "html_url": pr["html_url"]} for pr in data]

    elif action == "pr_detail":
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        number = params.get("number", "")
        if not owner or not repo or not number:
            return {"error": "owner, repo, and number required"}
        data = api_get(f"/repos/{owner}/{repo}/pulls/{number}")
        return {
            "number": data["number"],
            "title": data["title"],
            "state": data["state"],
            "body": (data.get("body") or "")[:1000],
            "user": data["user"]["login"],
            "created_at": data["created_at"],
            "merged_at": data.get("merged_at"),
            "additions": data.get("additions"),
            "deletions": data.get("deletions"),
            "changed_files": data.get("changed_files"),
            "html_url": data["html_url"],
        }

    elif action == "pr_reviews":
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        number = params.get("number", "")
        if not owner or not repo or not number:
            return {"error": "owner, repo, and number required"}
        data = api_get(f"/repos/{owner}/{repo}/pulls/{number}/comments", {"per_page": 50})
        return [{"user": c["user"]["login"], "body": c["body"][:500], "path": c.get("path"), "created_at": c["created_at"]} for c in data]

    elif action == "check_runs":
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        ref = params.get("ref", "main")
        if not owner or not repo:
            return {"error": "owner and repo required"}
        data = api_get(f"/repos/{owner}/{repo}/commits/{ref}/check-runs")
        runs = data.get("check_runs", []) if isinstance(data, dict) else []
        return [{"name": r["name"], "status": r["status"], "conclusion": r.get("conclusion"), "started_at": r.get("started_at"), "completed_at": r.get("completed_at")} for r in runs]

    elif action == "file_content":
        owner = params.get("owner", "")
        repo = params.get("repo", "")
        path = params.get("path", "")
        ref = params.get("ref")
        if not owner or not repo or not path:
            return {"error": "owner, repo, and path required"}
        qp = {"ref": ref} if ref else None
        data = api_get(f"/repos/{owner}/{repo}/contents/{path}", qp)
        if isinstance(data, dict) and data.get("encoding") == "base64" and data.get("content"):
            try:
                decoded = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
                return {"path": data["path"], "size": data["size"], "content": decoded[:6000]}
            except Exception:
                return {"path": data["path"], "size": data["size"], "content": "(binary file)"}
        return data

    else:
        return {"error": f"Unknown action: {action}", "available": ["list_repos", "repo_tree", "commits", "commit_detail", "pull_requests", "pr_detail", "pr_reviews", "check_runs", "file_content"]}


try:
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)
    if not TOKEN:
        print(json.dumps({"error": "GITHUB_TOKEN not set. Add it to .env"}))
        sys.exit(1)

    req = json.loads(raw)
    result = handle(req)
    print(json.dumps(result, indent=2, default=str))
except requests.exceptions.HTTPError as e:
    print(json.dumps({"error": f"GitHub API error: {e.response.status_code} {e.response.text[:500]}"}))
    sys.exit(1)
except Exception as e:
    print(json.dumps({"error": f"{type(e).__name__}: {e}"}))
    sys.exit(1)
