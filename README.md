# ⚡ Prêmio Cripto

**Monitor open-source de prêmio (spread %) de criptomoedas entre exchanges globais e locais — em tempo real.**

Traders de arbitragem precisam saber, em segundos, quando o preço de um ativo está desalinhado
entre exchanges — comprar na mais barata, vender na mais cara, antes que o spread feche.
Este painel monitora esse desalinhamento continuamente (incluindo o famoso *kimchi premium* coreano
e o prêmio das exchanges brasileiras).

> 🔎 **Somente monitoramento.** O projeto não executa ordens, não guarda chaves de API privadas
> e não é recomendação de investimento. Todos os dados vêm ao vivo das APIs públicas das exchanges.

## Como o prêmio é calculado

```
Prêmio (%) = (Preço_Local / (Preço_Global × Taxa_Câmbio)) − 1
```

- **Preço_Global** = mediana dos preços em USD nas exchanges globais (robusta contra uma exchange fora da linha).
- **Taxa_Câmbio** = USD→BRL / MXN / KRW em tempo real ([ExchangeRate-API](https://www.exchangerate-api.com), com [Frankfurter/BCE](https://frankfurter.app) como reserva).
- **Prêmio líquido** (opcional) = prêmio − taxa de trading local − taxa de trading da global − taxa de saque (taxas editáveis na UI).
- Prêmio **positivo** (verde) = local mais cara · **negativo** (vermelho) = local mais barata.

Binance, Bybit e OKX cotam em USDT; o painel trata USDT ≈ USD na referência global (prática padrão nesse tipo de cálculo — a Coinbase, Kraken e Bitfinex, que cotam em USD, puxam a mediana de volta caso o USDT desancore).

## Exchanges monitoradas

| Globais (referência) | Locais / regionais |
|---|---|
| Binance, Coinbase, Kraken, Bybit, OKX, Bitfinex | 🇧🇷 Mercado Bitcoin, Foxbit, NovaDAX · 🇲🇽 Bitso · 🇰🇷 Upbit, Bithumb |

Ativos: **BTC, ETH, SOL, XRP, USDT** (edite `ASSETS` em [src/exchanges.js](src/exchanges.js)).

## Funcionalidades

- 📊 Tabela comparando todas as exchanges simultaneamente, **ordenada pelo maior prêmio**
- ⏱️ Atualização em tempo real via **SSE** (fallback automático para polling)
- 📈 Gráfico do **histórico do prêmio** (24 h / 7 dias), com tooltip e persistência em disco
- 🔔 **Alertas configuráveis**: notificação do navegador + som quando |prêmio| ≥ limite (ex.: 2%)
- 🟡 Indicador de **exchange instável/offline** quando a API não responde ou o preço para de atualizar
- 💸 **Prêmio líquido** descontando taxas de trading e saque (editáveis por exchange)
- 🌑 Dark mode estilo terminal de trading, números tabulares, sem "piscadas" bruscas, responsivo

## Duas formas de usar

### 🔒 Versão anônima — arquivo único, 100% navegador

Abra [premio-cripto-anonimo.html](premio-cripto-anonimo.html) com **duplo clique** — não precisa de
Node, servidor nem instalação. Feita para não deixar rastro algum:

- **Nada é gravado**: sem cookies, sem localStorage, sem banco, sem servidor — histórico, taxas e
  alertas vivem só na memória da aba e desaparecem ao fechá-la
- **CSP embutida**: o navegador só permite que a página se comunique com as APIs públicas listadas
  no cabeçalho do arquivo — nenhum outro destino, nenhum script externo
- Requisições saem **sem referrer, sem credenciais e sem cache**
- O único rastro que resta são requisições HTTPS comuns do seu IP para as exchanges (o mesmo que
  visitar o site delas) — para ocultar o IP, use VPN ou Tor

Limitações: NovaDAX, Bitso e Bitfinex não permitem chamadas diretas do navegador (CORS), então só
existem na versão com servidor; e o histórico do gráfico acumula apenas enquanto a aba está aberta.

### ⚙️ Versão com servidor (histórico persistente + todas as exchanges)

Requisitos: **Node.js ≥ 18** (sem nenhuma dependência npm).

```bash
git clone https://github.com/joaoabitante/premioelisaofiscal.git
cd premioelisaofiscal
npm start          # abre em http://localhost:8080
```

Variáveis de ambiente opcionais:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `8080` | Porta do servidor |
| `POLL_MS` | `6000` | Intervalo de coleta (mínimo 3000 ms) |

## Arquitetura

```
Navegador ──SSE/REST──▶ server.js (Node, zero deps)
                          ├── src/poller.js     loop de coleta + prêmios + histórico (24h/7d)
                          ├── src/exchanges.js  adaptadores das APIs públicas de ticker
                          └── src/fx.js         câmbio USD→BRL/MXN/KRW com cache e fallback
```

O backend atua como **proxy/cache**: cada exchange é consultada **uma vez por ciclo**,
independentemente de quantos navegadores estejam abertos — isso resolve CORS e respeita os
rate limits das APIs. O histórico persiste em `data/history.json` e sobrevive a reinícios.

### Endpoints

- `GET /api/state` — snapshot completo (preços, prêmios, câmbio, erros)
- `GET /api/history?asset=BTC&range=24h|7d` — séries do prêmio por exchange local
- `GET /api/stream` — SSE com um evento `state` por ciclo de coleta

## Adicionando uma exchange

Acrescente um objeto ao array `EXCHANGES` em [src/exchanges.js](src/exchanges.js) — são ~15 linhas:

```js
{
  id: 'minhaexchange',
  name: 'Minha Exchange',
  kind: 'local',              // 'local' ou 'global'
  currency: 'BRL',            // moeda de cotação (o câmbio é buscado automaticamente)
  region: 'Brasil',
  url: 'https://exemplo.com',
  fees: { trading: 0.5, withdrawal: 0 },
  async fetchPrices(assets) {
    // devolve { BTC: 325000, ETH: 8900, ... } na moeda local (null p/ par inexistente)
  },
}
```

Se a moeda for nova, garanta que a fonte de câmbio a ofereça (ExchangeRate-API cobre ~160 moedas).
A cor da série no gráfico, o cálculo do prêmio, o histórico e os alertas passam a funcionar sozinhos.

## ❤️ Apoie o projeto

Este projeto é gratuito e de código aberto (MIT). Se ele te ajudou a capturar um bom spread,
considere enviar um LiveTip — como em todos os meus projetos:

### 👉 [livetip.gg/libertcontador](https://livetip.gg/libertcontador)

<img src="docs/livetip-qr.png" alt="QR code para doação via LiveTip" width="220" />

O link também está no botão **“♥ Apoiar”** do painel.

👉 **[Conheça todos os meus projetos](https://github.com/joaoabitante)**

## Licença

[MIT](LICENSE) — use, modifique e distribua à vontade. Contribuições são bem-vindas:
abra uma issue ou envie um PR (novas exchanges locais são especialmente úteis!).
