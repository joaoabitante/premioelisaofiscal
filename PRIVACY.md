# 🔒 Privacidade — modelo de ameaças

Este documento descreve, com honestidade técnica, **o que o Prêmio Cripto coleta (nada),
o que terceiros conseguem ver mesmo assim, e como reduzir até isso**. Auditável no código:
todo o site é um único arquivo ([index.html](index.html)).

## O que o projeto coleta e armazena

**Nada.** Não existe backend próprio recebendo dados de visitantes, banco de dados, conta,
cadastro, cookie, localStorage, sessionStorage, IndexedDB, analytics, pixel, fingerprinting
ou qualquer telemetria própria. Configurações (taxas, alertas, séries ocultas) vivem apenas
na memória da aba e desaparecem ao fechá-la. Não há o que vazar, porque nada é guardado.

## Proteções ativas no código

| Proteção | Efeito |
|---|---|
| CSP `default-src 'none'` + allowlist de `connect-src` | O navegador **bloqueia** qualquer conexão que não seja às APIs públicas listadas — mesmo que alguém injetasse código, não haveria para onde exfiltrar |
| CSP `frame-ancestors 'none'` + `X-Frame-Options: DENY` | O painel não pode ser embutido em iframe de terceiros (anti-clickjacking/anti-tracking por embedding) |
| `Referrer-Policy: no-referrer` (header + meta + `rel="noreferrer"`) | Nenhum clique ou requisição revela a página de origem |
| Requisições com `credentials: 'omit'` e `cache: 'no-store'` | Nunca envia cookies a terceiros; não deixa rastro em cache |
| `Permissions-Policy` com Topics/FLoC/ad-auction desligados | Opt-out explícito das APIs de perfilamento por anúncios do navegador |
| `NEL/Report-To` zerados (`max_age: 0`) | Cancela a telemetria de erros de rede que a CDN injeta por padrão |
| Zero scripts/fontes/imagens externas | Nenhuma CDN de terceiros observa o carregamento |
| `X-Content-Type-Options: nosniff`, COOP/CORP, HSTS | Endurecimento padrão contra sniffing, vazamento cross-origin e downgrade de TLS |

## O que terceiros ainda veem (inevitável por arquitetura)

Nenhum site consegue esconder isto — está documentado para você decidir o quanto mitigar:

1. **Cloudflare (host)** vê cada acesso ao site: IP, User-Agent e fingerprint TLS do visitante.
   É inerente a qualquer hospedagem. O projeto não ativa logs, analytics nem RUM.
2. **As exchanges** veem o IP do visitante e o header `Origin: https://premio.elisaofiscal.net`
   (obrigatório em requisições CORS — não é removível). Ou seja: a exchange consegue inferir que
   aquele IP consulta um monitor de arbitragem. Os pedidos são apenas de tickers públicos, sem
   autenticação e sem identidade.
3. **A API de câmbio** (exchangerate-api.com; jsDelivr como reserva rara) vê o IP ~1x a cada 10 min.
4. **O resolvedor DNS** do visitante vê os domínios consultados (site + exchanges).

### Como o visitante zera até isso

- **VPN ou Tor**: esconde o IP de todos os itens acima.
- **DNS-over-HTTPS** (DoH): esconde o item 4 do provedor de internet.
- **Baixar o `index.html` e abrir localmente** (duplo clique): elimina o item 1 por completo —
  o site nem fica sabendo da visita. Funciona idêntico ao site.

## Recomendações a quem hospeda (mantenedor)

No painel do Cloudflare, para manter a promessa de privacidade:

- **Não ativar** Web Analytics / RUM no site.
- **Não ativar** Workers Logs / Logpush / observabilidade no projeto.
- Manter o deploy como assets estáticos (sem Worker script processando requisições).

## Versão com servidor (self-host)

O `server.js` não registra IPs nem requisições (somente erros de coleta das exchanges no
console), não usa cookies e responde com os mesmos headers de endurecimento. As preferências
do painel usam o localStorage **do seu próprio navegador**, e o histórico de prêmios (dados
públicos de mercado, sem qualquer dado pessoal) fica em `data/history.json` na sua máquina.

## LGPD

O projeto não coleta nem trata dados pessoais de visitantes; não há cookies, portanto não há
banner de consentimento a exibir. Os únicos dados trafegados são cotações públicas de mercado.
