# ⚡ Lottus Trading Pro V2

> Sinais de trading com **entrada na próxima vela** — análise técnica real para Mercado Aberto e OTC.

![Demo](assets/images/preview.png)

## 🎯 O que é diferente na V2?

| V1 (anterior) | V2 (agora) |
|---------------|------------|
| Sinal do momento atual | ➡️ **Sinal para a PRÓXIMA vela** |
| Sem timer | ➡️ **Contagem regressiva** até a entrada |
| Sem indicação de quando entrar | ➡️ **Banner ativo** com timer de entrada |
| Gráfico sem sinal | ➡️ **Sinal marcado no gráfico** |
| Timeline simples | ➡️ **Timeline visual**: Vela Atual → Próxima Vela → Resultado |


## 🧠 NOVO: Inteligência Artificial com Memória de Padrões

A V2 agora inclui um **sistema de IA** que aprende sozinho com cada resultado:

### Como funciona a memória mágica

```
Vela 1: RSI sobrevendido + MACD bullish → CALL → WIN ✅
        ↓ [IA memoriza o padrão]
Vela 2: RSI sobrevendido + MACD bullish → CALL → WIN ✅
        ↓ [IA reforça o padrão]
Vela 3: RSI sobrevendido + MACD bullish → CALL → LOSS ❌
        ↓ [IA ajusta o peso do MACD]
Vela 4: RSI sobrevendido + MACD bullish → CALL → IA diz "cuidado!"
```

### O que a IA faz

| Recurso | Descrição |
|---------|-----------|
| **Memória de padrões** | Armazena até 500 padrões de velas no IndexedDB |
| **Extração de features** | Analisa: preço, volume, forma da vela, tendência, horário |
| **Similaridade** | Compara padrões atuais com histórico (0-100%) |
| **Predição** | Prevê win/loss baseado em padrões similares |
| **Boost de score** | Ajusta o score do sinal (+/- 15 pontos) |
| **Pesos dinâmicos** | Indicadores que acertam ganham peso, os que erram perdem |
| **Estatísticas por horário** | Aprende quais horários são mais favoráveis |
| **Estatísticas por dia** | Aprende quais dias da semana são melhores |
| **Estatísticas por ativo** | Aprende quais pares são mais previsíveis |

### Dashboard da IA

A interface mostra em tempo real:
- **Padrões na memória** — quantos padrões a IA já aprendeu
- **Taxa de aprendizado** — % de acerto dos padrões memorizados
- **Indicador mais confiável** — qual indicador a IA confia mais agora
- **Pesos dos indicadores** — barras visuais mostrando a confiança da IA em cada um

### Padrões de velas reconhecidos

- 🕯️ **Doji** — indecisão do mercado
- 🔨 **Hammer** — reversão de baixa
- ⭐ **Shooting Star** — reversão de alta
- 🐂 **Bullish Engulfing** — compra forte
- 🐻 **Bearish Engulfing** — venda forte
- 🪖 **Three White Soldiers** — tendência de alta forte
- 🐦‍⬛ **Three Black Crows** — tendência de baixa forte


## 🚀 Demo ao Vivo

