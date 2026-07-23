// api/deriv-ws.js
const WebSocket = require('ws');

const APP_ID = '1089';
const TOKEN = process.env.DERIV_TOKEN;

function derivRequest(request) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://ws.deriv.com/websockets/v3?app_id=${APP_ID}`);
    ws.onopen = () => ws.send(JSON.stringify(request));
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) reject(data.error);
      else resolve(data);
      ws.close();
    };
    ws.onerror = reject;
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, ...params } = req.body || {};
  try {
    let result;
    switch (action) {
      case 'authorize':
        result = await derivRequest({ authorize: TOKEN });
        break;
      case 'proposal':
        result = await derivRequest({ proposal: 1, ...params });
        break;
      case 'buy':
        result = await derivRequest({ buy: params.proposal_id, price: params.price });
        break;
      case 'ticks_history':
        result = await derivRequest({ ticks_history: params.symbol, count: 1, end: 'latest' });
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
};
