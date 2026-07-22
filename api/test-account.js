export default async function handler(req,res){

const appId = process.env.DERIV_APP_ID;
const token = process.env.DERIV_TOKEN;


const response = await fetch(
"https://api.derivws.com/trading/v1/options/accounts",
{
method:"GET",
headers:{
"Deriv-App-ID":appId,
"Authorization":`Bearer ${token}`
}
}
);


const data = await response.json();


return res.status(200).json(data);

}
