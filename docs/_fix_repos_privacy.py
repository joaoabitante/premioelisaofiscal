# -*- coding: utf-8 -*-
"""Torna privados os repos que nao sao open source; arruma gitignore locais."""
from __future__ import annotations

import json
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

OWNER = "joaoabitante"
# Open source intencional - permanece PUBLICO
KEEP_PUBLIC = {"premioelisaofiscal"}

ROOT = Path(r"C:\Users\jcba_\OneDrive\Área de Trabalho\Projetos")

# (path local, remote repo name se diferente)
LOCAL_REPOS = [
    (ROOT / "premioelisaofiscal", "premioelisaofiscal"),
    (ROOT / "APP - Contbit - para contadores", "APP---Contbit---para-contadores"),
    (ROOT / "Contbit Software As a Service", "Contbit-Software-As-a-Service"),
    (ROOT / "Carteira de Bitcoin" / "cofre-btc-wallet", "cofre-btc-wallet"),
    (ROOT / "Abitante de Pallet", "Abitante-de-Pallet"),
    (ROOT / "Neurocompliance", "Neurocompliance"),
    (ROOT / "Verificador  C.CLASSTRIB", "Verificador-C.CLASSTRIB"),
    (ROOT / "simulador-financeiro-autista", "simulador-financeiro-autista"),
]

GITIGNORE_BODY = """# Higiene de seguranca (2026-07-10)
node_modules/
dist/
build/
.env
.env.*
!.env.example
*.log
.DS_Store
Thumbs.db
.vscode/
.idea/
.wrangler/
.cache/
"""


def get_token() -> str:
    p = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
    )
    if p.returncode != 0:
        raise SystemExit(f"git credential fill falhou: {p.stderr}")
    token = None
    for line in p.stdout.splitlines():
        if line.startswith("password="):
            token = line.split("=", 1)[1].strip()
    if not token:
        raise SystemExit("Token GitHub nao encontrado no Credential Manager")
    return token


def api(method: str, path: str, token: str, body: dict | None = None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "premio-security-fix",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode("utf-8")
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        try:
            errj = json.loads(err)
        except Exception:
            errj = {"message": err}
        return e.code, errj


def list_all_repos(token: str) -> list[dict]:
    repos = []
    page = 1
    while True:
        status, data = api(
            "GET",
            f"/user/repos?per_page=100&page={page}&affiliation=owner&sort=full_name",
            token,
        )
        if status != 200:
            raise SystemExit(f"list repos HTTP {status}: {data}")
        if not data:
            break
        repos.extend(data)
        if len(data) < 100:
            break
        page += 1
    return repos


def run(cmd, cwd=None):
    r = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    return r.returncode, (r.stdout or "").strip(), (r.stderr or "").strip()


def ensure_gitignore(path: Path) -> bool:
    gi = path / ".gitignore"
    if not gi.exists():
        gi.write_text(GITIGNORE_BODY, encoding="utf-8")
        return True
    text = gi.read_text(encoding="utf-8", errors="replace")
    changed = False
    for line in (".env", "node_modules/", "*.log", ".DS_Store"):
        if line not in text:
            text = text.rstrip() + f"\n{line}\n"
            changed = True
    if changed:
        gi.write_text(text, encoding="utf-8")
    return changed or not gi.exists()


def commit_and_push(path: Path, message: str) -> str:
    if not (path / ".git").exists():
        return "sem-git"
    run(["git", "add", "-A"], cwd=path)
    code, st, _ = run(["git", "status", "--porcelain"], cwd=path)
    if not st.strip():
        # still try push if ahead
        code2, ahead, _ = run(["git", "status", "-sb"], cwd=path)
        if "ahead" in ahead:
            c, o, e = run(["git", "push", "-u", "origin", "HEAD"], cwd=path)
            return f"push-only {'OK' if c==0 else e or o}"
        return "limpo"
    c, o, e = run(["git", "commit", "-m", message], cwd=path)
    if c != 0:
        return f"commit-fail: {e or o}"
    c2, o2, e2 = run(["git", "push", "-u", "origin", "HEAD"], cwd=path)
    if c2 != 0:
        return f"commit-ok push-fail: {e2 or o2}"
    return "commit+push OK"


def main():
    token = get_token()
    print("Token obtido (nao exibido).")

    # 1) List all owned repos and set privacy
    repos = list_all_repos(token)
    print(f"Repos na conta: {len(repos)}")
    privacy_results = []
    for r in repos:
        name = r["name"]
        private = r["private"]
        if name in KEEP_PUBLIC:
            if private:
                # ensure public for OSS
                status, data = api(
                    "PATCH", f"/repos/{OWNER}/{name}", token, {"private": False}
                )
                privacy_results.append((name, "force-public", status, data.get("message", "ok")))
            else:
                privacy_results.append((name, "keep-public", 200, "ok"))
            continue
        if private:
            privacy_results.append((name, "already-private", 200, "ok"))
            continue
        status, data = api(
            "PATCH", f"/repos/{OWNER}/{name}", token, {"private": True}
        )
        msg = data.get("message", "ok") if isinstance(data, dict) else str(data)
        privacy_results.append((name, "set-private", status, msg))

    print("\n=== PRIVACIDADE ===")
    for name, action, status, msg in privacy_results:
        print(f"  [{status}] {name}: {action} ({msg})")

    # 2) Local git hygiene
    print("\n=== GIT LOCAL ===")
    for path, remote_name in LOCAL_REPOS:
        if not path.exists():
            print(f"  SKIP missing {path}")
            continue
        changed = ensure_gitignore(path)
        # contbit special already has gitignore
        msg = (
            "chore(security): gitignore higiene (.env, node_modules, logs)\n\n"
            "Evita commit acidental de secrets e artefatos locais."
        )
        result = commit_and_push(path, msg)
        print(f"  {path.name}: gitignore_changed={changed} -> {result}")

    # 3) Verify public list
    print("\n=== PUBLICOS RESTANTES (API user) ===")
    status, pubs = api("GET", f"/users/{OWNER}/repos?per_page=100&type=public", token)
    if status == 200:
        for r in pubs:
            print(f"  PUBLIC: {r['name']} license={(r.get('license') or {}).get('spdx_id')}")
        if not pubs:
            print("  (nenhum)")
    else:
        print(f"  fail {status}")

    print("\nDONE")


if __name__ == "__main__":
    main()
