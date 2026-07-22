const WebSocket = require("ws");


export default async function handler(req, res) {


if(req.method !== "POST"){

    return res.status(405).json({
        error:"Método não permitido"
    });

}



const {
    contract_type,
    amount
} = req.body;



const appId = process.env.DERIV_APP_ID;
const token = process.env.DERIV_TOKEN;



console.log("ORDER DEBUG",{
    appId,
    tokenLength: token ? token.length : 0,
    contract_type,
    amount
});



if(!appId || !token){

    return res.status(500).json({

        error:"Credenciais Deriv ausentes"

    });

}



try{


// ===============================
// 1 - GERAR OTP
// ===============================


const otpResponse = await fetch(

"https://api.derivws.com/trading/v1/options/accounts/DOT93838295/otp",

{

method:"POST",

headers:{

"Deriv-App-ID":appId,

"Authorization":`Bearer ${token}`,

"Content-Type":"application/json"

}

}

);



const otpData = await otpResponse.json();



console.log("OTP RESPONSE",otpData);



if(!otpData.data || !otpData.data.url){

    throw new Error(
        "Falha ao gerar OTP Deriv"
    );

}



const wsUrl = otpData.data.url;



// ===============================
// 2 - CONECTAR WEBSOCKET OTP
// ===============================


const ws = new WebSocket(wsUrl);



const result = await new Promise((resolve,reject)=>{



const timeout=setTimeout(()=>{


reject(
new Error("Timeout WebSocket compra")
);


},20000);



ws.on("open",()=>{


console.log(
"WebSocket OTP conectado"
);



ws.send(JSON.stringify({

proposal:1,

amount:Number(amount),

basis:"stake",

contract_type:contract_type,

currency:"USD",

duration:5,

duration_unit:"m",

symbol:"1HZ100V"

}));


});

ws.on("message",(msg)=>{


const data =
JSON.parse(msg.toString());



console.log(
"DERIV ORDER RESPONSE",
data
);



if(data.error){


clearTimeout(timeout);


reject(
new Error(
data.error.message
)
);


return;

}




// recebeu proposta

if(data.proposal){


console.log(
"PROPOSAL RECEBIDA",
data.proposal.id
);



ws.send(JSON.stringify({


buy:data.proposal.id,


price:Number(amount)


}));


}




// compra executada

if(data.buy){



clearTimeout(timeout);



resolve(data.buy);



ws.close();



}



});




ws.on("error",(err)=>{


clearTimeout(timeout);


reject(err);


});



});




return res.status(200).json({


status:"Contrato comprado",


contract:result



});




}catch(error){


console.log(
"ORDER ERROR",
error
);



return res.status(400).json({

status:"Erro ordem",

message:error.message

});


}


}
