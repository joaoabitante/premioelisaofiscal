# Checklist de segurança — GitHub (você altera)

Documento gerado na auditoria de segurança do perfil **@joaoabitante** e do repo **premioelisaofiscal**.

**O que o código já corrigiu sozinho** (após o commit desta versão):

- [x] `.gitignore` reforçado (`.env`, chaves, `.claude/`, `.cursor/`, `.grok/`, `.wrangler/`)
- [x] Pasta `.claude/` removida do versionamento (não vai mais para o GitHub)
- [x] `SECURITY.md` com canal de reporte
- [x] Este checklist versionado em `docs/`

**O que só você pode fazer** (marque com `[x]` conforme for concluindo):

---

## 1. Conta GitHub — autenticação (crítico · 5 min)

Abra: https://github.com/settings/security

- [ ] **Ativar 2FA** (Authenticator app — preferível a SMS)
- [ ] Salvar **códigos de recuperação** em local offline (papel/cofre), não no OneDrive do projeto
- [ ] Em **Sessions**: https://github.com/settings/sessions — encerrar sessões que você não reconhece

---

## 2. Email nos commits (privacidade · 5 min)

Hoje os commits públicos usam o e-mail real da contabilidade. Isso fica **para sempre** no histórico antigo; daqui pra frente dá para parar.

### No site GitHub

1. https://github.com/settings/emails  
2. Marque **Keep my email addresses private**  
3. Marque **Block command line pushes that expose my email** (recomendado)  
4. Copie o endereço **noreply** mostrado (formato parecido com):  
   `NUMERO+joaoabitante@users.noreply.github.com`

### No seu PC (PowerShell)

```powershell
git config --global user.name "João Abitante"
git config --global user.email "COLE_AQUI_O_NOREPLY@users.noreply.github.com"
```

Confira:

```powershell
git config --global --get user.email
```

- [ ] Noreply configurado no Git global  
- [ ] Próximo commit no GitHub já aparece **sem** o Gmail real  

> Não reescreva o histórico antigo só por causa do e-mail (trabalho grande, pouco ganho). Foque nos commits novos.

---

## 3. Tokens, SSH e apps (crítico · 10 min)

### Chaves e tokens

- [ ] https://github.com/settings/keys — só chaves SSH que você reconhece; apague as outras  
- [ ] https://github.com/settings/tokens — revogue PATs antigos/sem uso  
- [ ] Preferir **Fine-grained personal access token** com escopo mínimo e expiração curta  
- [ ] **Nunca** colar token em chat, issue, commit ou arquivo no OneDrive do projeto  

### Aplicativos conectados (Cloudflare)

- [ ] https://github.com/settings/installations — revisar **Cloudflare Workers and Pages**  
- [ ] Confirmar que o app só tem acesso aos repos que precisam de deploy  
- [ ] Remover acesso de apps que você não usa  

### PRs abertas do bot Cloudflare (este repo)

Há PRs automáticas de configuração Wrangler:

1. https://github.com/joaoabitante/premioelisaofiscal/pull/1  
2. https://github.com/joaoabitante/premioelisaofiscal/pull/2  

- [ ] Abrir cada PR e **ler o diff**  
- [ ] Se o site **já publica** com push na `main` (Workers Assets / Pages já ok): **Close pull request** sem merge  
- [ ] Só faça merge se você **quiser** o `wrangler.jsonc` no repo e souber que não quebra o deploy atual  
- [ ] Depois de fechar: em Cloudflare, conferir se **Web Analytics / RUM / Workers Logs / Logpush** estão **desligados** (modelo de privacidade do projeto)

---

## 4. Proteção da branch `main` (alto · 5 min)

Repo: https://github.com/joaoabitante/premioelisaofiscal/settings/branches  

- [ ] **Add branch protection rule** com nome `main`  
- [ ] Marcar **Do not allow bypassing the above settings** (se disponível no seu plano)  
- [ ] **Lock branch** ou no mínimo:  
  - [ ] **Restrict force pushes** (bloquear force push)  
  - [ ] **Restrict deletions**  
- [ ] (Opcional solo) exigir PR antes de merge — útil se usar agentes/CI; se atrapalhar fluxo solo, pode deixar só o bloqueio de force push  

