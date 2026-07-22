const WebSocket = require("ws");

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }


  const {
    contract_type,
    amount,
    symbol
  } = req.body;


  const appId = process.env.DERIV_APP_ID;
  const token = process.env.DERIV_TOKEN;


  if (!appId || !token) {

    return res.status(500).json({
      error:"Credenciais ausentes"
    });

  }


  try {


    const ws = new WebSocket(
      `wss://ws.derivws.com/websockets/v3?app_id=${appId}`
    );


    const result = await new Promise((resolve,reject)=>{


      const timeout=setTimeout(()=>{

        reject(
          new Error("Timeout Deriv")
        );

      },15000);



      ws.on("open",()=>{


        ws.send(JSON.stringify({

          authorize:token

        }));


      });



      ws.on("message",(msg)=>{


        const data =
          JSON.parse(msg.toString());



        if(data.error){

          clearTimeout(timeout);

          reject(
            new Error(data.error.message)
          );

        }



        if(data.authorize){


          ws.send(JSON.stringify({

            buy:1,

            price:amount,

            parameters:{

              amount:amount,

              basis:"stake",

              contract_type:contract_type,

              currency:"USD",

              duration:5,

              duration_unit:"m",

              symbol:symbol

            }


          }));


        }



        if(data.buy){


          clearTimeout(timeout);


          resolve(data.buy);


          ws.close();


        }



      });


    });



    return res.status(200).json({

      status:"Ordem executada",

      contract:result

    });



  }catch(error){


    return res.status(400).json({

      status:"Erro ordem",

      message:error.message

    });


  }


}
