const WebSocket = require("ws");

export default async function handler(req, res){

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

console.log("DERIV DEBUG", {
    appId: appId,
    tokenLength: token ? token.length : 0
});

if(!appId || !token){

    return res.status(500).json({
        error:"Credenciais ausentes"
    });

}


try{


const ws = new WebSocket(
`wss://ws.derivws.com/websockets/v3?app_id=${appId}`
);



const contract = await new Promise((resolve,reject)=>{


let authorized=false;


const timeout=setTimeout(()=>{

reject(
new Error("Timeout Deriv")
);

},20000);



ws.on("open",()=>{


ws.send(JSON.stringify({

authorize:token

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

}



if(data.authorize){


authorized=true;



ws.send(JSON.stringify({

proposal:1,

amount:amount,

basis:"stake",

contract_type:contract_type,

currency:"USD",

duration:5,

duration_unit:"m",

symbol:symbol

}));



}



if(data.proposal){


ws.send(JSON.stringify({

buy:data.proposal.id,

price:amount

}));



}



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

status:"Contrato criado",

contract:contract

});



}catch(error){


return res.status(400).json({

status:"Erro ordem",

message:error.message

});


}


}