Repita nos outros repos com **deploy automático** (ex.: `abitanteventures`, `mundialTAX` se aplicável).

- [ ] Proteção aplicada em todos os repos com produção

---

## 5. Code security do repositório (médio · 5 min)

Em cada repo importante → **Settings → Code security and analysis**  
Atalho do Prêmio: https://github.com/joaoabitante/premioelisaofiscal/settings/security_analysis  

- [ ] **Dependency graph** — Enable  
- [ ] **Dependabot alerts** — Enable (mesmo com poucas deps, boa higiene)  
- [ ] **Secret scanning** — Enable  
- [ ] **Push protection** (secret scanning) — Enable  
- [ ] **Private vulnerability reporting** — Enable  

Conta (padrão para repos novos): https://github.com/settings/security_analysis  

- [ ] Defaults da conta alinhados com o acima  

---

## 6. Features que viram spam (baixo · 3 min)

Em **cada** repositório público que **não** usa wiki:

Settings → Features → desmarque **Wikis**

Repos públicos do perfil:

| Repo | Wiki off? | Deve ser private? |
|------|-----------|-------------------|
| premioelisaofiscal | [ ] | Não (OSS intencional) |
| abitanteventures | [ ] | Não, se for site da marca |
| mundialTAX | [ ] | Avaliar |
| copa2026 | [ ] | Avaliar |
| aprendasobrekyc | [ ] | Avaliar |
| compliance | [ ] | Avaliar |
| trucolegends | [ ] | Avaliar |
| **elisaofiscal** (produto fiscal) | — | [ ] Confirmar que está **Private** |

- [ ] Confirme em https://github.com/joaoabitante?tab=repositories se `elisaofiscal` **não** aparece como público (recomendado: Private)

---

## 7. Perfil e identidade (opcional · 2 min)

https://github.com/settings/profile  

- [ ] Decidir se o nome exibido deve ser civil completo ou marca pública  
- [ ] Bio / site apontando para `elisaofiscal.net` ou projetos, se quiser  
- [ ] Homepage do repo Prêmio: https://github.com/joaoabitante/premioelisaofiscal/settings — campo **Website** = `https://premio.elisaofiscal.net`  

---

## 8. Cloudflare (deploy · 5 min)

Dashboard: https://dash.cloudflare.com  

- [ ] Projeto do Prêmio ligado só ao repo **premioelisaofiscal** (não a outro repo por engano)  
- [ ] Deploy automático: branch **main**  
- [ ] **Web Analytics** off  
- [ ] **RUM** off  
- [ ] **Workers Logs / Logpush** off  
- [ ] API Tokens Cloudflare: https://dash.cloudflare.com/profile/api-tokens — revogar tokens não usados; nunca commitar token  

---

## 9. PC / Git local (5 min)

- [ ] Credenciais Git: preferir SSH ou Git Credential Manager (não arquivo `.git-credentials` no OneDrive do projeto)  
- [ ] Confirmar remotes do Prêmio:  

```powershell
cd "C:\Users\jcba_\OneDrive\Área de Trabalho\Projetos\premioelisaofiscal"
git remote -v
```

Deve mostrar **apenas**:

```text
origin  https://github.com/joaoabitante/premioelisaofiscal.git
```

- [ ] Se aparecer outro remote (`elisaofiscal` etc.): `git remote remove NOME`  
- [ ] Nunca `git push --force` em `main` de produção sem backup  

---

## 10. Ordem sugerida se estiver cansado

Faça **só isto** primeiro (15 minutos):

1. [ ] 2FA  
2. [ ] Fechar as 2 PRs do Cloudflare (se deploy já funciona)  
3. [ ] Bloquear force push na `main`  
4. [ ] Email noreply no `git config`  
5. [ ] Secret scanning + push protection  

O resto pode ficar para outro dia.

---

## O que **não** precisa fazer

- Reescrever histórico git só para trocar e-mail antigo  
- Adicionar dependências “de segurança” no Prêmio (não há backend com auth)  
- Tornar o Prêmio privado (é open source de propósito)  

---

## Contato / dúvida

Após marcar os itens críticos (seções 1–4), o nível de higiene da conta fica alinhado ao de um dev sênior solo com deploy em produção.

Última revisão do documento: 2026-07-10 · Prêmio Cripto v1.5.2
