# -*- coding: utf-8 -*-
"""Auditoria de seguranca local + GitHub publico (somente leitura)."""
from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(r"C:\Users\jcba_\OneDrive\Área de Trabalho\Projetos")
OUT_MD = Path(__file__).with_name("AUDITORIA-SEGURANCA-TODOS-PROJETOS.md")

SECRET_PATTERNS = [
    (r"ghp_[A-Za-z0-9]{20,}", "GitHub PAT classic"),
    (r"github_pat_[A-Za-z0-9_]{20,}", "GitHub fine-grained PAT"),
    (r"gho_[A-Za-z0-9]{20,}", "GitHub OAuth token"),
    (r"sk-[A-Za-z0-9]{20,}", "OpenAI-like secret key"),
    (r"sk-ant-[A-Za-z0-9\-_]{20,}", "Anthropic key"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID"),
    (r"-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----", "Private key PEM"),
    (r"api[_-]?key\s*[:=]\s*['\"][^'\"]{8,}['\"]", "api_key assignment"),
    (r"password\s*[:=]\s*['\"][^'\"]{4,}['\"]", "password assignment"),
    (r"secret\s*[:=]\s*['\"][^'\"]{8,}['\"]", "secret assignment"),
    (r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", "Bearer token"),
    (r"xox[baprs]-[A-Za-z0-9-]{10,}", "Slack token"),
    (r"cloudflare.*(api|token|key)\s*[:=]", "Cloudflare credential-like"),
]

SKIP_DIRS = {
    ".git", "node_modules", "dist", "build", ".next", ".wrangler",
    "__pycache__", ".venv", "venv", "vendor", ".cache",
}
SKIP_EXT = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".pdf",
    ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mp3", ".zip", ".7z",
    ".exe", ".dll", ".bin", ".map", ".lock",
}
TEXT_HINT = {
    ".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs", ".py", ".html", ".css",
    ".json", ".md", ".env", ".yml", ".yaml", ".toml", ".ini", ".cfg",
    ".sh", ".ps1", ".bat", ".txt", ".xml", ".php", ".rb", ".go", ".rs",
    ".java", ".cs", ".sql", ".vue", ".svelte",
}

SENSITIVE_NAMES = re.compile(
    r"(\.env($|\.)|credentials|secret|id_rsa|\.pem$|\.p12$|\.key$|"
    r"service.?account|firebase|google.?cloud|wallet\.dat|private)",
    re.I,
)


def run(cmd, cwd=None):
    try:
        r = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=60,
        )
        return r.returncode, (r.stdout or "").strip(), (r.stderr or "").strip()
    except Exception as e:
        return 1, "", str(e)


def find_git_repos(root: Path):
    repos = []
    if not root.exists():
        return repos
    for p in root.rglob(".git"):
        if p.is_dir():
            # skip nested deep noise
            rel = p.relative_to(root)
            if len(rel.parts) > 4:
                continue
            repos.append(p.parent)
    return sorted(set(repos), key=lambda x: str(x).lower())


def read_gitignore(repo: Path) -> str:
    g = repo / ".gitignore"
    return g.read_text(encoding="utf-8", errors="replace") if g.exists() else ""


def git_tracked(repo: Path):
    code, out, _ = run(["git", "ls-files"], cwd=repo)
    if code != 0:
        return []
    return out.splitlines() if out else []


def scan_file_content(path: Path, max_bytes=400_000):
    hits = []
    try:
        if path.stat().st_size > max_bytes:
            return hits
        data = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return hits
    for pat, label in SECRET_PATTERNS:
        for m in re.finditer(pat, data, re.I):
            # false positive filters
            s = m.group(0)
            if "example" in s.lower() or "your_" in s.lower() or "xxx" in s.lower():
                continue
            if "password" in label and re.search(r"password\s*[:=]\s*['\"]?\s*['\"]", s, re.I):
                continue
            hits.append((label, s[:80]))
            break
    return hits


