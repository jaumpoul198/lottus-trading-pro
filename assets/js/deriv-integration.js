/**
 * DERIV INTEGRATION - Lottus Trading Pro V2
 * Credenciais configuradas - Fluxo corrigido (Proposal -> Buy)
 */

(function() {
  'use strict';

  // ============================================
  // SUAS CREDENCIAIS
  // ============================================
  const CONFIG = {
    SYMBOL: '1HZ100V',
    APP_ID: '33TYri7t7tw6jbtNtRAlmd', 
    TOKEN: 'pat_762d84c009339e859f6a345fc7932a945804292c2154f997cdcc68e2065eedce',
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
  // CONECTAR (REST + OTP)
  // ============================================
  async function connect() {
    if (!CONFIG.APP_ID || !CONFIG.TOKEN) {
      console.error('❌ Credenciais não configuradas.');
      return;
    }

    try {
      console.log('🔗 Obtendo OTP via REST...');
      const accRes = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
        headers: {
          'Deriv-App-ID': CONFIG.APP_ID,
          'Authorization': `Bearer ${CONFIG.TOKEN}`
        }
      });
      
      if (!accRes.ok) {
        const text = await accRes.text();
        console.error(`❌ Erro HTTP ${accRes.status}:`, text);
        return;
      }
      
      const accData = await accRes.json();
      if (accData.error) {
        console.error('❌ Erro na API:', accData.error);
        return;
      }

      const accounts = accData.data || accData.accounts || [];
      if (accounts.length === 0) {
        console.error('❌ Nenhuma conta encontrada.');
        return;
      }
      console.log(`📋 Contas encontradas:`, accounts.map(a => ({ id: a.account_id, is_demo: a.is_demo })));

      const demo = accounts.find(a => a.is_demo === true) || accounts[0];
      console.log(`✅ Usando conta: ${demo.account_id}`);

      const otpRes = await fetch(
        `https://api.derivws.com/trading/v1/options/accounts/${demo.account_id}/otp`,
        {
          headers: {
            'Deriv-App-ID': CONFIG.APP_ID,
            'Authorization': `Bearer ${CONFIG.TOKEN}`
          }
        }
      );
      if (!otpRes.ok) {
        const text = await otpRes.text();
        console.error(`❌ Erro ao obter OTP: ${otpRes.status}`, text);
        return;
      }
      const otpData = await otpRes.json();
      if (otpData.error) {
        console.error('❌ Erro no OTP:', otpData.error);
        return;
      }
      const wsUrl = otpData.websocket_url || otpData.data?.url;
      if (!wsUrl) {
        console.error('❌ OTP não gerado.');
        return;
      }

      console.log('🔗 Conectando WebSocket...');
      state.ws = new WebSocket(wsUrl);

      state.ws.onopen = () => {
        console.log('✅ WebSocket conectado.');
        state.connected = true;
        state.authorized = true;
        state.ws.send(JSON.stringify({ subscribe: 1, ticks: CONFIG.SYMBOL }));
        console.log(`📡 Assinando ticks para ${CONFIG.SYMBOL}`);
        
        // Atualiza interface
        const statusText = document.getElementById('statusText');
        if (statusText) statusText.textContent = 'Deriv Conectado';
        const brokerName = document.getElementById('brokerName');
        if (brokerName) brokerName.textContent = 'Deriv';
        if (window.__lottusState) {
          window.__lottusState.connected = true;
          window.__lottusState.broker = 'Deriv';
        }
      };

      state.ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        
        // 1. Recebe Ticks
        if (data.tick) {
          state.lastPrice = data.tick.quote;
          if (window.__lottusState) {
            window.__lottusState.currentPrices[CONFIG.SYMBOL] = data.tick.quote;
          }
        }

        // 2. Recebe a Cotação (Proposal) e dispara a Compra (Buy)
        if (data.msg_type === 'proposal') {
          if (data.error) {
            console.error('❌ Erro na cotação:', data.error.message);
            return;
          }
          console.log(`🛒 Cotação recebida! ID: ${data.proposal.id}. Executando compra...`);
          
          state.ws.send(JSON.stringify({
            buy: data.proposal.id,
            price: data.proposal.ask_price
          }));
        }

        // 3. Confirma a Compra
        if (data.msg_type === 'buy') {
          console.log('✅ Ordem executada com sucesso:', data.buy);
        }
        
        // 4. Captura Erros Gerais
        if (data.error && data.msg_type !== 'proposal') {
          console.error('❌ Erro da Deriv:', data.error.message || data.error);
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

    } catch (err) {
      console.error('❌ Falha na conexão:', err);
    }
  }

  // ============================================
  // ENVIAR ORDEM (Agora pedindo cotação primeiro)
  // ============================================
  function placeOrder(type, amount = CONFIG.TRADE_AMOUNT) {
    if (!state.authorized || !state.ws || state.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Não autorizado ou WebSocket fechado.');
      return;
    }
    
    const contractType = type === 'BUY' || type === 'CALL' ? 'CALL' : 'PUT';

    const proposal = {
      proposal: 1,
      amount: amount,
      basis: "stake",
      contract_type: contractType,
      currency: "USD",
      duration: CONFIG.DURATION_MINUTES,
      duration_unit: 'm', // 'm' = minutos, 't' = ticks
      symbol: CONFIG.SYMBOL
    };
    
    state.ws.send(JSON.stringify(proposal));
    console.log(`📈 Solicitando cotação para ordem: ${contractType} $${amount}`);
  }

  function isAuthorized() {
    return state.authorized && state.ws && state.ws.readyState === WebSocket.OPEN;
  }

  // ============================================
  // EXPOR API
  // ============================================
  window.DerivIntegration = {
    connect,
    placeOrder,
    getPrice: () => state.lastPrice,
    isAuthorized,
    config: CONFIG,
  };

  // ============================================
  // INICIAR AUTOMATICAMENTE
  // ============================================
  console.log('🚀 Lottus Deriv Integration – credenciais carregadas.');
  console.log('⏳ Tentando conectar automaticamente...');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(connect, 1500));
  } else {
    setTimeout(connect, 1500);
  }

})();