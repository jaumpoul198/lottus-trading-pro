# Lottus Trading PRO V2 - Contexto para análise

Projeto:
Lottus Trading PRO V2 AI

Objetivo:
Sistema de sinais e execução automática usando Deriv.

Stack:
- Frontend JavaScript
- Backend Vercel Functions
- WebSocket Deriv API

Problema atual:

A conexão de preço funciona:

/api/deriv.js

Retorno:
✅ Deriv WebSocket conectado
📡 1HZ100V preço


Porém a execução de ordem falha:

Frontend:
window.DerivIntegration.placeOrder("CALL",1)

Erro:

POST /api/order 400

Mensagem:

Unexpected server response: 401


Arquivos principais:

assets/js/deriv-integration.js

api/deriv.js

api/order.js


Tentativas realizadas:

1. WebSocket direto:
wss://ws.derivws.com/websockets/v3?app_id=

Resultado:
401 Unauthorized


2. Fluxo authorize:
{
 authorize: token
}

Resultado:
401


3. Proposal/buy:
Também testado.


Variáveis Vercel:

DERIV_APP_ID
DERIV_TOKEN

Existem e estão configuradas.


Suspeita:
api/deriv.js usa autenticação OTP:

https://api.derivws.com/trading/v1/options/accounts/{account}/otp

Mas api/order.js usa WebSocket tradicional.

Precisa analisar e corrigir o fluxo correto de compra Deriv.
