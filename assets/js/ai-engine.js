/**
 * LOTTUS AI ENGINE - Sistema de Aprendizado por Padrões
 * =========================================================
 * Memória mágica de padrões de velas + Machine Learning local
 * Aprende com cada resultado para ficar cada vez mais assertiva
 * 
 * Funciona como módulo plug-and-play — não modifica o app.js original
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURAÇÃO DA IA
  // ============================================
  const AI_CONFIG = {
    minPatternsForLearning: 10,      // mínimo de padrões para começar a prever
    confidenceThreshold: 0.65,       // confiança mínima para ajustar score
    memorySize: 500,                 // máximo de padrões na memória
    patternWindow: 5,              // quantas velas anteriores analisar
    learningRate: 0.1,               // quão rápido a IA aprende (0-1)
    decayRate: 0.99,                 // decaimento de padrões antigos
  };

  // ============================================
  // BANCO DE DADOS LOCAL (IndexedDB)
  // ============================================
  const DB_NAME = 'LottusAIMemory';
  const DB_VERSION = 1;
  let db = null;

  async function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { db = request.result; resolve(db); };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('patterns')) {
          const store = db.createObjectStore('patterns', { keyPath: 'id', autoIncrement: true });
          store.createIndex('asset', 'asset', { unique: false });
          store.createIndex('direction', 'direction', { unique: false });
          store.createIndex('result', 'result', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('weights')) {
          db.createObjectStore('weights', { keyPath: 'indicator' });
        }
        if (!db.objectStoreNames.contains('stats')) {
          db.createObjectStore('stats', { keyPath: 'key' });
        }
      };
    });
  }

  // ============================================
  // MEMÓRIA DE PADRÕES (Pattern Memory)
  // ============================================
  const PatternMemory = {
    // Padrões de velas reconhecidos
    patterns: [],

    // Pesos dos indicadores (ajustados pela IA)
    indicatorWeights: {
      rsi: 1.0,
      macd: 1.0,
      bb: 1.0,
      stoch: 1.0,
      ema: 1.0,
      volume: 1.0,
      atr: 1.0,
      vwap: 1.0,
      adx: 1.0,
      ichimoku: 1.0,
      fib: 1.0
    },

    // Estatísticas por ativo
    assetStats: {},

    // Estatísticas por horário
    hourStats: new Array(24).fill(null).map(() => ({ wins: 0, losses: 0 })),

    // Estatísticas por dia da semana
    dayStats: new Array(7).fill(null).map(() => ({ wins: 0, losses: 0 })),

    async load() {
      if (!db) await initDB();

      // Carrega padrões
      const patterns = await this.getAllPatterns();
      this.patterns = patterns.slice(-AI_CONFIG.memorySize);

      // Carrega pesos
      const weights = await this.getWeights();
      if (weights) this.indicatorWeights = { ...this.indicatorWeights, ...weights };

      // Carrega estatísticas
      const stats = await this.getStats();
      if (stats) {
        if (stats.assetStats) this.assetStats = stats.assetStats;
        if (stats.hourStats) this.hourStats = stats.hourStats;
        if (stats.dayStats) this.dayStats = stats.dayStats;
      }

      console.log('🧠 IA: Memória carregada —', this.patterns.length, 'padrões');
    },

    async savePattern(pattern) {
      if (!db) await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('patterns', 'readwrite');
        const store = tx.objectStore('patterns');
        const request = store.add(pattern);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async getAllPatterns() {
      if (!db) await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('patterns', 'readonly');
        const store = tx.objectStore('patterns');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    },

    async saveWeights() {
      if (!db) await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('weights', 'readwrite');
        const store = tx.objectStore('weights');
        Object.entries(this.indicatorWeights).forEach(([key, value]) => {
          store.put({ indicator: key, weight: value });
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },

    async getWeights() {
      if (!db) await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('weights', 'readonly');
        const store = tx.objectStore('weights');
        const request = store.getAll();
        request.onsuccess = () => {
          const weights = {};
          (request.result || []).forEach(w => { weights[w.indicator] = w.weight; });
          resolve(weights);
        };
        request.onerror = () => reject(request.error);
      });
    },

    async saveStats() {
      if (!db) await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('stats', 'readwrite');
        const store = tx.objectStore('stats');
        store.put({ key: 'main', assetStats: this.assetStats, hourStats: this.hourStats, dayStats: this.dayStats });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },

    async getStats() {
      if (!db) await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('stats', 'readonly');
        const store = tx.objectStore('stats');
        const request = store.get('main');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  };

  // ============================================
  // EXTRAÇÃO DE CARACTERÍSTICAS (Feature Extraction)
  // ============================================
  const FeatureExtractor = {
    // Extrai características de uma sequência de velas
    extract(candles) {
      if (candles.length < AI_CONFIG.patternWindow + 1) return null;

      const recent = candles.slice(-AI_CONFIG.patternWindow - 1, -1); // velas anteriores
      const target = candles[candles.length - 1]; // vela alvo

      return {
        // Características de preço
        priceFeatures: this.extractPriceFeatures(recent),
        // Características de volume
        volumeFeatures: this.extractVolumeFeatures(recent),
        // Características de forma
        shapeFeatures: this.extractShapeFeatures(recent),
        // Características de tendência
        trendFeatures: this.extractTrendFeatures(recent),
        // Meta-dados
        metadata: {
          hour: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
          timestamp: Date.now()
        }
      };
    },

    extractPriceFeatures(candles) {
      const closes = candles.map(c => c.close);
      const opens = candles.map(c => c.open);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);

      return {
        avgClose: closes.reduce((a, b) => a + b, 0) / closes.length,
        avgRange: candles.map(c => c.high - c.low).reduce((a, b) => a + b, 0) / candles.length,
        volatility: this.calculateVolatility(closes),
        priceChange: ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100,
        bodyRatio: candles.map(c => Math.abs(c.close - c.open) / (c.high - c.low || 1)).reduce((a, b) => a + b, 0) / candles.length,
        upperWickRatio: candles.map(c => (c.high - Math.max(c.open, c.close)) / (c.high - c.low || 1)).reduce((a, b) => a + b, 0) / candles.length,
        lowerWickRatio: candles.map(c => (Math.min(c.open, c.close) - c.low) / (c.high - c.low || 1)).reduce((a, b) => a + b, 0) / candles.length,
      };
    },

    extractVolumeFeatures(candles) {
      const volumes = candles.map(c => c.volume);
      const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
      const volumeTrend = volumes[volumes.length - 1] / (volumes[0] || 1);

      return {
        avgVolume,
        volumeTrend,
        volumeSpikes: volumes.filter(v => v > avgVolume * 2).length,
      };
    },

    extractShapeFeatures(candles) {
      const patterns = [];

      // Doji
      if (candles.length >= 1) {
        const last = candles[candles.length - 1];
        const bodySize = Math.abs(last.close - last.open);
        const totalRange = last.high - last.low;
        if (bodySize / (totalRange || 1) < 0.1) patterns.push('doji');
      }

      // Hammer / Shooting Star
      if (candles.length >= 1) {
        const last = candles[candles.length - 1];
        const body = Math.abs(last.close - last.open);
        const upperWick = last.high - Math.max(last.open, last.close);
        const lowerWick = Math.min(last.open, last.close) - last.low;
        if (lowerWick > body * 2 && upperWick < body) patterns.push('hammer');
        if (upperWick > body * 2 && lowerWick < body) patterns.push('shooting_star');
      }

      // Engulfing
      if (candles.length >= 2) {
        const prev = candles[candles.length - 2];
        const curr = candles[candles.length - 1];
        const prevBody = Math.abs(prev.close - prev.open);
        const currBody = Math.abs(curr.close - curr.open);
        if (currBody > prevBody * 1.5) {
          if (prev.close < prev.open && curr.close > curr.open && curr.open < prev.close) patterns.push('bullish_engulfing');
          if (prev.close > prev.open && curr.close < curr.open && curr.open > prev.close) patterns.push('bearish_engulfing');
        }
      }

      // Three White Soldiers / Black Crows
      if (candles.length >= 3) {
        const last3 = candles.slice(-3);
        const allGreen = last3.every(c => c.close > c.open);
        const allRed = last3.every(c => c.close < c.open);
        if (allGreen) patterns.push('three_white_soldiers');
        if (allRed) patterns.push('three_black_crows');
      }

      return { patterns, patternCount: patterns.length };
    },

    extractTrendFeatures(candles) {
      const closes = candles.map(c => c.close);
      const sma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, closes.length);
      const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, closes.length);

      return {
        trendDirection: closes[closes.length - 1] > closes[0] ? 'up' : 'down',
        trendStrength: Math.abs(((closes[closes.length - 1] - closes[0]) / closes[0]) * 100),
        sma5AboveSma10: sma5 > sma10,
        consecutiveUp: this.countConsecutive(candles, 'up'),
        consecutiveDown: this.countConsecutive(candles, 'down'),
      };
    },

    calculateVolatility(prices) {
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      return Math.sqrt(variance) * 100; // em porcentagem
    },

    countConsecutive(candles, direction) {
      let count = 0;
      for (let i = candles.length - 1; i >= 0; i--) {
        const isUp = candles[i].close > candles[i].open;
        if ((direction === 'up' && isUp) || (direction === 'down' && !isUp)) count++;
        else break;
      }
      return count;
    }
  };

  // ============================================
  // MOTOR DE APRENDIZADO (Learning Engine)
  // ============================================
  const LearningEngine = {
    // Similaridade entre dois padrões (0-1)
    calculateSimilarity(pattern1, pattern2) {
      let similarity = 0;
      let features = 0;

      // Compara preços
      if (pattern1.priceFeatures && pattern2.priceFeatures) {
        const pf1 = pattern1.priceFeatures;
        const pf2 = pattern2.priceFeatures;
        similarity += this.similarityScore(pf1.volatility, pf2.volatility, 5);
        similarity += this.similarityScore(pf1.priceChange, pf2.priceChange, 10);
        similarity += this.similarityScore(pf1.bodyRatio, pf2.bodyRatio, 0.5);
        features += 3;
      }

      // Compara volumes
      if (pattern1.volumeFeatures && pattern2.volumeFeatures) {
        const vf1 = pattern1.volumeFeatures;
        const vf2 = pattern2.volumeFeatures;
        similarity += this.similarityScore(vf1.volumeTrend, vf2.volumeTrend, 3);
        features += 1;
      }

      // Compara formas
      if (pattern1.shapeFeatures && pattern2.shapeFeatures) {
        const commonPatterns = pattern1.shapeFeatures.patterns.filter(p => 
          pattern2.shapeFeatures.patterns.includes(p)
        ).length;
        similarity += commonPatterns / Math.max(pattern1.shapeFeatures.patterns.length, 1);
        features += 1;
      }

      // Compara tendência
      if (pattern1.trendFeatures && pattern2.trendFeatures) {
        if (pattern1.trendFeatures.trendDirection === pattern2.trendFeatures.trendDirection) similarity += 1;
        if (pattern1.trendFeatures.sma5AboveSma10 === pattern2.trendFeatures.sma5AboveSma10) similarity += 1;
        features += 2;
      }

      return features > 0 ? similarity / features : 0;
    },

    similarityScore(val1, val2, tolerance) {
      const diff = Math.abs(val1 - val2);
      return Math.max(0, 1 - (diff / tolerance));
    },

    // Encontra padrões similares na memória
    findSimilarPatterns(currentFeatures, asset, direction, limit = 20) {
      return PatternMemory.patterns
        .filter(p => p.asset === asset && p.direction === direction)
        .map(p => ({
          pattern: p,
          similarity: this.calculateSimilarity(currentFeatures, p.features)
        }))
        .filter(p => p.similarity > 0.5)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    },

    // Prediz resultado baseado em padrões similares
    predict(features, asset, direction) {
      const similar = this.findSimilarPatterns(features, asset, direction);

      if (similar.length < AI_CONFIG.minPatternsForLearning) {
        return { confidence: 0, prediction: 'unknown', similarCount: 0 };
      }

      const wins = similar.filter(s => s.pattern.result === 'win').length;
      const total = similar.length;
      const winRate = wins / total;

      // Pondera pela similaridade
      const weightedWins = similar.reduce((sum, s) => {
        return sum + (s.pattern.result === 'win' ? s.similarity : 0);
      }, 0);
      const weightedTotal = similar.reduce((sum, s) => sum + s.similarity, 0);
      const weightedWinRate = weightedTotal > 0 ? weightedWins / weightedTotal : 0;

      return {
        confidence: weightedWinRate,
        prediction: weightedWinRate > 0.5 ? 'win' : 'loss',
        similarCount: total,
        winRate: Math.round(weightedWinRate * 100)
      };
    },

    // Ajusta pesos dos indicadores baseado no resultado
    async learn(signal, result) {
      const features = signal.features;
      if (!features) return;

      // Salva padrão na memória
      const pattern = {
        asset: signal.code,
        direction: signal.direction,
        features: features,
        result: result,
        score: signal.score,
        timestamp: Date.now()
      };

      await PatternMemory.savePattern(pattern);
      PatternMemory.patterns.push(pattern);

      // Mantém tamanho da memória
      if (PatternMemory.patterns.length > AI_CONFIG.memorySize) {
        PatternMemory.patterns.shift();
      }

      // Atualiza estatísticas por ativo
      if (!PatternMemory.assetStats[signal.code]) {
        PatternMemory.assetStats[signal.code] = { wins: 0, losses: 0, patterns: 0 };
      }
      PatternMemory.assetStats[signal.code][result === 'win' ? 'wins' : 'losses']++;
      PatternMemory.assetStats[signal.code].patterns++;

      // Atualiza estatísticas por horário
      const hour = new Date().getHours();
      PatternMemory.hourStats[hour][result === 'win' ? 'wins' : 'losses']++;

      // Atualiza estatísticas por dia
      const day = new Date().getDay();
      PatternMemory.dayStats[day][result === 'win' ? 'wins' : 'losses']++;

      // Ajusta pesos dos indicadores
      if (result === 'win') {
        signal.indicators.forEach(ind => {
          const key = ind.toLowerCase();
          if (PatternMemory.indicatorWeights[key] !== undefined) {
            PatternMemory.indicatorWeights[key] = Math.min(2.0, 
              PatternMemory.indicatorWeights[key] * (1 + AI_CONFIG.learningRate)
            );
          }
        });
      } else {
        signal.indicators.forEach(ind => {
          const key = ind.toLowerCase();
          if (PatternMemory.indicatorWeights[key] !== undefined) {
            PatternMemory.indicatorWeights[key] = Math.max(0.3,
              PatternMemory.indicatorWeights[key] * (1 - AI_CONFIG.learningRate * 0.5)
            );
          }
        });
      }

      // Decaimento de pesos antigos
      Object.keys(PatternMemory.indicatorWeights).forEach(key => {
        PatternMemory.indicatorWeights[key] *= AI_CONFIG.decayRate;
      });

      await PatternMemory.saveWeights();
      await PatternMemory.saveStats();

      console.log('🧠 IA aprendeu:', result.toUpperCase(), '| Padrões na memória:', PatternMemory.patterns.length);
    },

    // Calcula score boost baseado no aprendizado
    calculateBoost(signal, features) {
      const prediction = this.predict(features, signal.code, signal.direction);

      if (prediction.confidence < AI_CONFIG.confidenceThreshold) {
        return { boost: 0, reason: 'Poucos padrões similares', prediction };
      }

      let boost = 0;
      let reasons = [];

      // Boost baseado na predição
      if (prediction.prediction === 'win') {
        boost += Math.round((prediction.confidence - 0.5) * 20);
        reasons.push(`IA prevê ${prediction.winRate}% win rate (${prediction.similarCount} padrões similares)`);
      } else {
        boost -= Math.round((0.5 - prediction.confidence) * 15);
        reasons.push(`IA prevê ${100 - prediction.winRate}% loss rate (${prediction.similarCount} padrões similares)`);
      }

      // Boost por horário favorável
      const hour = new Date().getHours();
      const hourStat = PatternMemory.hourStats[hour];
      const hourTotal = hourStat.wins + hourStat.losses;
      if (hourTotal > 5) {
        const hourWinRate = hourStat.wins / hourTotal;
        if (hourWinRate > 0.6) {
          boost += 3;
          reasons.push(`Horário favorável (${Math.round(hourWinRate * 100)}% acerto)`);
        }
      }

      // Boost por dia favorável
      const day = new Date().getDay();
      const dayStat = PatternMemory.dayStats[day];
      const dayTotal = dayStat.wins + dayStat.losses;
      if (dayTotal > 10) {
        const dayWinRate = dayStat.wins / dayTotal;
        if (dayWinRate > 0.6) {
          boost += 2;
          reasons.push(`Dia favorável (${Math.round(dayWinRate * 100)}% acerto)`);
        }
      }

      // Boost por ativo com histórico positivo
      const assetStat = PatternMemory.assetStats[signal.code];
      if (assetStat && assetStat.patterns > 10) {
        const assetWinRate = assetStat.wins / assetStat.patterns;
        if (assetWinRate > 0.6) {
          boost += 3;
          reasons.push(`Ativo com ${Math.round(assetWinRate * 100)}% acerto`);
        }
      }

      return { boost, reasons, prediction };
    }
  };

  // ============================================
  // API PÚBLICA (expõe para o app.js)
  // ============================================
  window.LottusAI = {
    // Inicializa a IA
    async init() {
      await PatternMemory.load();
      console.log('🧠 Lottus AI Engine inicializada!');
      console.log('   Padrões na memória:', PatternMemory.patterns.length);
      console.log('   Pesos dos indicadores:', PatternMemory.indicatorWeights);
    },

    // Extrai features de um sinal antes de gerar
    extractFeatures(candles) {
      return FeatureExtractor.extract(candles);
    },

    // Aplica boost de IA no score do sinal
    async enhanceSignal(signal, candles) {
      const features = this.extractFeatures(candles);
      if (!features) return { ...signal, aiBoost: 0, aiReasons: [], aiPrediction: null };

      signal.features = features;
      const { boost, reasons, prediction } = LearningEngine.calculateBoost(signal, features);

      const newScore = Math.min(95, Math.max(50, signal.score + boost));

      return {
        ...signal,
        score: newScore,
        originalScore: signal.score,
        aiBoost: boost,
        aiReasons: reasons,
        aiPrediction: prediction,
        aiConfidence: prediction ? prediction.confidence : 0
      };
    },

    // Registra resultado para aprendizado
    async learn(signal, result) {
      await LearningEngine.learn(signal, result);
    },

    // Obtém estatísticas da IA
    getStats() {
      return {
        totalPatterns: PatternMemory.patterns.length,
        indicatorWeights: PatternMemory.indicatorWeights,
        assetStats: PatternMemory.assetStats,
        hourStats: PatternMemory.hourStats,
        dayStats: PatternMemory.dayStats
      };
    },

    // Limpa memória
    async clearMemory() {
      PatternMemory.patterns = [];
      PatternMemory.indicatorWeights = {
        rsi: 1.0, macd: 1.0, bb: 1.0, stoch: 1.0, ema: 1.0,
        volume: 1.0, atr: 1.0, vwap: 1.0, adx: 1.0, ichimoku: 1.0, fib: 1.0
      };
      PatternMemory.assetStats = {};
      PatternMemory.hourStats = new Array(24).fill(null).map(() => ({ wins: 0, losses: 0 }));
      PatternMemory.dayStats = new Array(7).fill(null).map(() => ({ wins: 0, losses: 0 }));
      await PatternMemory.saveWeights();
      await PatternMemory.saveStats();
      console.log('🧠 Memória da IA limpa!');
    }
  };

})();
