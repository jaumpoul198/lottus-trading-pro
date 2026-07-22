const WebSocket = require("ws");

export default async function handler(req,res){

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


            let proposalId = null;


            const timeout=setTimeout(()=>{

                reject(
                    new Error("Timeout Deriv")
                );

            },20000);



            ws.on("open",()=>{


                console.log(
                    "WS ABERTO"
                );


                ws.send(JSON.stringify({

                    authorize:token

                }));


            });



            ws.on("message",(msg)=>{


                const data =
                    JSON.parse(msg.toString());


                console.log(
                    "DERIV RESPONSE",
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



                if(data.authorize){


                    console.log(
                        "AUTORIZADO"
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


                }



                if(data.proposal){


                    proposalId =
                        data.proposal.id;



                    console.log(
                        "PROPOSTA",
                        proposalId
                    );



                    ws.send(JSON.stringify({

                        buy:proposalId,

                        price:Number(amount)

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


        console.error(
            "ORDER ERROR",
            error
        );


        return res.status(400).json({

            status:"Erro ordem",

            message:error.message

        });


    }


}
