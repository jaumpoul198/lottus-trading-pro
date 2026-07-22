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
      error: "Credenciais Deriv ausentes"
    });

  }


  try {

    console.log("🔗 Buscando conta Deriv");


    // Buscar contas
    const accountsResponse = await fetch(
      "https://api.derivws.com/trading/v1/options/accounts",
      {
        headers:{
          "Deriv-App-ID": appId,
          "Authorization": `Bearer ${token}`
        }
      }
    );


    const accountsJson =
      await accountsResponse.json();


    console.log(
      "Contas:",
      accountsJson
    );


    if(!accountsJson.data){

      throw new Error(
        "Nenhuma conta encontrada"
      );

    }


    const demoAccount =
      accountsJson.data.find(
        acc => acc.account_type === "demo"
      );


    if(!demoAccount){

      throw new Error(
        "Conta demo não encontrada"
      );

    }



    console.log(
      "Conta usada:",
      demoAccount.account_id
    );



    // Buscar OTP
    const otpResponse =
      await fetch(

        `https://api.derivws.com/trading/v1/options/accounts/${demoAccount.account_id}/otp`,

        {
          method:"POST",

          headers:{
            "Deriv-App-ID":appId,
            "Authorization":`Bearer ${token}`
          }

        }

      );



    const otpJson =
      await otpResponse.json();



    console.log(
      "OTP:",
      otpJson
    );



    if(!otpJson.data?.url){

      throw new Error(
        "OTP websocket não recebido"
      );

    }



    const ws =
      new WebSocket(
        otpJson.data.url
      );



    const contract =
      await new Promise((resolve,reject)=>{


        const timeout =
          setTimeout(()=>{

            reject(
              new Error(
                "Timeout aguardando Deriv"
              )
            );

          },30000);



        ws.on("open",()=>{


          console.log(
            "✅ WebSocket Options aberto"
          );



          const order = {

            buy:1,

            price:Number(amount),

            parameters:{

              amount:Number(amount),

              basis:"stake",

              contract_type:
                contract_type,

              currency:"USD",

              duration:5,

              duration_unit:"m",

              symbol:symbol

            }

          };



          console.log(
            "📤 Enviando BUY:",
            order
          );



          ws.send(
            JSON.stringify(order)
          );


        });




        ws.on("message",(msg)=>{


          const data =
            JSON.parse(
              msg.toString()
            );



          console.log(
            "📥 DERIV:",
            data
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




  } catch(error) {


    console.error(
      "❌ Erro ordem:",
      error
    );


    return res.status(400).json({

      status:"Erro ordem",

      message:error.message

    });


  }

}
