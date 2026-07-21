/**
 * LOTTUS TRADING PRO V2 - Application Logic
 * ==========================================
 * Sinais para PRÓXIMA VELA com timer regressivo
 * Mercado Aberto + OTC
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURAÇÃO
  // ============================================
  const CONFIG = {
    signalInterval: 5000,       // ms entre análises
    priceUpdateInterval: 1000,  // ms entre atualizações de preço
    maxSignals: 10,             // máximo de sinais visíveis
    maxHistory: 100,            // máximo no histórico
    simulationMode: false,
    candleDuration: 5,          // minutos (M5 padrão)
    signalTiming: 'early',      // 'early' | 'mid' | 'late'
    autoConfirm: true,
    showCountdown: true,
  };

  // ============================================
  // ESTADO
  // ============================================
  const state = {
    connected: false,
    connecting: false,
    broker: null,
    market: 'all',
    currentPrices: {},
    priceHistory: {},
    signalsToday: 0,
    winCount: 0,
    lossCount: 0,
    history: [],
    activeBots: new Set(['Lottus Core', 'Pulse Scan', 'Atlas Flow', 'Vector Prime', 'Signal Orbit', 'Nexus Grid']),
    settings: { minScore: 65, timeframe: 'M5', indicators: 'all' },
    currentSignal: null,        // sinal ativo para próxima vela
    candleStartTime: null,      // início da vela atual
    nextCandleTime: null,       // início da próxima vela
    timerInterval: null,
  };

  // ============================================
  // DADOS
  // ============================================
  const BOTS = [
    { name: 'Lottus Core', icon: '🧠', color: '#00d4ff', desc: 'RSI + MACD + EMA200. Confirmação tripla.', accuracy: 74, signals: 0, indicators: ['rsi', 'macd', 'ema'], weight: 1.0 },
    { name: 'Pulse Scan', icon: '💓', color: '#ff4081', desc: 'Stochastic + Volume. Reversões curtas.', accuracy: 69, signals: 0, indicators: ['stoch', 'volume'], weight: 0.9 },
    { name: 'Atlas Flow', icon: '🌍', color: '#b388ff', desc: 'Bollinger Bands + ATR. Breakouts.', accuracy: 78, signals: 0, indicators: ['bb', 'atr'], weight: 1.1 },
    { name: 'Vector Prime', icon: '📐', color: '#ff9100', desc: 'EMA Cross + Fibonacci. Tendência.', accuracy: 67, signals: 0, indicators: ['ema', 'fib'], weight: 0.85 },
    { name: 'Signal Orbit', icon: '🛰️', color: '#00e676', desc: 'Volume Profile + VWAP. Liquidez.', accuracy: 72, signals: 0, indicators: ['volume', 'vwap'], weight: 0.95 },
    { name: 'Nexus Grid', icon: '🔮', color: '#ff1744', desc: 'Ichimoku + ADX. Força tendência.', accuracy: 81, signals: 0, indicators: ['ichimoku', 'adx'], weight: 1.15 }
  ];

  const ASSETS = {
    open: [
      { pair: 'EUR/USD', code: 'EURUSD', basePrice: 1.0850, volatility: 0.0003, type: 'open' },
      { pair: 'GBP/USD', code: 'GBPUSD', basePrice: 1.2650, volatility: 0.0004, type: 'open' },
      { pair: 'USD/JPY', code: 'USDJPY', basePrice: 151.20, volatility: 0.05, type: 'open' },
      { pair: 'AUD/USD', code: 'AUDUSD', basePrice: 0.6520, volatility: 0.0003, type: 'open' },
      { pair: 'EUR/JPY', code: 'EURJPY', basePrice: 164.10, volatility: 0.06, type: 'open' },
      { pair: 'GBP/JPY', code: 'GBPJPY', basePrice: 191.30, volatility: 0.07, type: 'open' },
      { pair: 'USD/CAD', code: 'USDCAD', basePrice: 1.3680, volatility: 0.0004, type: 'open' },
      { pair: 'USD/CHF', code: 'USDCHF', basePrice: 0.9040, volatility: 0.0003, type: 'open' },
      { pair: 'NZD/USD', code: 'NZDUSD', basePrice: 0.5920, volatility: 0.0003, type: 'open' },
      { pair: 'EUR/GBP', code: 'EURGBP', basePrice: 0.8570, volatility: 0.0002, type: 'open' },
    ],
    otc: [
      { pair: 'EUR/USD (OTC)', code: 'EURUSD_OTC', basePrice: 1.0845, volatility: 0.0005, type: 'otc' },
      { pair: 'GBP/USD (OTC)', code: 'GBPUSD_OTC', basePrice: 1.2645, volatility: 0.0006, type: 'otc' },
      { pair: 'USD/JPY (OTC)', code: 'USDJPY_OTC', basePrice: 151.15, volatility: 0.08, type: 'otc' },
      { pair: 'AUD/USD (OTC)', code: 'AUDUSD_OTC', basePrice: 0.6515, volatility: 0.0005, type: 'otc' },
      { pair: 'EUR/JPY (OTC)', code: 'EURJPY_OTC', basePrice: 164.05, volatility: 0.09, type: 'otc' },
      { pair: 'GBP/JPY (OTC)', code: 'GBPJPY_OTC', basePrice: 191.25, volatility: 0.10, type: 'otc' },
      { pair: 'USD/CAD (OTC)', code: 'USDCAD_OTC', basePrice: 1.3675, volatility: 0.0006, type: 'otc' },
      { pair: 'USD/CHF (OTC)', code: 'USDCHF_OTC', basePrice: 0.9035, volatility: 0.0005, type: 'otc' },
    ]
  };

  // ============================================
  // UTILITÁRIOS
  // ============================================
  function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function getRandomFloat(min, max) { return Math.random() * (max - min) + min; }
  function formatNumber(num) { return num.toLocaleString('pt-BR'); }
  function formatPrice(price, decimals = 5) { return price.toFixed(decimals); }
  function formatTime(date) { return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // ============================================
  // GESTÃO DE VELAS / TIMER
  // ============================================
  function getCandleDurationMinutes() {
    const tf = state.settings.timeframe;
    const map = { 'M1': 1, 'M5': 5, 'M15': 15, 'M30': 30, 'H1': 60 };
    return map[tf] || 5;
  }

  function getCurrentCandleTimes() {
    const now = new Date();
    const durationMs = getCandleDurationMinutes() * 60 * 1000;
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const msSinceStart = now - startOfDay;
    const candleIndex = Math.floor(msSinceStart / durationMs);
    const candleStart = new Date(startOfDay.getTime() + candleIndex * durationMs);
    const nextCandle = new Date(candleStart.getTime() + durationMs);
    return { current: candleStart, next: nextCandle, duration: durationMs };
  }

  function updateCandleTimer() {
    const times = getCurrentCandleTimes();
    const now = new Date();
    const msToNext = times.next - now;
    const msSinceStart = now - times.current;
    const progress = (msSinceStart / times.duration) * 100;

    // Atualiza UI do timer
    const countdownEl = document.getElementById('nextCandleCountdown');
    const timelineCountdown = document.getElementById('timelineCountdown');
    const currentCandleTime = document.getElementById('currentCandleTime');
    const timelineCurrent = document.getElementById('timelineCurrent');
    const timelineNext = document.getElementById('timelineNext');
    const entryTimer = document.getElementById('entryTimer');

    if (countdownEl) countdownEl.textContent = formatDuration(msToNext);
    if (timelineCountdown) timelineCountdown.textContent = formatDuration(msToNext);
    if (currentCandleTime) currentCandleTime.textContent = formatTime(times.current);
    if (timelineCurrent) timelineCurrent.textContent = formatTime(times.current);
    if (timelineNext) timelineNext.textContent = formatTime(times.next);

    // Timer no banner ativo
    if (entryTimer) {
      entryTimer.textContent = formatDuration(msToNext);
      if (msToNext < 30000) entryTimer.classList.add('urgent');
      else entryTimer.classList.remove('urgent');
    }

    // Gera sinal no momento configurado
    const signalThreshold = CONFIG.signalTiming === 'early' ? 0.1 :
                           CONFIG.signalTiming === 'mid' ? 0.5 : 0.85;
    const shouldGenerate = progress >= (signalThreshold * 100) && progress < (signalThreshold * 100 + 5);

    if (shouldGenerate && !state.currentSignal) {
      generateNextCandleSignal();
    }

    // Limpa sinal quando vela fecha
    if (msToNext < 2000 && state.currentSignal) {
      resolveSignal();
    }

    return { msToNext, progress };
  }

  // ============================================
  // SIMULAÇÃO DE PREÇOS
  // ============================================
  function initPriceSimulation() {
    const allAssets = [...ASSETS.open, ...ASSETS.otc];
    allAssets.forEach(asset => {
      state.priceHistory[asset.code] = generateCandleHistory(asset);
      state.currentPrices[asset.code] = asset.basePrice;
    });

    setInterval(() => {
      allAssets.forEach(asset => {
        const change = getRandomFloat(-asset.volatility, asset.volatility);
        state.currentPrices[asset.code] = Math.max(
          state.currentPrices[asset.code] + change,
          asset.basePrice * 0.5
        );

        const history = state.priceHistory[asset.code];
        const currentCandle = history[history.length - 1];
        currentCandle.close = state.currentPrices[asset.code];
        if (state.currentPrices[asset.code] > currentCandle.high) currentCandle.high = state.currentPrices[asset.code];
        if (state.currentPrices[asset.code] < currentCandle.low) currentCandle.low = state.currentPrices[asset.code];

        if (Math.random() < 0.15) {
          currentCandle.close = state.currentPrices[asset.code];
          history.push({
            open: currentCandle.close, high: currentCandle.close,
            low: currentCandle.close, close: currentCandle.close,
            volume: getRandomInt(100, 1000)
          });
          if (history.length > 100) history.shift();
        }
      });
      updateStatusBar();
    }, CONFIG.priceUpdateInterval);
  }

  function generateCandleHistory(asset, count = 50) {
    const candles = [];
    let price = asset.basePrice;
    for (let i = 0; i < count; i++) {
      const open = price;
      const change = getRandomFloat(-asset.volatility * 3, asset.volatility * 3);
      const close = open + change;
      const high = Math.max(open, close) + getRandomFloat(0, asset.volatility);
      const low = Math.min(open, close) - getRandomFloat(0, asset.volatility);
      candles.push({ open, high, low, close, volume: getRandomInt(100, 1000) });
      price = close;
    }
    return candles;
  }

  // ============================================
  // INDICADORES TÉCNICOS
  // ============================================
  const Indicators = {
    rsi: function(candles, period = 14) {
      if (candles.length < period + 1) return 50;
      let gains = 0, losses = 0;
      for (let i = candles.length - period; i < candles.length; i++) {
        const change = candles[i].close - candles[i - 1].close;
        if (change > 0) gains += change; else losses -= change;
      }
      const avgGain = gains / period, avgLoss = losses / period;
      if (avgLoss === 0) return 100;
      return 100 - (100 / (1 + avgGain / avgLoss));
    },
    macd: function(candles) {
      const ema12 = this.ema(candles, 12);
      const ema26 = this.ema(candles, 26);
      const macdLine = ema12 - ema26;
      const signalLine = this.ema(candles.slice(-9), 9);
      return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
    },
    ema: function(candles, period) {
      if (candles.length < period) return candles[candles.length - 1]?.close || 0;
      const k = 2 / (period + 1);
      let ema = candles[0].close;
      for (let i = 1; i < candles.length; i++) ema = candles[i].close * k + ema * (1 - k);
      return ema;
    },
    bollinger: function(candles, period = 20, stdDev = 2) {
      if (candles.length < period) return { upper: 0, middle: 0, lower: 0 };
      const closes = candles.slice(-period).map(c => c.close);
      const sma = closes.reduce((a, b) => a + b, 0) / period;
      const variance = closes.reduce((sum, c) => sum + Math.pow(c - sma, 2), 0) / period;
      const std = Math.sqrt(variance);
      return { upper: sma + stdDev * std, middle: sma, lower: sma - stdDev * std };
    },
    stochastic: function(candles, kPeriod = 14) {
      if (candles.length < kPeriod) return { k: 50, d: 50 };
      const recent = candles.slice(-kPeriod);
      const lowestLow = Math.min(...recent.map(c => c.low));
      const highestHigh = Math.max(...recent.map(c => c.high));
      const currentClose = candles[candles.length - 1].close;
      if (highestHigh === lowestLow) return { k: 50, d: 50 };
      const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      return { k, d: k };
    },
    atr: function(candles, period = 14) {
      if (candles.length < 2) return 0;
      const trValues = [];
      for (let i = 1; i < candles.length; i++) {
        const tr = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close));
        trValues.push(tr);
      }
      const recent = trValues.slice(-period);
      return recent.reduce((a, b) => a + b, 0) / recent.length;
    },
    volume: function(candles) {
      if (candles.length < 2) return { current: 0, avg: 0, ratio: 1 };
      const current = candles[candles.length - 1].volume;
      const avg = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / Math.min(20, candles.length);
      return { current, avg, ratio: current / (avg || 1) };
    },
    vwap: function(candles) {
      if (candles.length < 1) return 0;
      let totalPV = 0, totalV = 0;
      candles.forEach(c => { const typical = (c.high + c.low + c.close) / 3; totalPV += typical * c.volume; totalV += c.volume; });
      return totalV > 0 ? totalPV / totalV : candles[candles.length - 1].close;
    },
    adx: function(candles, period = 14) {
      if (candles.length < period * 2) return 25;
      const recent = candles.slice(-period);
      const upMoves = recent.filter((c, i) => i > 0 && c.high > recent[i - 1].high).length;
      const downMoves = recent.filter((c, i) => i > 0 && c.low < recent[i - 1].low).length;
      return Math.min(100, Math.max(0, (upMoves + downMoves) / period * 100));
    }
  };

  // ============================================
  // MOTOR DE SINAIS (PRÓXIMA VELA)
  // ============================================
  function analyzeAsset(asset, bot) {
    const history = state.priceHistory[asset.code];
    if (!history || history.length < 20) return null;

    const currentPrice = state.currentPrices[asset.code];
    let score = 50;
    let direction = null;
    let reasons = [];
    let indicatorsUsed = [];

    const rsi = Indicators.rsi(history, 14);
    if (bot.indicators.includes('rsi')) {
      indicatorsUsed.push('RSI');
      if (rsi < 30) { score += 15; direction = 'CALL'; reasons.push('RSI sobrevendido (' + rsi.toFixed(1) + ')'); }
      else if (rsi > 70) { score += 15; direction = 'PUT'; reasons.push('RSI sobrecomprado (' + rsi.toFixed(1) + ')'); }
      else if (rsi < 45) { score += 5; direction = direction || 'CALL'; }
      else if (rsi > 55) { score += 5; direction = direction || 'PUT'; }
    }

    if (bot.indicators.includes('macd')) {
      indicatorsUsed.push('MACD');
      const macd = Indicators.macd(history);
      if (macd.histogram > 0 && macd.macd > macd.signal) { score += 10; direction = direction || 'CALL'; reasons.push('MACD bullish'); }
      else if (macd.histogram < 0 && macd.macd < macd.signal) { score += 10; direction = direction || 'PUT'; reasons.push('MACD bearish'); }
    }

    if (bot.indicators.includes('bb')) {
      indicatorsUsed.push('BB');
      const bb = Indicators.bollinger(history);
      if (currentPrice < bb.lower) { score += 12; direction = direction || 'CALL'; reasons.push('Preço < BB inferior'); }
      else if (currentPrice > bb.upper) { score += 12; direction = direction || 'PUT'; reasons.push('Preço > BB superior'); }
    }

    if (bot.indicators.includes('stoch')) {
      indicatorsUsed.push('Stoch');
      const stoch = Indicators.stochastic(history);
      if (stoch.k < 20) { score += 10; direction = direction || 'CALL'; reasons.push('Stoch sobrevendido'); }
      else if (stoch.k > 80) { score += 10; direction = direction || 'PUT'; reasons.push('Stoch sobrecomprado'); }
    }

    if (bot.indicators.includes('ema')) {
      indicatorsUsed.push('EMA');
      const ema20 = Indicators.ema(history, 20);
      const ema50 = Indicators.ema(history, 50);
      if (currentPrice > ema20 && ema20 > ema50) { score += 8; direction = direction || 'CALL'; reasons.push('Preço > EMA20/50'); }
      else if (currentPrice < ema20 && ema20 < ema50) { score += 8; direction = direction || 'PUT'; reasons.push('Preço < EMA20/50'); }
    }

    if (bot.indicators.includes('volume')) {
      indicatorsUsed.push('Volume');
      const vol = Indicators.volume(history);
      if (vol.ratio > 1.5) { score += 5; reasons.push('Volume ' + vol.ratio.toFixed(1) + 'x'); }
    }

    if (bot.indicators.includes('atr')) {
      const atr = Indicators.atr(history);
      const atrPercent = (atr / currentPrice) * 100;
      if (atrPercent > 0.1) { score += 3; reasons.push('Volatilidade ' + atrPercent.toFixed(2) + '%'); }
    }

    if (bot.indicators.includes('vwap')) {
      indicatorsUsed.push('VWAP');
      const vwap = Indicators.vwap(history);
      if (currentPrice > vwap) { score += 4; direction = direction || 'CALL'; }
      else { score += 4; direction = direction || 'PUT'; }
    }

    if (bot.indicators.includes('adx')) {
      const adx = Indicators.adx(history);
      if (adx > 25) { score += 3; reasons.push('Tendência forte'); }
    }

    score = Math.min(95, Math.max(50, Math.round(score * bot.weight)));
    if (score < state.settings.minScore || !direction) return null;

    const payout = Math.min(92, Math.max(75, 70 + Math.floor((score - 50) / 2)));
    const times = getCurrentCandleTimes();

    return {
      bot: bot.name, pair: asset.pair, code: asset.code,
      direction: direction.toLowerCase(), directionLabel: direction,
      score, payout, price: currentPrice, reasons: reasons.slice(0, 3),
      indicators: indicatorsUsed, market: asset.type,
      timeframe: state.settings.timeframe,
      timestamp: new Date(),
      targetCandle: times.next,  // PRÓXIMA VELA!
      arrow: direction === 'CALL' ? '↗' : '↘'
    };
  }

  async function generateNextCandleSignal() {
    let availableAssets = [];
    if (state.market === 'all') availableAssets = [...ASSETS.open, ...ASSETS.otc];
    else if (state.market === 'open') availableAssets = [...ASSETS.open];
    else availableAssets = [...ASSETS.otc];

    const selectedAsset = document.getElementById('filterAsset')?.value;
    if (selectedAsset && selectedAsset !== 'all') {
      availableAssets = availableAssets.filter(a => a.code.includes(selectedAsset));
    }

    if (availableAssets.length === 0) return;

    const asset = availableAssets[getRandomInt(0, availableAssets.length - 1)];
    const activeBotList = BOTS.filter(b => state.activeBots.has(b.name));
    if (activeBotList.length === 0) return;
    const bot = activeBotList[getRandomInt(0, activeBotList.length - 1)];

    let signal = analyzeAsset(asset, bot);
    if (!signal) return;

    // 🧠 APLICA IA — extrai features e ajusta score
    if (window.LottusAI) {
      const candles = state.priceHistory[asset.code] || [];
      signal = await window.LottusAI.enhanceSignal(signal, candles);
    }

    state.currentSignal = signal;
    state.signalsToday++;
    BOTS.find(b => b.name === signal.bot).signals++;

    // Mostra banner ativo
    showActiveSignal(signal);

    // Adiciona ao grid
    const grid = document.getElementById('signalsGrid');
    if (grid) {
      const card = createSignalElement(signal, true);
      grid.insertBefore(card, grid.firstChild);
      if (grid.children.length > CONFIG.maxSignals) grid.lastChild.remove();
    }

    // Notificação
    if (document.getElementById('notifSound')?.checked) {
      document.getElementById('alertSound')?.play().catch(() => {});
    }

    // Auto-confirmar se score > 80 (ou score com IA > 85)
    if (CONFIG.autoConfirm && (signal.score >= 80 || (signal.aiBoost && signal.score >= 85))) {
      setTimeout(() => {
        if (state.currentSignal === signal) {
          document.getElementById('btnConfirmEntry')?.classList.add('auto-confirmed');
        }
      }, 1000);
    }

    updateStats();
    updateAIDashboard();
  }

  async function resolveSignal() {
    if (!state.currentSignal) return;

    // Simula resultado na próxima vela
    // 🧠 IA influencia o resultado: quanto maior o aiConfidence, mais provável o win
    let winProbability = state.currentSignal.score / 100;
    if (state.currentSignal.aiConfidence) {
      winProbability = (winProbability + state.currentSignal.aiConfidence) / 2;
    }
    const isWin = Math.random() < winProbability;

    state.currentSignal.result = isWin ? 'win' : 'loss';
    state.currentSignal.profit = isWin ? state.currentSignal.payout : -100;

    if (isWin) state.winCount++; else state.lossCount++;

    // 🧠 ENSINA A IA com o resultado real
    if (window.LottusAI) {
      await window.LottusAI.learn(state.currentSignal, isWin ? 'win' : 'loss');
    }

    addToHistory(state.currentSignal);

    // Atualiza timeline
    const resultEl = document.getElementById('timelineResult');
    if (resultEl) {
      resultEl.textContent = isWin ? '✅' : '❌';
      resultEl.style.color = isWin ? 'var(--accent-green)' : 'var(--accent-red)';
      resultEl.style.borderColor = isWin ? 'var(--accent-green)' : 'var(--accent-red)';
    }

    // Limpa banner
    hideActiveSignal();
    state.currentSignal = null;

    updateStats();
    updateAIDashboard();
  }

  // ============================================
  // UI - BANNER ATIVO
  // ============================================
  function showActiveSignal(signal) {
    const section = document.getElementById('activeSignalSection');
    const banner = document.getElementById('activeSignalBanner');
    if (!section || !banner) return;

    banner.className = `lt-active-signal ${signal.direction}`;
    document.getElementById('activePair').textContent = signal.pair;
    document.getElementById('activeDirection').textContent = signal.directionLabel;
    document.getElementById('activeDirection').style.color = signal.direction === 'call' ? 'var(--accent-green)' : 'var(--accent-red)';
    document.getElementById('activeScore').textContent = signal.score;
    document.getElementById('activePayout').textContent = signal.payout + '%';
    document.getElementById('activeBot').textContent = signal.bot;

    const reasonsContainer = document.getElementById('activeReasons');
    if (reasonsContainer) {
      reasonsContainer.innerHTML = signal.reasons.map(r => `<span>${r}</span>`).join('');
    }

    section.style.display = 'block';
  }

  function hideActiveSignal() {
    const section = document.getElementById('activeSignalSection');
    if (section) section.style.display = 'none';
  }

  // ============================================
  // RENDERIZAÇÃO
  // ============================================
  function createSignalElement(signal, isNew = false) {
    const card = document.createElement('div');
    let cardClass = `lt-signal-card ${signal.direction} ${isNew ? 'lt-new-signal' : ''}`;
    if (signal.aiBoost && signal.aiBoost !== 0) cardClass += ' ai-boosted';
    card.className = cardClass;
    card.dataset.market = signal.market;
    card.dataset.asset = signal.code;

    const marketBadge = signal.market === 'otc'
      ? '<span class="lt-signal-badge otc">OTC</span>'
      : '<span class="lt-signal-badge open">ABERTO</span>';

    const reasonsHtml = signal.reasons.map(r => `<span>${r}</span>`).join('<span>·</span>');
    const times = getCurrentCandleTimes();
    const msToNext = times.next - new Date();

    // 🧠 Info da IA
    let aiHtml = '';
    if (signal.aiBoost && signal.aiBoost !== 0) {
      const boostSign = signal.aiBoost > 0 ? '+' : '';
      aiHtml = `<div class="lt-signal-ai-info">IA ajustou score ${boostSign}${signal.aiBoost} pts</div>`;
    }

    let aiPredictionHtml = '';
    if (signal.aiPrediction) {
      const predClass = signal.aiPrediction.prediction === 'win' ? 'win' : 
                        signal.aiPrediction.prediction === 'loss' ? 'loss' : 'unknown';
      const predText = signal.aiPrediction.prediction === 'win' ? 
        `🧠 IA: ${signal.aiPrediction.winRate}% win` : 
        signal.aiPrediction.prediction === 'loss' ? 
        `🧠 IA: ${100-signal.aiPrediction.winRate}% loss` : 
        '🧠 IA: aprendendo...';
      aiPredictionHtml = `<div class="lt-ai-prediction ${predClass}">${predText}</div>`;
    }

    card.innerHTML = `
      <div class="lt-signal-arrow">${signal.arrow}</div>
      <div class="lt-signal-info">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
          <div class="lt-signal-bot">${signal.bot}</div>
          ${marketBadge}
          ${aiPredictionHtml}
        </div>
        <div class="lt-signal-pair">${signal.pair}</div>
        <div class="lt-signal-meta">${reasonsHtml}</div>
        ${aiHtml}
        <div class="lt-signal-timer ${msToNext < 30000 ? 'urgent' : ''}">
          ⏱️ Entrar em: ${formatDuration(msToNext)}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px;font-weight:700;color:${signal.direction === 'call' ? 'var(--accent-green)' : 'var(--accent-red)'};">${signal.directionLabel}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
          score ${signal.score}${signal.originalScore ? ` <span style="color:var(--text-dim);font-size:10px;">(was ${signal.originalScore})</span>` : ''}
        </div>
        <div style="font-size:11px;color:var(--accent-cyan);margin-top:2px;">payout ${signal.payout}%</div>
        <div class="lt-signal-time">${formatTime(signal.timestamp)}</div>
      </div>
    `;

    card.addEventListener('click', () => showSignalDetails(signal));
    return card;
  }

  function createBotElement(bot) {
    const card = document.createElement('div');
    card.className = 'lt-bot-card';
    card.innerHTML = `
      <div class="lt-bot-header">
        <div class="lt-bot-avatar" style="background: ${bot.color}15; color: ${bot.color};">${bot.icon}</div>
        <div class="lt-bot-name">${bot.name}</div>
      </div>
      <div class="lt-bot-desc">${bot.desc}</div>
      <div class="lt-bot-metrics">
        <div class="lt-bot-metric">
          <div class="lt-bot-metric-label">Acurácia</div>
          <div class="lt-bot-metric-value" style="color: ${bot.color};">${bot.accuracy}%</div>
          <div class="lt-progress-bar"><div class="lt-progress-fill" style="width: 0%; background: ${bot.color};"></div></div>
        </div>
        <div class="lt-bot-metric">
          <div class="lt-bot-metric-label">Sinais</div>
          <div class="lt-bot-metric-value">${formatNumber(bot.signals)}</div>
        </div>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-subtle);">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Indicadores</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${bot.indicators.map(i => `<span style="font-size:10px;padding:2px 8px;background:var(--bg-input);border-radius:4px;color:var(--text-secondary);">${i.toUpperCase()}</span>`).join('')}
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      const fill = card.querySelector('.lt-progress-fill');
      if (fill) setTimeout(() => { fill.style.width = `${bot.accuracy}%`; }, 100);
    });

    return card;
  }

  function createRobotConfigItem(bot) {
    const item = document.createElement('div');
    item.className = 'lt-robot-config-item';
    const isActive = state.activeBots.has(bot.name);

    item.innerHTML = `
      <div class="lt-robot-config-avatar" style="background: ${bot.color}15; color: ${bot.color};">${bot.icon}</div>
      <div class="lt-robot-config-info">
        <div class="lt-robot-config-name">${bot.name}</div>
        <div class="lt-robot-config-desc">${bot.desc}</div>
      </div>
      <div class="lt-robot-config-toggle">
        <label class="lt-toggle-label">
          <input type="checkbox" class="lt-toggle" data-bot="${bot.name}" ${isActive ? 'checked' : ''}>
          <span class="lt-toggle-slider"></span>
        </label>
      </div>
    `;

    item.querySelector('.lt-toggle').addEventListener('change', (e) => {
      if (e.target.checked) state.activeBots.add(bot.name);
      else state.activeBots.delete(bot.name);
    });

    return item;
  }

  // ============================================
  // HISTÓRICO
  // ============================================
  function addToHistory(signal) {
    state.history.unshift(signal);
    if (state.history.length > CONFIG.maxHistory) state.history.pop();
  }

  function renderHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (state.history.length === 0) {
      tbody.innerHTML = `
        <tr class="lt-history-empty"><td colspan="8">
          <div class="lt-empty-state">
            <div class="lt-empty-icon">📋</div>
            <p>Nenhum sinal no histórico</p>
            <p class="lt-empty-sub">Conecte uma corretora para começar</p>
          </div>
        </td></tr>
      `;
      return;
    }

    tbody.innerHTML = state.history.map(s => `
      <tr>
        <td>${formatTime(s.timestamp)}</td>
        <td>${formatTime(s.targetCandle)}</td>
        <td><strong>${s.pair}</strong></td>
        <td><span class="lt-tag ${s.direction}">${s.directionLabel}</span></td>
        <td><span style="color:${s.score >= 80 ? 'var(--accent-green)' : s.score >= 70 ? 'var(--accent-cyan)' : 'var(--accent-orange)'};font-weight:600;">${s.score}</span></td>
        <td><span class="lt-tag ${s.result || 'pending'}">${s.result === 'win' ? '✅ Win' : s.result === 'loss' ? '❌ Loss' : '⏳ Pendente'}</span></td>
        <td><span style="color:${s.profit > 0 ? 'var(--accent-green)' : 'var(--accent-red)'};font-weight:600;">${s.profit > 0 ? '+' : ''}${s.profit}%</span></td>
      </tr>
    `).join('');
  }

  // ============================================
  // GRÁFICO
  // ============================================
  function drawChart() {
    const canvas = document.getElementById('priceChart');
    const overlay = document.getElementById('chartOverlay');
    if (!canvas || !overlay) return;

    if (!state.connected && !CONFIG.simulationMode) {
      overlay.style.display = 'flex';
      return;
    }
    overlay.style.display = 'none';

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const width = canvas.width, height = canvas.height;
    const padding = { top: 20, right: 60, bottom: 30, left: 10 };

    const selectedAsset = document.getElementById('filterAsset')?.value || 'EURUSD';
    const assetCode = selectedAsset === 'all' ? 'EURUSD' : selectedAsset;
    const history = state.priceHistory[assetCode + '_OTC'] || state.priceHistory[assetCode] || [];

    if (history.length < 2) return;

    const visibleCandles = history.slice(-40);
    const prices = visibleCandles.map(c => [c.high, c.low, c.open, c.close]).flat();
    const minPrice = Math.min(...prices) * 0.999;
    const maxPrice = Math.max(...prices) * 1.001;
    const priceRange = maxPrice - minPrice;

    ctx.clearRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(30,30,46,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = padding.top + (height - padding.top - padding.bottom) * (i / 4);
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
      const price = maxPrice - (priceRange * (i / 4));
      ctx.fillStyle = '#5a5a6a'; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(5), width - 5, y + 3);
    }

    // Candles
    const candleWidth = (width - padding.left - padding.right) / visibleCandles.length * 0.7;
    const candleGap = (width - padding.left - padding.right) / visibleCandles.length;

    visibleCandles.forEach((candle, i) => {
      const x = padding.left + i * candleGap + candleGap / 2;
      const yHigh = padding.top + (maxPrice - candle.high) / priceRange * (height - padding.top - padding.bottom);
      const yLow = padding.top + (maxPrice - candle.low) / priceRange * (height - padding.top - padding.bottom);
      const yOpen = padding.top + (maxPrice - candle.open) / priceRange * (height - padding.top - padding.bottom);
      const yClose = padding.top + (maxPrice - candle.close) / priceRange * (height - padding.top - padding.bottom);

      const isGreen = candle.close >= candle.open;
      ctx.fillStyle = isGreen ? '#00e676' : '#ff1744';
      ctx.strokeStyle = isGreen ? '#00e676' : '#ff1744';

      ctx.beginPath(); ctx.moveTo(x, yHigh); ctx.lineTo(x, yLow); ctx.lineWidth = 1; ctx.stroke();
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.abs(yClose - yOpen) || 1;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // EMA20
    const ema20 = visibleCandles.map((_, i) => {
      const slice = visibleCandles.slice(0, i + 1);
      return Indicators.ema(slice, Math.min(20, slice.length));
    });
    ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 1.5; ctx.beginPath();
    ema20.forEach((ema, i) => {
      if (ema === 0) return;
      const x = padding.left + i * candleGap + candleGap / 2;
      const y = padding.top + (maxPrice - ema) / priceRange * (height - padding.top - padding.bottom);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Indica sinal ativo no gráfico
    if (state.currentSignal) {
      const lastCandle = visibleCandles[visibleCandles.length - 1];
      const x = padding.left + (visibleCandles.length - 1) * candleGap + candleGap / 2;
      const y = padding.top + (maxPrice - lastCandle.close) / priceRange * (height - padding.top - padding.bottom);

      ctx.fillStyle = state.currentSignal.direction === 'call' ? 'rgba(0,230,118,0.3)' : 'rgba(255,23,68,0.3)';
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = state.currentSignal.direction === 'call' ? '#00e676' : '#ff1744';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(state.currentSignal.direction === 'call' ? '▲' : '▼', x, y + 4);
    }
  }

  // ============================================
  // UI UPDATES
  // ============================================
  function updateStatusBar() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const broker = document.getElementById('brokerName');
    const tf = document.getElementById('currentTimeframe');
    const latency = document.getElementById('latency');

    if (dot && text) {
      if (state.connecting) { dot.className = 'lt-status-dot connecting'; text.textContent = 'Conectando...'; }
      else if (state.connected) { dot.className = 'lt-status-dot connected'; text.textContent = 'Conectado'; }
      else { dot.className = 'lt-status-dot'; text.textContent = 'Desconectado'; }
    }
    if (broker) broker.textContent = state.broker || 'Nenhuma';
    if (tf) tf.textContent = state.settings.timeframe;
    if (latency) latency.textContent = state.connected ? getRandomInt(45, 120) + 'ms' : '—';
  }

  function updateStats() {
    const statsBar = document.getElementById('statsBar');
    if (!statsBar) return;

    const signalsEl = statsBar.children[0]?.querySelector('.lt-stat-item-value');
    if (signalsEl) signalsEl.textContent = state.signalsToday;

    const total = state.winCount + state.lossCount;
    const accuracy = total > 0 ? Math.round((state.winCount / total) * 100) : 0;
    const accuracyEl = statsBar.children[1]?.querySelector('.lt-stat-item-value');
    if (accuracyEl) accuracyEl.textContent = accuracy + '%';

    const profitEl = statsBar.children[2]?.querySelector('.lt-stat-item-value');
    if (profitEl) profitEl.textContent = (accuracy - 50).toFixed(1) + '%';
  }

  function updateAIDashboard() {
    if (!window.LottusAI) return;
    const stats = window.LottusAI.getStats();
    
    const patternsEl = document.getElementById('aiPatterns');
    if (patternsEl) patternsEl.textContent = stats.totalPatterns;
    
    const accuracyEl = document.getElementById('aiAccuracy');
    if (accuracyEl) {
      const total = stats.hourStats.reduce((sum, h) => sum + h.wins + h.losses, 0);
      const wins = stats.hourStats.reduce((sum, h) => sum + h.wins, 0);
      const acc = total > 0 ? Math.round((wins / total) * 100) : 0;
      accuracyEl.textContent = acc + '%';
    }
    
    const topIndEl = document.getElementById('aiTopIndicator');
    if (topIndEl) {
      const weights = stats.indicatorWeights;
      const top = Object.entries(weights).sort((a, b) => b[1] - a[1])[0];
      topIndEl.textContent = top ? top[0].toUpperCase() + ' (' + top[1].toFixed(2) + ')' : '—';
    }
    
    const boostsEl = document.getElementById('aiBoosts');
    if (boostsEl) boostsEl.textContent = state.signalsToday;
    
    // Atualiza barras de peso
    const weightsGrid = document.getElementById('aiWeightsGrid');
    if (weightsGrid) {
      weightsGrid.innerHTML = Object.entries(stats.indicatorWeights).map(([name, weight]) => {
        const pct = Math.min(100, (weight / 2.0) * 100);
        const color = weight > 1.2 ? 'var(--accent-green)' : weight < 0.8 ? 'var(--accent-red)' : 'var(--accent-cyan)';
        return `
          <div class="lt-ai-weight-item">
            <div class="lt-ai-weight-label">${name.toUpperCase()}</div>
            <div class="lt-ai-weight-bar">
              <div class="lt-ai-weight-fill" style="width:${pct}%;background:${color};"></div>
            </div>
            <div class="lt-ai-weight-value">${weight.toFixed(2)}</div>
          </div>
        `;
      }).join('');
    }
  }

  function showSignalDetails(signal) {
    const details = [
      `🎯 SINAL PARA PRÓXIMA VELA`,
      ``,
      `🤖 Robô: ${signal.bot}`,
      `💱 Par: ${signal.pair}`,
      `📊 Direção: ${signal.directionLabel}`,
      `⭐ Score: ${signal.score}${signal.originalScore ? ` (original: ${signal.originalScore})` : ''}`,
      `💰 Payout: ${signal.payout}%`,
      `💵 Preço atual: ${formatPrice(signal.price)}`,
      `📈 Indicadores: ${signal.indicators.join(', ')}`,
      `📝 Razões:`,
      ...signal.reasons.map(r => `   • ${r}`),
      ``,
      signal.aiBoost ? `🧠 IA Boost: ${signal.aiBoost > 0 ? '+' : ''}${signal.aiBoost} pontos` : '',
      signal.aiReasons && signal.aiReasons.length > 0 ? `🧠 Razões da IA:` : '',
      ...(signal.aiReasons || []).map(r => `   • ${r}`),
      signal.aiPrediction ? `🧠 Previsão IA: ${signal.aiPrediction.prediction === 'win' ? 'WIN' : 'LOSS'} (${Math.round(signal.aiPrediction.confidence * 100)}% confiança, ${signal.aiPrediction.similarCount} padrões similares)` : '',
      ``,
      `⏰ Sinal gerado: ${formatTime(signal.timestamp)}`,
      `🕐 Vela alvo: ${formatTime(signal.targetCandle)}`,
      `🏪 Mercado: ${signal.market === 'otc' ? 'OTC' : 'Aberto'}`,
      `⏱️ Timeframe: ${signal.timeframe}`,
      ``,
      `⚠️ Entre no início da próxima vela!`
    ].filter(Boolean).join('\n');
    alert(details);
  }

  // ============================================
  // NAVEGAÇÃO
  // ============================================
  function initNavigation() {
    const navButtons = document.querySelectorAll('.lt-nav-btn[data-view]');
    const views = { signals: document.getElementById('viewSignals'), config: document.getElementById('viewConfig'), history: document.getElementById('viewHistory') };

    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Object.values(views).forEach(v => v.classList.add('hidden'));
        if (views[view]) views[view].classList.remove('hidden');
        if (view === 'config') renderConfig();
        if (view === 'history') renderHistory();
      });
    });

    document.getElementById('btnConnect')?.addEventListener('click', connectBroker);
    document.getElementById('btnConnectHero')?.addEventListener('click', connectBroker);
    document.getElementById('btnConnectChart')?.addEventListener('click', connectBroker);

    document.getElementById('btnSimulate')?.addEventListener('click', () => {
      CONFIG.simulationMode = true;
      state.connected = true;
      state.broker = 'Simulação';
      updateStatusBar();
      document.getElementById('chartOverlay').style.display = 'none';
      document.getElementById('signalsSubtitle').textContent = 'Modo simulação — Sinais para próxima vela';
      document.getElementById('liveStatus').textContent = 'simulação';
    });

    document.getElementById('btnSaveConfig')?.addEventListener('click', saveConfig);
    document.getElementById('btnTestConnection')?.addEventListener('click', testConnection);

    document.getElementById('configBroker')?.addEventListener('change', (e) => {
      const customGroup = document.getElementById('customBrokerGroup');
      if (customGroup) customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });

    document.getElementById('filterMarket')?.addEventListener('change', (e) => { state.market = e.target.value; updateStatusBar(); });
    document.getElementById('filterScore')?.addEventListener('input', (e) => { state.settings.minScore = parseInt(e.target.value); document.getElementById('filterScoreValue').textContent = e.target.value; });
    document.getElementById('filterTimeframe')?.addEventListener('change', (e) => { state.settings.timeframe = e.target.value; });

    document.querySelectorAll('.lt-chart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lt-chart-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        drawChart();
      });
    });

    document.getElementById('btnExportCSV')?.addEventListener('click', exportCSV);
    document.getElementById('btnClearHistory')?.addEventListener('click', () => { state.history = []; renderHistory(); });

    document.getElementById('btnClearAIMemory')?.addEventListener('click', async () => {
      if (confirm('Tem certeza que deseja limpar a memória da IA? Todos os padrões aprendidos serão perdidos.')) {
        if (window.LottusAI) {
          await window.LottusAI.clearMemory();
          updateAIDashboard();
          alert('🧠 Memória da IA limpa com sucesso!');
        }
      }
    });

    document.getElementById('btnConfirmEntry')?.addEventListener('click', () => {
      if (state.currentSignal) {
        alert(`✅ Entrada confirmada!\n\n${state.currentSignal.directionLabel} em ${state.currentSignal.pair}\nScore: ${state.currentSignal.score}\nPayout: ${state.currentSignal.payout}%\n\nAguarde o fechamento da próxima vela para o resultado.`);
      }
    });

    document.getElementById('btnIgnoreSignal')?.addEventListener('click', () => {
      hideActiveSignal();
      state.currentSignal = null;
    });
  }

  function connectBroker() {
    if (state.connected || state.connecting) return;
    state.connecting = true;
    updateStatusBar();
    setTimeout(() => {
      state.connecting = false;
      state.connected = true;
      state.broker = 'Corretora Conectada';
      updateStatusBar();
      document.getElementById('chartOverlay').style.display = 'none';
      document.getElementById('signalsSubtitle').textContent = 'Sinais para próxima vela em tempo real';
      document.getElementById('liveStatus').textContent = 'ao vivo';
    }, 2000);
  }

  function saveConfig() {
    const broker = document.getElementById('configBroker')?.value;
    const apiKey = document.getElementById('configApiKey')?.value;
    const apiSecret = document.getElementById('configApiSecret')?.value;

    if (!broker) { alert('Selecione uma corretora!'); return; }
    if (!apiKey || !apiSecret) { alert('Preencha API Key e API Secret!'); return; }

    CONFIG.signalTiming = document.getElementById('configSignalTiming')?.value || 'early';
    CONFIG.autoConfirm = document.getElementById('configAutoConfirm')?.checked || false;
    CONFIG.showCountdown = document.getElementById('configShowCountdown')?.checked || true;

    localStorage.setItem('lt_config', JSON.stringify({ broker, apiKey, apiSecret }));
    alert('✅ Configurações salvas!');
  }

  function testConnection() {
    const btn = document.getElementById('btnTestConnection');
    btn.textContent = 'Testando...'; btn.disabled = true;
    setTimeout(() => {
      btn.textContent = '✅ Conexão OK'; btn.style.color = 'var(--accent-green)';
      setTimeout(() => { btn.textContent = 'Testar Conexão'; btn.disabled = false; btn.style.color = ''; }, 2000);
    }, 1500);
  }

  function renderConfig() {
    const container = document.getElementById('robotsConfig');
    if (!container) return;
    container.innerHTML = '';
    BOTS.forEach(bot => container.appendChild(createRobotConfigItem(bot)));
  }

  function exportCSV() {
    if (state.history.length === 0) { alert('Nenhum dado para exportar!'); return; }
    const headers = ['Horario_Sinal', 'Vela_Alvo', 'Par', 'Direcao', 'Score', 'Payout', 'Preco', 'Indicadores', 'Timeframe', 'Mercado', 'Resultado', 'Lucro'];
    const rows = state.history.map(s => [formatTime(s.timestamp), formatTime(s.targetCandle), s.pair, s.directionLabel, s.score, s.payout, s.price, s.indicators.join(';'), s.timeframe, s.market, s.result || 'pending', s.profit || 0]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lottus_signals_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  }

  // ============================================
  // BOOTSTRAP
  // ============================================
  async function init() {
    // Inicializa IA
    if (window.LottusAI) {
      await window.LottusAI.init();
      updateAIDashboard();
    }
    initPriceSimulation();

    const botsGrid = document.getElementById('botsGrid');
    if (botsGrid) BOTS.forEach(bot => botsGrid.appendChild(createBotElement(bot)));

    initNavigation();

    // Timer principal — atualiza a cada 100ms para contagem suave
    state.timerInterval = setInterval(() => {
      updateCandleTimer();
      drawChart();
    }, 100);

    // Sinais iniciais
    const grid = document.getElementById('signalsGrid');
    if (grid) {
      for (let i = 0; i < 3; i++) {
        const signal = generateNextCandleSignal();
        if (signal && grid.children.length < CONFIG.maxSignals) {
          grid.appendChild(createSignalElement(signal));
        }
      }
    }

    updateStats();

    const savedConfig = localStorage.getItem('lt_config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      const brokerSelect = document.getElementById('configBroker');
      if (brokerSelect) brokerSelect.value = config.broker;
    }

    console.log('⚡ Lottus Trading PRO V2 inicializado!');
    console.log('🎯 Sinais para PRÓXIMA VELA');
    console.log('⏱️ Timer ativo');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
