const WebSocket = require("ws");


export default async function handler(req, res) {

  const appId = process.env.DERIV_APP_ID;
  const token = process.env.DERIV_TOKEN;


  try {


    // 1 - pegar OTP

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


    const otpData =
      await otpResponse.json();


    const wsUrl =
      otpData.data.url;



    // 2 - abrir websocket

    const ws = new WebSocket(wsUrl);



    const result = await new Promise((resolve,reject)=>{


      const timeout=setTimeout(()=>{

        reject(
          new Error("Timeout WebSocket")
        );

      },15000);



      ws.on("open",()=>{


        console.log(
          "WebSocket conectado"
        );


        ws.send(JSON.stringify({

          ticks:"1HZ100V"

        }));


      });



      ws.on("message",(msg)=>{


        const data =
          JSON.parse(msg.toString());


        console.log(data);



        if(data.tick){


          clearTimeout(timeout);


          resolve({

            status:"Conectado",

            symbol:
              data.tick.symbol,

            price:
              data.tick.quote

          });


          ws.close();

        }


        if(data.error){

          clearTimeout(timeout);

          reject(
            new Error(
              data.error.message
            )
          );

        }


      });



      ws.on("error",(err)=>{

        clearTimeout(timeout);

        reject(err);

      });



    });



    return res.status(200).json(result);



  } catch(error){


    return res.status(500).json({

      status:"Erro Deriv",

      message:error.message

    });

  }

}