def audit_local_repo(repo: Path) -> dict:
    info = {
        "path": str(repo),
        "name": repo.name,
        "remote": "",
        "branch": "",
        "gitignore": False,
        "gitignore_ok": [],
        "gitignore_missing": [],
        "tracked_sensitive": [],
        "content_hits": [],
        "env_files_local": [],
        "has_security_md": False,
        "has_license": False,
        "issues": [],
        "score_notes": [],
    }
    code, remote, _ = run(["git", "remote", "-v"], cwd=repo)
    if code == 0 and remote:
        info["remote"] = remote.splitlines()[0]
    code, branch, _ = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=repo)
    if code == 0:
        info["branch"] = branch

    gi = read_gitignore(repo)
    info["gitignore"] = bool(gi)
    needed = [".env", "node_modules", "*.log", ".DS_Store"]
    for n in needed:
        if n.replace("*", "") in gi or n in gi:
            info["gitignore_ok"].append(n)
        else:
            # flexible match
            base = n.strip("*")
            if base and base in gi:
                info["gitignore_ok"].append(n)
            else:
                info["gitignore_missing"].append(n)

    tracked = git_tracked(repo)
    for f in tracked:
        low = f.lower().replace("\\", "/")
        if SENSITIVE_NAMES.search(low):
            # allow .env.example
            if low.endswith(".env.example") or "example" in low:
                continue
            info["tracked_sensitive"].append(f)
        name = Path(f).name
        if name in (".env", "credentials.json", "serviceAccount.json"):
            info["tracked_sensitive"].append(f)

    # content scan tracked text files (cap)
    scanned = 0
    for f in tracked:
        if scanned >= 200:
            break
        p = repo / f
        if not p.is_file():
            continue
        if p.suffix.lower() in SKIP_EXT and p.suffix.lower() not in TEXT_HINT:
            continue
        if p.suffix.lower() not in TEXT_HINT and p.suffix:
            continue
        hits = scan_file_content(p)
        if hits:
            for label, sample in hits:
                info["content_hits"].append(f"{f}: {label} ({sample[:40]}...)")
        scanned += 1

    # local env not necessarily tracked
    for envp in repo.rglob(".env*"):
        if any(part in SKIP_DIRS for part in envp.parts):
            continue
        try:
            rel = str(envp.relative_to(repo))
        except ValueError:
            continue
        info["env_files_local"].append(rel)

    info["has_security_md"] = (repo / "SECURITY.md").exists()
    info["has_license"] = any(
        (repo / n).exists() for n in ("LICENSE", "LICENSE.md", "LICENSE.txt")
    )

    if info["tracked_sensitive"]:
        info["issues"].append("CRITICO: arquivos sensiveis versionados")
    if info["content_hits"]:
        info["issues"].append("ALTO: padroes de secret no codigo")
    if not info["gitignore"]:
        info["issues"].append("MEDIO: sem .gitignore")
    if info["gitignore_missing"]:
        info["issues"].append(
            f"BAIXO: .gitignore incompleto ({', '.join(info['gitignore_missing'])})"
        )
    if "github.com" in info["remote"] and not info["has_license"]:
        info["issues"].append("BAIXO: repo sem LICENSE")
    if not info["has_security_md"] and "premio" in info["name"].lower():
        info["issues"].append("INFO: sem SECURITY.md")

    return info


