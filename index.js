const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = "mlabot123";
const sessions = {};

function num(s){ const m=s.trim().match(/^(\d)/); return m?+m[1]:0; }
function tid(){ return "#MLA2026"+(Math.random()*9000+1000|0); }

const LANG_MSG = "Namaskaram! Welcome to Constituency MLA official WhatsApp helpline.\n\nPlease choose your language:\n1. Telugu\n2. English";
const REG_NAME = "Please share your full name";
const REG_MANDAL = "Which mandal do you belong to?";
const REG_VOTER = "Your Voter ID? (optional - type skip to continue)";
const MAIN_MENU = (n) => "Welcome " + n + "!\n\n1. Register a Complaint\n2. Check Complaint Status\n3. MLA Updates\n4. Give Feedback\n5. Talk to Team";
const CAT_MENU = "Please select a category:\n\n1. Development\n2. Welfare\n3. Health\n4. Other / Personal";
const DEV_SUB = "Development:\n1. Roads\n2. Water Supply\n3. Electricity\n4. Education\n5. Other";
const WEL_SUB = "Welfare:\n1. Pensions\n2. Ration Card\n3. Government Schemes\n4. Other";
const HEA_SUB = "Health:\n1. Medical Emergency\n2. Hospital Issue\n3. Medicine or Health Scheme\n4. CMRF Request\n5. Other";
const STATUS_MSG = "Your recent complaints:\n\n#MLA20261284 - Roads - Resolved - Mar 22\n#MLA20261047 - Ration Card - Under Review - Mar 27\n\nType anything to return to menu.";
const UPDATES_MSG = "Latest from Constituency MLA:\n\nMar 28 - Road repair completed in Eturnagaram\nMar 25 - Free health camp on April 3rd at Tadvai\nMar 20 - 340 pension applications processed\n\nType anything to return to menu.";
const FB1 = "How satisfied are you with the MLA work? (1-5)\n1 - Very Dissatisfied\n2 - Dissatisfied\n3 - Neutral\n4 - Satisfied\n5 - Very Satisfied";
const FB2 = "What is the biggest issue in your area?\n1. Roads\n2. Water\n3. Electricity\n4. Pensions\n5. Health\n6. Other";
const FB3 = "Any message for the MLA? (or type skip)";
const FB_DONE = "Thank you for your feedback! It has been shared with the MLA team.\n\nType anything to return to menu.";
const TEAM_MSG = "A team member will contact you within 24 hours.\n\nType anything to return to menu.";
const INVALID = "Please reply with a number from the options above.";

const CATS = {
  dev:["","Roads","Water Supply","Electricity","Education","Other Development"],
  welfare:["","Pensions","Ration Card","Government Schemes","Other Welfare"],
  health:["","Medical Emergency","Hospital Issue","Medicine or Health Scheme","CMRF Request","Other Health"],
};

const S = {
  LANG:"LANG",REG_NAME:"REG_NAME",REG_VILLAGE:"REG_VILLAGE",
  REG_MANDAL:"REG_MANDAL",REG_VOTER:"REG_VOTER",MAIN:"MAIN",
  C_CAT:"C_CAT",C_SUB:"C_SUB",C_DESCRIBE:"C_DESCRIBE",
  C_PHOTO:"C_PHOTO",C_DONE:"C_DONE",STATUS:"STATUS",
  UPDATES:"UPDATES",FB1:"FB1",FB2:"FB2",FB3:"FB3",
  FB_DONE:"FB_DONE",TEAM:"TEAM",
};

function getSession(phone){
  if(!sessions[phone]) sessions[phone]={state:S.LANG,data:{}};
  return sessions[phone];
}

