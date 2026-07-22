const WebSocket = require('ws');

export default async function handler(req, res) {
  // 1. Validação básica de método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const {
    account_id,
    symbol,
    contract_type, // 'CALL' ou 'PUT'
    amount,
    duration,
    duration_unit = 't' // default ticks
  } = req.body;

  const token = process.env.DERIV_TOKEN;
  const appId = process.env.DERIV_APP_ID;

  if (!account_id || !symbol || !contract_type || !amount || !duration) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes.' });
  }

  try {
    // 2. Obter OTP da nova API REST e URL autenticada
    const otpResponse = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${account_id}/otp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Deriv-App-ID': appId,
        'Content-Type': 'application/json'
      }
    });

    const otpData = await otpResponse.json();

    if (!otpResponse.ok) {
      throw new Error(otpData.error?.message || 'Falha ao obter OTP da Deriv');
    }

    const wsUrl = otpData.data.url;

    // 3. Conectar ao WebSocket e executar o fluxo completo (Proposal -> Buy -> Monitorar)
    const tradeResult = await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      // Timeout de segurança (55s) para não travar a Vercel
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timeout: A ordem demorou mais que o limite do servidor.'));
      }, 55000);

      ws.on('open', () => {
        // PASSO A: Pedir a cotação (Proposal). O 'symbol' entra AQUI.
        ws.send(JSON.stringify({
          proposal: 1,
          amount: Number(amount),
          basis: "stake",
          contract_type: contract_type.toUpperCase(),
          currency: "USD",
          duration: Number(duration),
          duration_unit: duration_unit,
          symbol: symbol.toUpperCase(),
          req_id: 1
        }));
      });

      ws.on('message', (data) => {
        const response = JSON.parse(data);

        // Se a Deriv retornar qualquer erro no WS, aborta e avisa o front
        if (response.error) {
          clearTimeout(timeout);
          ws.close();
          return reject(new Error(response.error.message));
        }

        // PASSO B: Recebeu a cotação -> Executa a compra usando apenas o ID
        if (response.msg_type === 'proposal') {
          ws.send(JSON.stringify({
            buy: response.proposal.id,       // Usa o ID da cotação. ZERO symbol aqui!
            price: response.proposal.ask_price, 
            req_id: 2
          }));
        }

        // PASSO C: Compra confirmada -> Assinar monitoramento
        if (response.msg_type === 'buy') {
          ws.send(JSON.stringify({
            proposal_open_contract: 1,
            contract_id: response.buy.contract_id,
            subscribe: 1,
            req_id: 3
          }));
        }

        // PASSO D: Monitorar a vela (WIN/LOSS)
        if (response.msg_type === 'proposal_open_contract') {
          const contract = response.proposal_open_contract;
          
          if (contract.is_sold === 1) { // Contrato encerrou
            clearTimeout(timeout);
            ws.close();
            
            const profit = parseFloat(contract.profit);
            
            resolve({
              contract_id: contract.contract_id,
              buy_price: contract.buy_price,
              sell_price: contract.sell_price,
              profit: profit,
              status: profit > 0 ? 'WIN' : 'LOSS',
              is_sold: true
            });
          }
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Envia o WIN/LOSS para o seu app.js / frontend
    return res.status(200).json({ success: true, data: tradeResult });

  } catch (error) {
    // Mantém o mesmo formato de erro que o seu frontend já espera
    return res.status(400).json({ status: 'Erro ordem', message: error.message });
  }
}