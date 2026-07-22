/**
 * DERIV INTEGRATION - Lottus Trading Pro V2
 * Conexão segura via Vercel API
 */

(function () {
  'use strict';

  const CONFIG = {
    SYMBOL: '1HZ100V',
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
  // CONEXÃO SEGURA VIA BACKEND
  // ============================================

  async function connect() {
    try {
      console.log('🔗 Conectando Lottus API Deriv...');


      const response = await fetch('/api/deriv');

      const api = await response.json();


      if (!response.ok) {
        console.error('❌ Erro API Deriv:', api);
        return;
      }


      if (!api.token_configured || !api.app_id_configured) {
        console.error('❌ Credenciais Deriv não configuradas na Vercel');
        return;
      }


      console.log('✅ API Deriv autorizada');

      /*
        Próxima etapa:
        O backend irá retornar
        o websocket seguro da Deriv
      */


      const statusText = document.getElementById('statusText');

      if (statusText) {
        statusText.textContent = 'API Deriv Online';
      }


      const brokerName = document.getElementById('brokerName');

      if (brokerName) {
        brokerName.textContent = 'Deriv';
      }


      if (window.__lottusState) {
        window.__lottusState.connected = true;
        window.__lottusState.broker = 'Deriv';
      }


      state.connected = true;
      state.authorized = true;


    } catch (error) {

      console.error(
        '❌ Falha conexão Deriv:',
        error
      );

    }
  }



  // ============================================
  // ENVIAR ORDEM
  // ============================================

  async function placeOrder(
    type,
    amount = CONFIG.TRADE_AMOUNT
  ) {

    try {

      const response = await fetch(
        '/api/deriv',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({

            action: 'buy',

            contract_type: type,

            symbol: CONFIG.SYMBOL,

            amount: amount,

            duration: CONFIG.DURATION_MINUTES

          })
        }
      );


      const result = await response.json();


      if (!response.ok) {

        console.error(
          '❌ Erro ordem:',
          result
        );

        return;

      }


      console.log(
        '✅ Ordem enviada:',
        result
      );


    } catch (error) {

      console.error(
        '❌ Falha enviar ordem:',
        error
      );

    }

  }



  function isAuthorized() {

    return state.authorized;

  }



  // ============================================
  // API GLOBAL
  // ============================================

  window.DerivIntegration = {

    connect,

    placeOrder,

    getPrice: () => state.lastPrice,

    isAuthorized,

    config: CONFIG

  };



  // ============================================
  // START AUTOMÁTICO
  // ============================================


  console.log(
    '🚀 Lottus Deriv Integration iniciada'
  );

  console.log(
    '🔐 Credenciais protegidas pela Vercel'
  );


  if (document.readyState === 'loading') {


    document.addEventListener(
      'DOMContentLoaded',
      () => setTimeout(connect, 1500)
    );


  } else {


    setTimeout(connect, 1500);


  }


})();