[🔗 Ver demonstração](https://seu-usuario.github.io/lottus-trading-pro-v2/)

## ✨ Funcionalidades Principais

### 🎯 Entrada na Próxima Vela
- Analisa a **vela atual** e indica a direção para a **próxima vela**
- Timer regressivo mostra exatamente **quando entrar**
- Banner destacado com direção, score, payout e tempo restante
- Timeline visual: Vela Atual → Próxima Vela (ENTRAR AQUI) → Resultado

### ⏱️ Timer Regressivo
- Contagem em tempo real até o fechamento da vela atual
- Alerta visual quando faltam **30 segundos** (pisca em vermelho)
- Mostrado na status bar, no banner e na timeline
- Sincronizado com o timeframe selecionado (M1, M5, M15, M30, H1)

### 📊 Análise Técnica Real
| Indicador | Uso no Sinal |
|-----------|-------------|
| **RSI** | Sobrevendido = CALL, Sobrecomprado = PUT |
| **MACD** | Crossover bullish/bearish |
| **Bollinger Bands** | Fora da banda = reversão |
| **Stochastic** | Extremos = reversão |
| **EMA** | Cruzamento de médias |
| **Volume** | Confirmação de força |
| **VWAP** | Ponto de referência |
| **ATR** | Volatilidade |
| **ADX** | Força da tendência |

### 🏪 Mercado Aberto + OTC
- **10 pares** no mercado aberto (EUR/USD, GBP/USD, USD/JPY, etc.)
- **8 pares** OTC com volatilidade maior
- Filtro para mostrar só um tipo ou ambos
- Badge visual identificando o tipo de mercado

### 🤖 6 Robôs Especializados
Cada robô usa combinação única de indicadores:
- 🧠 **Lottus Core** — RSI + MACD + EMA (mais conservador)
- 💓 **Pulse Scan** — Stochastic + Volume (reversões rápidas)
- 🌍 **Atlas Flow** — Bollinger + ATR (breakouts)
- 📐 **Vector Prime** — EMA Cross + Fibonacci (tendência)
- 🛰️ **Signal Orbit** — Volume Profile + VWAP (liquidez)
- 🔮 **Nexus Grid** — Ichimoku + ADX (força tendência)

### 📈 Gráfico em Tempo Real
- Candlestick com EMA20
- **Sinal ativo marcado no gráfico** (círculo com seta)
- Atualização a cada 1 segundo
- 40 candles visíveis

### ⚙️ Configurações Avançadas
- **Timing do sinal**: Início / Meio / Final da vela
- **Auto-confirmar**: Entrada automática quando score > 80
- **Contagem regressiva**: Mostrar/ocultar timer
- Ativar/desativar robôs individualmente
- Notificações: navegador + som

### 📋 Histórico Completo
- Horário do sinal + horário da vela alvo
- Resultado (Win/Loss/Pendente)
- Lucro em %
- Exportação para CSV

## 🛠️ Tecnologias

| Tecnologia | Uso |
|-----------|-----|
| HTML5 | Estrutura semântica com ARIA |
| CSS3 | Estilos, animações, layout responsivo |
| JavaScript Vanilla | Motor de análise técnica + timer de velas |
| Canvas API | Gráfico de candlestick com sinais marcados |
| Web Audio API | Alertas sonoros |
| LocalStorage | Persistência de configurações |

## 📁 Estrutura

```
lottus-trading-pro-v2/
├── index.html              # Interface com 3 views + banner ativo + timeline
├── assets/
│   ├── css/style.css       # Estilos com timer, timeline, banner ativo
│   ├── js/app.js           # Motor de próxima vela + timer + indicadores
│   └── images/
├── .github/workflows/
│   └── deploy.yml          # CI/CD GitHub Pages
├── .gitignore
├── LICENSE
└── README.md
```

## 🚀 Como Usar

### 1. Clone
```bash
git clone https://github.com/seu-usuario/lottus-trading-pro-v2.git
cd lottus-trading-pro-v2
```

### 2. Abra no navegador
```bash
open index.html
# ou
npx serve .
```

### 3. Use o Modo Simulação
1. Clique em **"Modo Simulação"**
2. O timer começa a contar automaticamente
3. Quando o timer atingir o threshold configurado, um sinal aparece
4. O banner mostra: **"Entrar em: 00:45"** (contagem regressiva)
5. Quando chegar a 00:00, a vela fecha e o resultado aparece

### 4. Conecte uma corretora (opcional)
1. Vá em **Config**
2. Selecione sua corretora
3. Insira API Key e Secret
4. Clique em **"Salvar e Conectar"**
5. Volte para **Sinais** e clique **Conectar**

## 🎨 Como Funciona o Timer

```
[12:00:00] ──► [12:05:00] ──► [12:10:00]
  Vela Atual      PRÓXIMA VELA     Resultado
     │                │
     │         [ENTRAR AQUI]
     │                │
  Análise        Timer conta
  técnicos       regressivo
```

1. **Vela atual** é analisada pelos indicadores técnicos
2. No momento configurado (início/meio/final da vela), o sinal é gerado
3. O banner mostra a **direção** (CALL/PUT) e o **timer** até a próxima vela
4. Você entra no **início da próxima vela**
5. Aguarda o **fechamento da próxima vela** para o resultado

## 🧩 Personalização

### Alterar quando o sinal é gerado
```javascript
// Em app.js, linha ~15
const CONFIG = {
  signalTiming: 'early',  // 'early' = início da vela (recomendado)
                          // 'mid' = meio da vela
                          // 'late' = final da vela (últimos 30s)
};
```

### Adicionar novo timeframe
```javascript
// Em app.js, na função getCandleDurationMinutes()
const map = { 'M1': 1, 'M5': 5, 'M15': 15, 'M30': 30, 'H1': 60, 'H4': 240 };
```

### Alterar threshold de score
No painel de filtros, ajuste o slider **"Score mínimo"** (padrão: 65)

## 📊 Roadmap

### V2.1
- [ ] WebSocket para dados reais
- [ ] Conexão com APIs de corretoras (IQ Option, Deriv, etc.)
- [ ] Backtest com dados históricos reais
- [ ] Alertas via Telegram

### V2.2
- [ ] Múltiplos timeframes simultâneos
- [ ] Estratégias customizáveis pelo usuário
- [ ] Modo escuro/claro
- [ ] Sistema de login

### V3.0
- [ ] Execução automática de trades
- [ ] Gestão de risco (stop loss, take profit)
- [ ] Relatórios de performance detalhados
- [ ] App mobile (PWA)

## ⚠️ Aviso Legal

> **ESTE PROJETO É PARA FINS EDUCACIONAIS.**
>
> Os sinais indicam a direção para a **próxima vela** baseados em algoritmos de análise técnica. **Não constituem recomendação de investimento.**
>
> Trading envolve riscos significativos. Nunca invista mais do que pode perder.

## 📄 Licença

MIT License — veja [LICENSE](LICENSE)

---

<p align="center">
  Feito com ⚡ por <a href="https://github.com/seu-usuario">Seu Nome</a>
</p>
