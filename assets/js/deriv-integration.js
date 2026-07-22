/**
 * DERIV INTEGRATION - Lottus Trading Pro V2
 * Conexão segura via Vercel API
 */

(function () {

'use strict';


const CONFIG = {

    SYMBOL: '1HZ100V',

    TRADE_AMOUNT: 1,

    DURATION_MINUTES: 5

};



const state = {

    connected:false,

    authorized:false,

    lastPrice:null

};



// ============================================
// CONECTAR DERIV VIA BACKEND
// ============================================

async function connect(){

    try{


        console.log(
            '🔗 Conectando Lottus API Deriv...'
        );



        const response =
            await fetch('/api/deriv');



        const data =
            await response.json();



        if(!response.ok){

            console.error(
                '❌ Erro Deriv:',
                data
            );

            return;

        }



        if(data.status !== "Conectado"){

            console.error(
                '❌ Deriv não conectado:',
                data
            );

            return;

        }



        console.log(
            '✅ Deriv WebSocket conectado'
        );



        state.connected = true;

        state.authorized = true;

        state.lastPrice = data.price;



        atualizarInterface();



        if(window.__lottusState){

            window.__lottusState.connected = true;

            window.__lottusState.broker = "Deriv";

            window.__lottusState.currentPrices[
                CONFIG.SYMBOL
            ] = data.price;

        }



        console.log(
            '📡',
            CONFIG.SYMBOL,
            data.price
        );



    }catch(error){


        console.error(
            '❌ Falha conexão Deriv:',
            error
        );


    }


}



// ============================================
// INTERFACE
// ============================================

function atualizarInterface(){


    const status =
        document.getElementById(
            'statusText'
        );


    if(status){

        status.textContent =
            'Deriv Conectado';

    }



    const broker =
        document.getElementById(
            'brokerName'
        );


    if(broker){

        broker.textContent =
            'Deriv';

    }


}



// ============================================
// PREÇO ATUAL
// ============================================

function getPrice(){

    return state.lastPrice;

}



// ============================================
// ORDENS (PREPARADO PARA PRÓXIMA ETAPA)
// ============================================

async function placeOrder(type, amount = CONFIG.TRADE_AMOUNT){

    try {

        console.log(
            '📈 Enviando ordem Deriv:',
            type,
            CONFIG.SYMBOL,
            amount
        );


        const contractType =
            type === 'BUY' || type === 'CALL'
            ? 'CALL'
            : 'PUT';



        const response = await fetch('/api/order', {

            method:'POST',

            headers:{
                'Content-Type':'application/json'
            },

            body:JSON.stringify({

                contract_type: contractType,

                amount: amount,

                symbol: CONFIG.SYMBOL

            })

        });



        const data = await response.json();



        if(!response.ok){

            console.error(
                '❌ Erro ordem Deriv:',
                data
            );

            return null;

        }



        console.log(
            '✅ Ordem Deriv executada:',
            data
        );


        return data;



    }catch(error){


        console.error(
            '❌ Falha envio ordem:',
            error
        );


        return null;


    }

}

// ============================================
// STATUS
// ============================================

function isAuthorized(){

    return state.connected;

}



// ============================================
// API GLOBAL
// ============================================

window.DerivIntegration = {


    connect,

    placeOrder,

    getPrice,

    isAuthorized,

    config:CONFIG


};



// ============================================
// START AUTOMÁTICO
// ============================================

console.log(
    '🚀 Lottus Deriv Integration iniciada'
);



if(document.readyState === 'loading'){


    document.addEventListener(
        'DOMContentLoaded',
        ()=>setTimeout(connect,1500)
    );


}else{


    setTimeout(connect,1500);


}



})();