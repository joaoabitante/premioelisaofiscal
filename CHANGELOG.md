# 📋 Log de atualizações

Todas as mudanças relevantes do **Prêmio Cripto** são registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/) e o versionamento é [SemVer](https://semver.org/lang/pt-BR/).

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
