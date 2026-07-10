# Auditoria de segurança — todos os projetos

**Data:** 2026-07-10  
**Escopo local:** `OneDrive\Área de Trabalho\Projetos`  
**Escopo GitHub:** públicos de `@joaoabitante` + remotes dos clones locais  
**Método:** leitura estática (gitignore, arquivos versionados, padrões de secret, API pública)  
**Já confirmado por você:** **2FA GitHub = OK**

**Não inclui:** tokens no Windows Credential Manager, painel Cloudflare logado, revisão de RLS no Supabase em runtime.

---

## Resumo executivo

| Nível | Qtd (git local) | Significado |
|-------|-----------------|-------------|
| CRÍTICO | **0** | Nenhum secret tipo `service_role` / chave privada / seed versionado |
| ALTO (corrigido na análise) | **0** | O “ALTO” automático do Contbit era **falso positivo** de `Bearer` em código legítimo |
| ATENÇÃO | vários | Ver tabela por projeto |
| OK referência | 1 | `premioelisaofiscal` |

### O que está bem

- **2FA** na conta GitHub.
- **Prêmio Cripto** público, sem secrets, com SECURITY.md / PRIVACY / CSP.
- **Maioria dos produtos de negócio** (Contbit, Cofre BTC, simuladores, Neurocompliance, etc.) estão **privados** no GitHub (API pública retorna 404).
- **Cofre BTC:** remote privado; `.env` real não encontrado no disco; tem `SECURITY-PRIVACY.md` e `.gitignore` com `.env` / `*.key`.
- **Elisão Fiscal** não aparece como repositório público.

### O que exige sua ação

1. **Contbit (app contadores)** — chave Supabase *publishable* e URL **hardcoded** no front (esperado em SPA; a proteção real é **RLS**). Senha demo `demo1234` no seed — **nunca** em produção.
2. **5+ repos sem `.gitignore`** — risco de commit acidental de `.env`.
3. **Pastas OneDrive sem git** (Elisão zips, KYC-AML, Fator R…) — risco de sincronizar material sensível para a nuvem.
4. **7 repos públicos** — wiki ligada, maioria sem LICENSE; e-mail real em commits históricos.
5. **Conta transversal** — branch protection, secret scanning, e-mail noreply, PRs Cloudflare do Prêmio.

---

## Mapa GitHub

### Públicos (visíveis na API)

