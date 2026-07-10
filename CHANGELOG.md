# 📋 Log de atualizações

Todas as mudanças relevantes do **Prêmio Cripto** são registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/) e o versionamento é [SemVer](https://semver.org/lang/pt-BR/).

## [1.4.1] — 2026-07-09

### Segurança e privacidade
- Auditoria completa de metadados/perfilamento com correções:
  - Headers de segurança servidos pelo edge (`_headers`): CSP com `frame-ancestors 'none'`, `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, COOP/CORP e HSTS
  - `Permissions-Policy` com opt-out explícito das APIs de perfilamento por anúncios do navegador (Topics, FLoC, ad-auction) e de sensores/câmera/microfone/geolocalização
  - Telemetria NEL/Report-To injetada pela CDN **cancelada** (`max_age: 0`)
  - `rel="noreferrer"` e `Referrer-Policy` também na versão com servidor, que agora responde com os mesmos headers de endurecimento
- Novo [PRIVACY.md](PRIVACY.md): modelo de ameaças honesto — o que o projeto coleta (nada), o que terceiros inevitavelmente veem (IP/Origin) e como o visitante zera até isso (VPN/Tor/DoH/arquivo local)

## [1.4.0] — 2026-07-09

### Adicionado
- **12 novas exchanges**:
  - 🇧🇷 Brasil Bitcoin e Bity (BitPreço)
  - 🇯🇵 bitbank e bitFlyer*
  - 🇹🇷 BtcTurk*
  - 🇰🇷 Coinone*
  - 🇮🇳 CoinDCX
  - 🇿🇦 Luno*
  - 🇨🇱 Buda*
  - 🇦🇺 BTC Markets
  - 🌐 Gemini e Bitstamp* (globais de referência)

  *\* só na versão com servidor — a API não permite chamadas diretas do navegador (CORS)*
- Novas moedas com câmbio automático: JPY, TRY, INR, ZAR, CLP e AUD
- Log de atualizações: `CHANGELOG.md` + modal "📋 atualizações" no rodapé do site

## [1.3.0] — 2026-07-09

### Adicionado
- Site publicado em [premio.elisaofiscal.net](https://premio.elisaofiscal.net) (Cloudflare Workers, deploy automático no push)
- SEO completo: title/description otimizados, canonical, Open Graph + Twitter Card com imagem, JSON-LD (schema.org), seção FAQ indexável, `robots.txt` e `sitemap.xml`
- Detector de bloqueio de CORS: distingue "API fora do ar" de "exchange bloqueou esta origem", com aviso na tabela

### Corrigido
- Deploy no Cloudflare Workers (`.assetsignore` impedindo upload do `node_modules` de build)

## [1.2.0] — 2026-07-09

### Adicionado
- Tile **"Janela de arbitragem"** com o spread total e a direção compre X → venda Y
- Prêmios em pills verde/vermelho com setas ▲▼
- Sparklines de tendência (3 h) por exchange na tabela
- Barra de progresso do ciclo de coleta, toasts de alerta e skeleton loading
- Acessibilidade: `:focus-visible`, `prefers-reduced-motion`, melhorias mobile

## [1.1.0] — 2026-07-09

### Adicionado
- **Versão anônima 100% navegador** (arquivo único): zero armazenamento, CSP restringindo conexões às APIs listadas, requisições sem referrer/credenciais/cache
- Doação via [LiveTip](https://livetip.gg/libertcontador)

## [1.0.0] — 2026-07-09

### Adicionado
- Lançamento: monitor de prêmio (spread %) entre exchanges globais e locais em tempo real
- Backend Node.js sem dependências (proxy/cache + SSE + histórico 24h/7d persistente)
- Tabela ordenada por prêmio, gráfico multi-série, alertas configuráveis, prêmio líquido com taxas editáveis, indicador de exchange instável/offline