def fetch_github_public():
    url = "https://api.github.com/users/joaoabitante/repos?per_page=100&sort=updated"
    req = urllib.request.Request(url, headers={"User-Agent": "security-audit"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def risk_level(issues):
    s = " ".join(issues)
    if "CRITICO" in s:
        return "CRITICO"
    if "ALTO" in s:
        return "ALTO"
    if "MEDIO" in s:
        return "MEDIO"
    if "BAIXO" in s:
        return "BAIXO"
    return "OK"


def main():
    local_repos = find_git_repos(ROOT)
    local_reports = [audit_local_repo(r) for r in local_repos]

    try:
        gh = fetch_github_public()
    except Exception as e:
        gh = []
        gh_err = str(e)
    else:
        gh_err = ""

    lines = []
    lines.append("# Auditoria de seguranca — todos os projetos")
    lines.append("")
    lines.append(f"**Data:** 2026-07-10  ")
    lines.append(f"**Escopo local:** `{ROOT}`  ")
    lines.append("**Escopo GitHub:** repositorios publicos de `@joaoabitante`  ")
    lines.append("**Metodo:** leitura estatica (gitignore, arquivos versionados, padroes de secret, API publica).  ")
    lines.append("**Nao inclui:** 2FA (voce confirmou OK), tokens salvos no Windows Credential Manager, painel Cloudflare logado.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Resumo executivo")
    lines.append("")

    crit = [r for r in local_reports if risk_level(r["issues"]) == "CRITICO"]
    alto = [r for r in local_reports if risk_level(r["issues"]) == "ALTO"]
    medio = [r for r in local_reports if risk_level(r["issues"]) == "MEDIO"]
    baixo = [r for r in local_reports if risk_level(r["issues"]) == "BAIXO"]
    ok = [r for r in local_reports if risk_level(r["issues"]) == "OK"]

    lines.append(f"| Nivel | Qtd |")
    lines.append(f"|-------|-----|")
    lines.append(f"| CRITICO | {len(crit)} |")
    lines.append(f"| ALTO | {len(alto)} |")
    lines.append(f"| MEDIO | {len(medio)} |")
    lines.append(f"| BAIXO | {len(baixo)} |")
    lines.append(f"| OK | {len(ok)} |")
    lines.append(f"| **Total repos git locais** | **{len(local_reports)}** |")
    lines.append(f"| Repos publicos GitHub | {len(gh)} |")
    lines.append("")

    if crit or alto:
        lines.append("### Acao imediata")
        lines.append("")
        for r in crit + alto:
            lines.append(f"- **{r['name']}**: {'; '.join(r['issues'])}")
        lines.append("")
    else:
        lines.append("Nenhum **CRITICO/ALTO** por secret versionado nos repositorios locais escaneados.")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## GitHub publico (@joaoabitante)")
    lines.append("")
    if gh_err:
        lines.append(f"Falha ao listar: {gh_err}")
    else:
        lines.append("| Repo | Visib. | Wiki | Pages | License | Size |")
        lines.append("|------|--------|------|-------|---------|------|")
        for x in gh:
            lic = (x.get("license") or {}).get("spdx_id") or "—"
            lines.append(
                f"| [{x['name']}]({x['html_url']}) | {x.get('visibility','public')} | "
                f"{'sim' if x.get('has_wiki') else 'nao'} | "
                f"{'sim' if x.get('has_pages') else 'nao'} | {lic} | {x.get('size',0)} |"
            )
        lines.append("")
        lines.append("### Riscos comuns da conta (transversal)")
        lines.append("")
        lines.append("| Item | Status / recomendacao |")
        lines.append("|------|------------------------|")
        lines.append("| 2FA | **OK** (voce confirmou) |")
        lines.append("| Email real nos commits | Historico antigo exposto; use noreply daqui pra frente |")
        lines.append("| PRs bot Cloudflare (premio) | Revisar/fechar PR #1 e #2 se deploy ja funciona |")
        lines.append("| Branch protection `main` | Ativar em todos com deploy |")
        lines.append("| Secret scanning + push protection | Ativar na conta e repos |")
        lines.append("| Wiki em repos publicos | Desligar se nao usa (spam) |")
        lines.append("| elisaofiscal | Nao listado como publico (bom se for Private) |")
        lines.append("| Repos sem LICENSE | Habitue MIT/proprietario conforme o caso |")
        lines.append("")

        no_lic = [x["name"] for x in gh if not x.get("license")]
        if no_lic:
            lines.append(f"**Sem LICENSE publica:** {', '.join(no_lic)}")
            lines.append("")
        wiki = [x["name"] for x in gh if x.get("has_wiki")]
        if wiki:
            lines.append(f"**Wiki ligada:** {', '.join(wiki)}")
            lines.append("")
        pages = [x["name"] for x in gh if x.get("has_pages")]
        if pages:
            lines.append(f"**GitHub Pages ligada:** {', '.join(pages)}")
            lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Repositorios git locais (detalhe)")
    lines.append("")

    for r in sorted(local_reports, key=lambda x: (risk_level(x["issues"]), x["name"])):
        lvl = risk_level(r["issues"])
        lines.append(f"### {r['name']} — **{lvl}**")
        lines.append("")
        lines.append(f"- **Path:** `{r['path']}`")
        lines.append(f"- **Branch:** `{r['branch'] or '?'}`")
        lines.append(f"- **Remote:** `{r['remote'] or '(sem remote)'}`")
        lines.append(f"- **.gitignore:** {'sim' if r['gitignore'] else 'NAO'}")
        if r["gitignore_missing"]:
            lines.append(f"- **Falta no gitignore:** {', '.join(r['gitignore_missing'])}")
        if r["tracked_sensitive"]:
            lines.append(f"- **Sensiveis versionados:** {', '.join(r['tracked_sensitive'][:20])}")
        if r["content_hits"]:
            lines.append("- **Padroes suspeitos no codigo:**")
            for h in r["content_hits"][:15]:
                lines.append(f"  - `{h}`")
        if r["env_files_local"]:
            lines.append(f"- **Arquivos .env no disco (podem ser ok se ignorados):** {', '.join(r['env_files_local'][:10])}")
        lines.append(f"- **LICENSE:** {'sim' if r['has_license'] else 'nao'}")
        lines.append(f"- **SECURITY.md:** {'sim' if r['has_security_md'] else 'nao'}")
        if r["issues"]:
            lines.append(f"- **Issues:** {'; '.join(r['issues'])}")
        else:
            lines.append("- **Issues:** nenhuma automatica")
        lines.append("")

    # Non-git project folders
    lines.append("---")
    lines.append("")
    lines.append("## Pastas de projeto SEM git (risco de backup baguncado)")
    lines.append("")
    all_dirs = [p for p in ROOT.iterdir() if p.is_dir()] if ROOT.exists() else []
    git_names = {Path(r["path"]).name for r in local_reports}
    # also nested git
    for r in local_reports:
        git_names.add(Path(r["path"]).name)
    no_git = []
    for d in all_dirs:
        # has any .git inside?
        has = any(True for _ in d.glob("**/.git") if _.is_dir())
        if not has:
            no_git.append(d.name)
    if no_git:
        lines.append("Pastas sem repositorio git detectado (OneDrive pode sincronizar secrets por engano):")
        lines.append("")
        for n in sorted(no_git):
            lines.append(f"- {n}")
        lines.append("")
        lines.append("**Recomendacao:** se houver `.env` ou chaves nessas pastas, garantir que nao vao para nuvem compartilhada / e-mail.")
    else:
        lines.append("Todas as pastas de primeiro nivel tem git ou subprojeto git.")
    lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Checklist transversal (voce executa)")
    lines.append("")
    lines.append("1. [x] 2FA GitHub")
    lines.append("2. [ ] Email noreply nos commits novos")
    lines.append("3. [ ] Secret scanning + push protection (conta + repos)")
    lines.append("4. [ ] Branch protection `main` nos repos com deploy")
    lines.append("5. [ ] Fechar PRs Cloudflare do premioelisaofiscal se deploy ja ok")
    lines.append("6. [ ] Desligar Wiki nos publicos sem uso")
    lines.append("7. [ ] Confirmar elisaofiscal = Private")
    lines.append("8. [ ] Revisar apps OAuth/GitHub Apps (Cloudflare)")
    lines.append("9. [ ] Corrigir .gitignore nos repos MEDIO/BAIXO")
    lines.append("10. [ ] Nunca commitar `.env` / chaves de carteira BTC / tokens contabeis")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Observacoes por tipo de projeto")
    lines.append("")
    lines.append("| Tipo | Exemplos | Risco tipico |")
    lines.append("|------|----------|--------------|")
    lines.append("| Open source site | premioelisaofiscal | Baixo se sem secrets (ja auditado) |")
    lines.append("| SaaS contabeis | Contbit | Alto se API keys / dados clientes vazarem |")
    lines.append("| Carteira Bitcoin | cofre-btc-wallet | **Critico** se seed/private key no git ou OneDrive |")
    lines.append("| Compliance / KYC | KYC-AML, Neurocompliance | Dados sensiveis — preferir private |")
    lines.append("| Simuladores | fator R, C.CLASSTRIB | Medio — logica de negocio se publica |")
    lines.append("")
    lines.append("*Auditoria automatica. Falsos positivos em `password:` de demos/HTML sao possiveis.*")
    lines.append("")

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_MD}")
    print(f"Local git repos: {len(local_reports)}")
    print(f"CRITICO={len(crit)} ALTO={len(alto)} MEDIO={len(medio)} BAIXO={len(baixo)} OK={len(ok)}")
    for r in local_reports:
        print(f"  [{risk_level(r['issues']):7}] {r['name']}")


if __name__ == "__main__":
    main()