| Repo | Wiki | Pages | License | Risco |
|------|------|-------|---------|--------|
| [premioelisaofiscal](https://github.com/joaoabitante/premioelisaofiscal) | sim | não | MIT | Baixo (OSS intencional) |
| abitanteventures | sim | não | — | Baixo (site) |
| mundialTAX | sim | sim | — | Médio (conteúdo fiscal público) |
| copa2026 | sim | sim | — | Baixo |
| aprendasobrekyc | sim | sim | — | Baixo |
| compliance | sim | sim | — | Baixo |
| trucolegends | sim | sim | — | Baixo |

### Privados / não listados (clones locais com remote GitHub)

| Repo (remote) | Notas |
|---------------|--------|
| APP---Contbit---para-contadores | App com Supabase |
| Contbit-Software-As-a-Service | Landing estática |
| cofre-btc-wallet | Carteira — **manter private** |
| Abitante-de-Pallet | |
| Neurocompliance | |
| Verificador-C.CLASSTRIB | |
| simulador-financeiro-autista | |
| elisaofiscal | Produto fiscal — **manter private** |

---

## Detalhe por projeto git local

### 1) premioelisaofiscal — **OK**

| Item | Status |
|------|--------|
| Público OSS | Sim (MIT) |
| Secrets no código | Não |
| .gitignore / SECURITY | Sim |
| Ação | Fechar PRs Cloudflare se deploy ok; desligar Wiki se não usa; branch protection |

---

### 2) APP - Contbit - para contadores — **ATENÇÃO (produto)**

| Item | Status |
|------|--------|
| Visibilidade GitHub | **Private** (bom) |
| `.gitignore` | Existe, mas **falta `.env`** explícito |
| Supabase URL + chave publishable | **Hardcoded** em `app.js` (linhas ~9–10) — padrão SPA; **não** é `service_role` |
| `Bearer` no código | Legítimo (token de sessão do usuário) — **não é secret vazado** |
| `sql/seed.sql` | Senha demo **`demo1234`** documentada — trocar antes de qualquer ambiente real |
| LICENSE | Não |

**Ações recomendadas**

- [ ] Confirmar no Supabase: só chave **publishable/anon** no front; **service_role** só no servidor/edge, nunca no repo
- [ ] Revisar **RLS** em todas as tabelas (clientes de um escritório não veem outro)
- [ ] Nunca rodar `seed.sql` com `demo1234` em produção
- [ ] Adicionar ao `.gitignore`: `.env`, `.env.*`, `supabase/.temp`
- [ ] Secret scanning ligado no repo private (GitHub)

---

### 3) Contbit Software As a Service — **BAIXO/MEDIO higiene**

- Landing estática (`index.html` + SEO).
- **Sem `.gitignore`** (baixo risco agora; adicionar mesmo assim).
- **Private** no GitHub.

**Ação:** criar `.gitignore` mínimo; se for só marketing, ok.

---

### 4) cofre-btc-wallet — **CRÍTICO por natureza · higiene OK no scan**

| Item | Status |
|------|--------|
| Visibilidade | **Private** (essencial) |
| `.gitignore` | Tem `.env`, `*.key` |
| `.env` real no disco | Não encontrado |
| `SECURITY-PRIVACY.md` | Existe (boa maturidade) |
| LICENSE | Não |

**Ações (carteira = zero tolerância)**

- [ ] Nunca tornar o repo público
- [ ] Seed/mnemonic **só** no dispositivo do usuário, nunca em issue/chat/OneDrive “docs”
- [ ] Não versionar `backend/.env` real
- [ ] Manter branch protection + 2FA (já tem)
- [ ] Evitar screenshots de seed no PC sincronizado

---

### 5) Abitante de Pallet · Neurocompliance · Verificador C.CLASSTRIB · simulador-financeiro-autista — **MÉDIO (higiene)**

Todos **sem `.gitignore`**, private no GitHub, sem LICENSE.

**Ação comum em cada um:**

```gitignore
node_modules/
.env
.env.*
*.log
.DS_Store
dist/
build/
```

- [ ] Neurocompliance / temas compliance: garantir que **não** há dados reais de cliente no histórico git
- [ ] C.CLASSTRIB / simuladores: se forem produto pago, manter private

---

## Pastas SEM git (OneDrive)

Risco: arquivo sensível sobe para a nuvem sem controle de git.

| Pasta | Observação |
|-------|------------|
| **A Hora Elisão Fiscal** | Vários `.zip` de release / whitelabel — **não** commitar zips com config de cliente |
| KYC-AML | Preferir repo private se houver código; cuidado com dados de KYC |
| Fator R, Mapa Mundial TAX | Lógica fiscal |
| Site João Abitante Ventures | Provável espelho de abitanteventures |
| Cortes Claude, Nova pasta, etc. | Revisar se há prompts com secrets |

**Ação**

- [ ] Não guardar senhas Hostinger / tokens em `.txt` soltos no OneDrive
- [ ] Whitelabel: pasta por cliente com cuidado (PII)

---

## Conta GitHub (todos os projetos)

| # | Item | Status |
|---|------|--------|
| 1 | 2FA | **Feito** |
| 2 | E-mail noreply nos commits novos | [ ] |
| 3 | Secret scanning + push protection (conta + repos) | [ ] |
| 4 | Branch protection `main` (deploy + produtos) | [ ] |
| 5 | PRs Cloudflare Prêmio #1 e #2 | [ ] fechar se deploy ok |
| 6 | Desligar Wiki nos 7 públicos | [ ] |
| 7 | Revisar GitHub Apps (Cloudflare) | [ ] |
| 8 | elisaofiscal e cofre-btc-wallet = Private | [ ] confirmar no dashboard |
| 9 | `.gitignore` nos repos médios | [ ] |
| 10 | Contbit: RLS + sem service_role no front | [ ] |

Checklist detalhado do Prêmio (já em PDF):  
`docs/Checklist-Seguranca-GitHub.pdf` e `docs/CHECKLIST-SEGURANCA-GITHUB.md`

---

## Prioridade se estiver cansado (ordem)

1. ~~2FA~~ **feito**  
2. Confirmar **cofre-btc-wallet** e **elisaofiscal** = Private  
3. Contbit: RLS + nunca `service_role` no front + não usar `demo1234` em prod  
4. Secret scanning na conta  
5. Branch protection nos repos com produção  
6. `.gitignore` nos 5 repos sem ele  
7. E-mail noreply  
8. Wiki off nos públicos  

---

## O que o scan **não** achou (bom sinal)

- Nenhum `ghp_` / `github_pat_` versionado  
- Nenhum `BEGIN PRIVATE KEY`  
- Nenhum `AKIA…` AWS  
- Nenhum `.env` real trackeado nos 8 gits  
- Cofre sem `.env` de produção no disco no momento do scan  

---

*Auditoria automática + revisão manual dos achados ALTO (Contbit). Falsos positivos de `Bearer`/comentários foram filtrados na análise final.*

**Arquivos desta rodada**

- Este relatório: `docs/AUDITORIA-SEGURANCA-TODOS-PROJETOS.md`  
- Script reexecutável: `docs/_audit_all_security.py`  
- Checklist conta (PDF): `docs/Checklist-Seguranca-GitHub.pdf`