function transition(state,input,data){
  const n=num(input);
  const goMain=()=>({next:S.MAIN,msg:MAIN_MENU(data.name||"Voter"),data});

  switch(state){
    case S.LANG:
      if(n===1||n===2) return {next:S.REG_NAME,msg:REG_NAME,data:{...data,lang:n===1?"TE":"EN"}};
      return {next:S.LANG,msg:LANG_MSG,data};
    case S.REG_NAME:{
      const name=input.trim()||"Voter";
      return {next:S.REG_VILLAGE,msg:"Thank you "+name+"! Which village or ward are you from?",data:{...data,name}};
    }
    case S.REG_VILLAGE:{
      const village=input.trim()||"Your Village";
      return {next:S.REG_MANDAL,msg:REG_MANDAL,data:{...data,village}};
    }
    case S.REG_MANDAL:{
      const mandal=input.trim()||"Your Mandal";
      return {next:S.REG_VOTER,msg:REG_VOTER,data:{...data,mandal}};
    }
    case S.REG_VOTER:
      return {next:S.MAIN,msg:"Registered! "+data.name+" from "+data.village+", "+data.mandal+".\n\n"+MAIN_MENU(data.name),data};
    case S.MAIN:
      if(n===1) return {next:S.C_CAT,msg:CAT_MENU,data};
      if(n===2) return {next:S.STATUS,msg:STATUS_MSG,data};
      if(n===3) return {next:S.UPDATES,msg:UPDATES_MSG,data};
      if(n===4) return {next:S.FB1,msg:FB1,data};
      if(n===5) return {next:S.TEAM,msg:TEAM_MSG,data};
      return {next:S.MAIN,msg:MAIN_MENU(data.name),data};
    case S.C_CAT:
      if(n===1) return {next:S.C_SUB,msg:DEV_SUB,data:{...data,cat:"dev"}};
      if(n===2) return {next:S.C_SUB,msg:WEL_SUB,data:{...data,cat:"welfare"}};
      if(n===3) return {next:S.C_SUB,msg:HEA_SUB,data:{...data,cat:"health"}};
      if(n===4) return {next:S.C_DESCRIBE,msg:"Please type your request freely.",data:{...data,cat:"personal",subLabel:"Personal Request"}};
      return {next:S.C_CAT,msg:CAT_MENU,data};
    case S.C_SUB:{
      const catData=CATS[data.cat];
      if(!catData||n<1||n>catData.length-1) return {next:S.C_SUB,msg:INVALID,data};
      return {next:S.C_DESCRIBE,msg:"Please describe your issue in a few words.",data:{...data,subLabel:catData[n]}};
    }
    case S.C_DESCRIBE:{
      const ticketNo=tid();
      if(data.cat==="personal") return {next:S.C_DONE,msg:"Complaint submitted!\nCategory: "+data.subLabel+"\nTicket: "+ticketNo+"\n\nThe team will respond within 48 hours.\n\nType anything to return to menu.",data};
      return {next:S.C_PHOTO,msg:"Location: "+data.village+", "+data.mandal+"\n\nAttach a photo? (send photo or type skip)",data:{...data,ticketNo}};
    }
    case S.C_PHOTO:
      return {next:S.C_DONE,msg:"Complaint submitted!\nCategory: "+data.subLabel+"\nTicket: "+data.ticketNo+"\n\nThe team will respond within 48 hours.\n\nType anything to return to menu.",data};
    case S.C_DONE:
    case S.STATUS:
    case S.UPDATES:
    case S.FB_DONE:
    case S.TEAM:
      return goMain();
    case S.FB1: return {next:S.FB2,msg:FB2,data};
    case S.FB2: return {next:S.FB3,msg:FB3,data};
    case S.FB3: return {next:S.FB_DONE,msg:FB_DONE,data};
    default: return goMain();
  }
}

async function sendMessage(to,text){
  await axios.post(
    "https://graph.facebook.com/v18.0/"+PHONE_ID+"/messages",
    {messaging_product:"whatsapp",to,type:"text",text:{body:text}},
    {headers:{Authorization:"Bearer "+TOKEN,"Content-Type":"application/json"}}
  );
}

app.get("/webhook",(req,res)=>{
  if(req.query["hub.verify_token"]===VERIFY_TOKEN){
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook",async(req,res)=>{
  try{
    const msg=req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if(!msg) return res.sendStatus(200);
    const from=msg.from;
    const text=msg.text?.body||"";
    const session=getSession(from);
    const {next,msg:reply,data}=transition(session.state,text,session.data);
    session.state=next;
    session.data=data;
    await sendMessage(from,reply);
    res.sendStatus(200);
  } catch(e){
    console.error(e);
    res.sendStatus(200);
  }
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log("MLA Bot running on port "+PORT));
