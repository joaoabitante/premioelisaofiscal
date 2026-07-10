# Segurança — Prêmio Cripto

## Modelo do projeto

- **Site público** (`index.html`): 100% no navegador, sem backend, sem cookies, sem localStorage.
- **Self-host** (`server.js`): Node local, sem autenticação de usuários, sem segredos de API de exchange.
- **Não** há chaves de API, tokens ou senhas neste repositório. Se um dia precisar de secret, use variáveis de ambiente (nunca commit).

## O que reportar

Vulnerabilidades reais (XSS, injeção, exposição de dados, bypass de CSP, etc.):

1. **Não** abra issue pública com exploit detalhado.
2. Envie por canal privado ao mantenedor: [github.com/joaoabitante](https://github.com/joaoabitante) (Security advisory do repo, se habilitado, ou contato pelo perfil).
3. Inclua: descrição, impacto, passos de reprodução, versão/commit.

Prazo alvo de resposta: até 14 dias (melhor esforço, projeto pessoal).

## Checklist de conta GitHub

Itens que **só o dono da conta** pode alterar estão em:

**[docs/CHECKLIST-SEGURANCA-GITHUB.md](docs/CHECKLIST-SEGURANCA-GITHUB.md)**

## Referências do projeto

- [PRIVACY.md](PRIVACY.md) — o que terceiros veem e mitigações
- `_headers` — CSP e headers no edge (Cloudflare)
