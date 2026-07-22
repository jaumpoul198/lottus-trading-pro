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
      error:"Credenciais Deriv ausentes"
    });

  }



  try {


    const ws = new WebSocket(
      `wss://ws.derivws.com/websockets/v3?app_id=${appId}`
    );



    const contract = await new Promise((resolve,reject)=>{


      const timeout=setTimeout(()=>{

        reject(
          new Error("Timeout aguardando Deriv")
        );

      },20000);



      ws.on("open",()=>{


        console.log("WebSocket aberto");


        ws.send(JSON.stringify({

          authorize: token

        }));


      });



      ws.on("message",(msg)=>{


        const data =
          JSON.parse(msg.toString());


        console.log(
          "DERIV:",
          JSON.stringify(data)
        );



        if(data.error){

          clearTimeout(timeout);

          reject(
            new Error(
              data.error.message
            )
          );

          ws.close();

          return;

        }



        if(data.authorize){


          console.log(
            "Autorizado",
            data.authorize.loginid
          );



          ws.send(JSON.stringify({

            buy:1,

            price:Number(amount),


            parameters:{


              amount:Number(amount),


              basis:"stake",


              contract_type:contract_type,


              currency:"USD",


              duration:5,


              duration_unit:"m",


              symbol:symbol,


              product_type:"basic"

            }


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

      contract:contract

    });



  }catch(error){


    console.log(
      "ERRO DERIV",
      error.message
    );


    return res.status(400).json({

      status:"Erro ordem",

      message:error.message

    });


  }

}
