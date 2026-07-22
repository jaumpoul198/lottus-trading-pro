const WebSocket = require("ws");


export default async function handler(req,res){


if(req.method !== "POST"){

return res.status(405).json({
error:"Método não permitido"
});

}



const {
contract_type,
amount,
symbol
}=req.body;



const appId = process.env.DERIV_APP_ID;
const token = process.env.DERIV_TOKEN;



const accountId = "DOT93838295";



try{


// ===============================
// 1 - GERAR OTP
// ===============================


const otpResponse = await fetch(

`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`,

{

method:"POST",

headers:{

"Deriv-App-ID":appId,

"Authorization":`Bearer ${token}`,

"Content-Type":"application/json"

}

}

);



const otpData =
await otpResponse.json();



if(!otpData.data?.url){

throw new Error(
"Falha ao gerar OTP Deriv"
);

}



const ws = new WebSocket(
otpData.data.url
);




// ===============================
// 2 - ENVIAR PROPOSTA E COMPRA
// ===============================


const result = await new Promise((resolve,reject)=>{


const timeout=setTimeout(()=>{

reject(
new Error("Timeout Deriv")
);

},20000);



ws.on("open",()=>{


console.log(
"Trading WebSocket conectado"
);



// proposta

ws.send(JSON.stringify({

proposal:1,

amount:Number(amount),

basis:"stake",

contract_type:contract_type,

currency:"USD",

duration:5,

duration_unit:"m",

symbol:symbol

}));



});





ws.on("message",(msg)=>{


const data =
JSON.parse(msg.toString());



console.log(
"DERIV:",
data
);



if(data.error){

clearTimeout(timeout);

reject(
new Error(data.error.message)
);

ws.close();

return;

}




if(data.proposal){



console.log(
"Proposal recebida",
data.proposal.id
);



ws.send(JSON.stringify({

buy:data.proposal.id,

price:Number(amount)

}));



}





if(data.buy){


clearTimeout(timeout);


resolve(
data.buy
);


ws.close();


}



});




ws.on("error",(err)=>{


clearTimeout(timeout);


reject(err);


});



});





return res.status(200).json({

status:"Contrato criado",

contract:result

});




}catch(error){



console.log(
"ERRO ORDER:",
error.message
);



return res.status(400).json({

status:"Erro ordem",

message:error.message

});


}


}
