# AGENTS.md — Prêmio Cripto

> Contexto para qualquer assistente de IA (Claude Code, Codex, Cursor, Gemini CLI…).
> Autor: João Carlos Bueno Abitante (Contador CRC-SP 320961/O-4).

## Identidade
- **Projeto:** Prêmio Cripto — monitor open-source de prêmio (spread %) de criptomoedas (BTC/USDT) entre exchanges globais e locais, em tempo real.
- **Repo:** github.com/joaoabitante/premioelisaofiscal
- **Domínio:** premio.elisaofiscal.net · **Hospedagem:** Vercel (Cloudflare só DNS, sem Workers/Pages)
- **Stack:** site estático; doação exclusivamente via LiveTip (nenhum outro meio).

## Como trabalhar
- Leia o `README.md` e o `CHANGELOG.md` deste projeto (se existirem) antes de qualquer mudança.
- O **GitHub é a única fonte da verdade**; a Vercel é espelho (deploy automático no push).
- Nunca faça deploy manual (`vercel --prod`) nem publique com árvore suja; nunca edite no painel da Vercel.
- Trabalhe em branch (`fix/descricao-curta`); commits atômicos (`fix:`, `chore:`, `seo:`).
- Mantenha o `CHANGELOG.md` atualizado a cada entrega (padrão de todos os projetos do autor).
- Nunca commite segredo; env vars vivem só na Vercel e o nome (sem valor) vai em `.env.example`.

## Princípios não-negociáveis
- **Privacidade/LGPD:** zero coleta de dado pessoal; ferramentas client-side não fazem requisição de rede em runtime; zero tracker/analytics de terceiros; `referrer: no-referrer`.
- **Dependências:** preferir solução estática e autocontida (single-file quando possível), sem CDN e sem framework desnecessário.
- **Linguagem:** pt-BR direto e concreto, sem buzzword; nunca prometer função que não existe.
- **SEO e segurança:** meta tags + OpenGraph + canonical + JSON-LD nas páginas públicas; headers no `vercel.json` (CSP restritiva, HSTS, nosniff, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`).
- **Acessibilidade:** `lang="pt-BR"`, contraste AA, foco visível, `alt`/`aria`.

## Regras completas
As regras operacionais completas de todos os projetos estão em `../AGENTS.md`
(raiz da pasta mãe Projetos) e o catálogo em `../projetos.json`. Se este repo
foi clonado fora da pasta mãe, este arquivo já cobre o essencial.
