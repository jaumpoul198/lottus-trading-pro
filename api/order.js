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
      error: "Credenciais ausentes"
    });
  }


  try {

    // 1 - pegar conta demo
    const accountsResponse = await fetch(
      "https://api.derivws.com/trading/v1/options/accounts",
      {
        headers:{
          "Deriv-App-ID": appId,
          "Authorization": `Bearer ${token}`
        }
      }
    );


    const accounts = await accountsResponse.json();


    const account =
      accounts.data.find(
        a => a.account_type === "demo"
      );


    if(!account){
      throw new Error("Conta demo não encontrada");
    }


    // 2 - pegar OTP websocket
    const otpResponse = await fetch(
      `https://api.derivws.com/trading/v1/options/accounts/${account.account_id}/otp`,
      {
        method:"POST",
        headers:{
          "Deriv-App-ID": appId,
          "Authorization": `Bearer ${token}`
        }
      }
    );


    const otpData = await otpResponse.json();


    const wsUrl =
      otpData.data.url;


    // 3 - conectar websocket novo
    const ws = new WebSocket(wsUrl);


    const result = await new Promise((resolve,reject)=>{


      const timeout=setTimeout(()=>{

        reject(
          new Error("Timeout Deriv")
        );

      },20000);



      ws.on("open",()=>{


        console.log(
          "WebSocket Options conectado"
        );


        ws.send(JSON.stringify({

          buy:1,

          price:amount,

          parameters:{

            amount:amount,

            basis:"stake",

            contract_type,

            currency:"USD",

            duration:5,

            duration_unit:"m",

            symbol

          }

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
            new Error(
              data.error.message
            )
          );

        }



        if(data.buy){


          clearTimeout(timeout);


          resolve(data.buy);


          ws.close();

        }


      });



      ws.on("error",err=>{

        clearTimeout(timeout);

        reject(err);

      });


    });



    return res.status(200).json({

      status:"Contrato criado",

      contract:result

    });



  }catch(error){


    return res.status(400).json({

      status:"Erro ordem",

      message:error.message

    });

  }

}
