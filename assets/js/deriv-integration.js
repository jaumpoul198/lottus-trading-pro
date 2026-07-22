/**
 * DERIV INTEGRATION - Lottus Trading Pro V2
 * Conexão direta via WebSocket (Sem problemas de CORS)
 */

(function() {
  'use strict';

  // ============================================
  // SUAS CREDENCIAIS OFICIAIS
  // ============================================
  const CONFIG = {
    SYMBOL: '1HZ100V',
    APP_ID: '1089',
    TOKEN: 'pat_c4f8a2926756be7b30b0dd6e7a58b92047ce0afb8686efef299d30d4e7b49c16',
    TRADE_AMOUNT: 1,
    DURATION_MINUTES: 5,
  };

  const state = {
    ws: null,
    connected: false,
    lastPrice: null,
    authorized: false,
  };

  // ============================================
  // CONECTAR DIRETO NO WEBSOCKET V3
  // ============================================
  function connect() {
    console.log('🔗 Conectando ao WebSocket raiz da Deriv...');
    
    // Conecta usando o App ID
    state.ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${CONFIG.APP_ID}`);

    state.ws.onopen = () => {
      console.log('✅ WebSocket conectado. Solicitando autorização...');
      state.connected = true;
      
      // Envia a chave PAT para autorizar
      state.ws.send(JSON.stringify({ authorize: CONFIG.TOKEN }));
    };

    state.ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.error) {
        console.error('❌ Erro da Deriv:', data.error.message);
        return;
      }

      // 1. Autorização Aceita
      if (data.msg_type === 'authorize') {
        console.log(`✅ Autorizado com sucesso! Logado na conta: ${data.authorize.loginid}`);
        state.authorized = true;
        
        // Começa a escutar os preços do ativo
        state.ws.send(JSON.stringify({ subscribe: 1, ticks: CONFIG.SYMBOL }));
        
        // Atualiza os textos do painel
        const statusText = document.getElementById('statusText');
        if (statusText) statusText.textContent = 'Deriv Conectado';
        const brokerName = document.getElementById('brokerName');
        if (brokerName) brokerName.textContent = 'Deriv';
      }

      // 2. Atualização de Preço
      if (data.msg_type === 'tick') {
        state.lastPrice = data.tick.quote;
        if (window.__lottusState) {
          window.__lottusState.currentPrices[CONFIG.SYMBOL] = data.tick.quote;
        }
      }

      // 3. Recebeu a Cotação -> Envia a Ordem de Compra
      if (data.msg_type === 'proposal') {
        console.log(`🛒 Cotação recebida (ID: ${data.proposal.id}). Executando compra...`);
        state.ws.send(JSON.stringify({
          buy: data.proposal.id,
          price: data.proposal.ask_price
        }));
      }

      // 4. Confirmação de Compra!
      if (data.msg_type === 'buy') {
        console.log('💰 ✅ ORDEM EXECUTADA COM SUCESSO:', data.buy);
      }
    };

    state.ws.onclose = () => {
      console.warn('⚠️ Desconectado. Tentando reconectar em 5s...');
      state.connected = false;
      state.authorized = false;
      setTimeout(connect, 5000);
    };

    state.ws.onerror = (err) => {
      console.error('❌ Erro no WebSocket:', err);
    };
  }

  // ============================================
  // ENVIAR ORDEM (Pede a cotação primeiro)
  // ============================================
  function placeOrder(type, amount = CONFIG.TRADE_AMOUNT) {
    if (!state.authorized || !state.ws || state.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Não autorizado ou WebSocket fechado.');
      return;
    }
    
    const contractType = type === 'BUY' || type === 'CALL' ? 'CALL' : 'PUT';

    console.log(`📈 Solicitando cotação para ordem: ${contractType} $${amount}`);
    state.ws.send(JSON.stringify({
      proposal: 1,
      amount: amount,
      basis: "stake",
      contract_type: contractType,
      currency: "USD",
      duration: CONFIG.DURATION_MINUTES,
      duration_unit: 'm', 
      symbol: CONFIG.SYMBOL
    }));
  }

  function isAuthorized() {
    return state.authorized && state.ws && state.ws.readyState === WebSocket.OPEN;
  }

  // ============================================
  // EXPOR API E INICIAR
  // ============================================
  window.DerivIntegration = {
    connect,
    placeOrder,
    getPrice: () => state.lastPrice,
    isAuthorized,
    config: CONFIG,
  };

  console.log('🚀 Lottus Deriv Integration – iniciando motor WebSocket...');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(connect, 1500));
  } else {
    setTimeout(connect, 1500);
  }

})();