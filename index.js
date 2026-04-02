const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = "mlabot123";

const sessions = {};

const S = {
  LANG:"LANG", REG_NAME:"REG_NAME", REG_VILLAGE:"REG_VILLAGE",
  REG_MANDAL:"REG_MANDAL", REG_VOTER:"REG_VOTER", MAIN:"MAIN",
  C_CAT:"C_CAT", C_SUB:"C_SUB", C_DESCRIBE:"C_DESCRIBE",
  C_PHOTO:"C_PHOTO", C_DONE:"C_DONE", STATUS:"STATUS",
  UPDATES:"UPDATES", FB1:"FB1", FB2:"FB2", FB3:"FB3",
  FB_DONE:"FB_DONE", TEAM:"TEAM",
};

function num(s){ const m=s.trim().match(/^(\d)/); return m?+m[1]:0; }
function tid(){ return "#MLA2026"+(Math.random()*9000+1000|0); }

const M = {
  lang:నమస్కారం! 🙏 Welcome to Constituency MLA's official WhatsApp helpline.\n\nPlease choose your language:\n1️⃣ తెలుగు\n2️⃣ English,
  regName:Please share your full name 🙏,
  regVillage:(n)=>Thank you ${n} Ji!\nWhich village or ward are you from?,
  regMandal:Which mandal do you belong to?,
  regVoter:Your Voter ID? (optional - type skip to continue),
  regDone:(n,v,m)=>✅ Registered, ${n} Ji!\n📍 ${v}, ${m}\n\nHow can we help you today?\n\n1️⃣ Register a Complaint\n2️⃣ Check Complaint Status\n3️⃣ MLA Updates\n4️⃣ Give Feedback\n5️⃣ Talk to Team,
  main:(n)=>Welcome back, ${n} Ji! 🙏\n\n1️⃣ Register a Complaint\n2️⃣ Check Complaint Status\n3️⃣ MLA Updates\n4️⃣ Give Feedback\n5️⃣ Talk to Team,
  cCat:Please select a category:\n\n🏗️ 1. Development\n🤝 2. Welfare\n🏥 3. Health\n📌 4. Other / Personal,
  devSub:Development:\n\n1. Roads & Infrastructure\n2. Water Supply\n3. Electricity\n4. Education\n5. Other,
  welfareSub:Welfare:\n\n1. Pensions\n2. Ration Card\n3. Government Schemes\n4. Other,
  healthSub:Health:\n\n1. Medical Emergency\n2. Hospital Issue\n3. Medicine or Health Scheme\n4. CMRF Request\n5. Other,
  personalDesc:Please type your request freely. We will make sure it reaches the MLA's team. 🙏,
  describe:Please describe your issue in a few words 🙏,
  photo:(v,m)=>📍 Location: ${v}, ${m}\n\nAttach a photo? (send photo or type skip),
  cDone:(cat,t)=>✅ Complaint submitted!\n\n📋 ${cat}\n🎫 ${t}\n\nThe MLA's team will respond within 48 hours. 🙏\n\nType anything to return to menu.,
  status:📋 Your recent complaints:\n\n🎫 #MLA20261284 - Roads\n✅ Resolved - Mar 22\n\n🎫 #MLA20261047 - Ration Card\n🔵 Under Review - Mar 27\n\nType anything to return to menu.,
  updates:📢 Latest updates:\n\n🏗️ Mar 28 - Road repair completed in Eturnagaram\n🏥 Mar 25 - Free health camp on April 3rd at Tadvai\n🤝 Mar 20 - 340 pension applications processed\n\nType anything to return to menu.,
  fb1:How satisfied are you with the MLA's work? (1-5)\n\n1 - Very Dissatisfied\n2 - Dissatisfied\n3 - Neutral\n4 - Satisfied\n5 - Very Satisfied,
  fb2:What is the biggest issue in your area?\n\n1. Roads\n2. Water\n3. Electricity\n4. Pensions\n5. Health\n6. Other,
  fb3:Any message for the MLA? (or type skip),
  fbDone:🙏 Thank you for your feedback! It has been shared with the MLA's team.\n\nType anything to return to menu.,
  team:👥 A team member will contact you within 24 hours. 🙏\n\nType anything to return to menu.,
  invalid:Please reply with a number from the options above 🙏,
};

const CATS = {
  dev:["","Roads & Infrastructure","Water Supply","Electricity","Education","Other Development"],
  welfare:["","Pensions","Ration Card","Government Schemes","Other Welfare"],
  health:["","Medical Emergency","Hospital Issue","Medicine or Health Scheme","CMRF Request","Other Health"],
};

function getSession(phone){
  if(!sessions[phone]) sessions[phone]={ state:S.LANG, data:{} };
  return sessions[phone];
}

function transition(state, input, data){
  const n = num(input);
  const goMain = ()=>({ next:S.MAIN, msg:M.main(data.name||"Voter"), data });

  switch(state){
    case S.LANG:
      if(n===1||n===2) return { next:S.REG_NAME, msg:M.regName, data:{...data,lang:n===1?"TE":"EN"} };
      return { next:S.LANG, msg:M.lang, data };

    case S.REG_NAME: {
      const name=input.trim()||"Voter";
      return { next:S.REG_VILLAGE, msg:M.regVillage(name), data:{...data,name} };
    }
    case S.REG_VILLAGE: {
      const village=input.trim()||"Your Village";
      return { next:S.REG_MANDAL, msg:M.regMandal, data:{...data,village} };
    }
    case S.REG_MANDAL: {
      const mandal=input.trim()||"Your Mandal";
      return { next:S.REG_VOTER, msg:M.regVoter, data:{...data,mandal} };
    }
    case S.REG_VOTER:
      return { next:S.MAIN, msg:M.regDone(data.name,data.village,data.mandal), data };

    case S.MAIN:
      if(n===1) return { next:S.C_CAT, msg:M.cCat, data };
      if(n===2) return { next:S.STATUS, msg:M.status, data };
      if(n===3) return { next:S.UPDATES, msg:M.updates, data };
      if(n===4) return { next:S.FB1, msg:M.fb1, data };
      if(n===5) return { next:S.TEAM, msg:M.team, data };
      return { next:S.MAIN, msg:M.main(data.name), data };

    case S.C_CAT:
      if(n===1) return { next:S.C_SUB, msg:M.devSub, data:{...data,cat:"dev"} };
      if(n===2) return { next:S.C_SUB, msg:M.welfareSub, data:{...data,cat:"welfare"} };
      if(n===3) return { next:S.C_SUB, msg:M.healthSub, data:{...data,cat:"health"} };
      if(n===4) return { next:S.C_DESCRIBE, msg:M.personalDesc, data:{...data,cat:"personal",subLabel:"Personal Request"} };
      return { next:S.C_CAT, msg:M.cCat, data };

    case S.C_SUB: {
      const catData=CATS[data.cat];
      if(!catData||n<1||n>catData.length-1) return { next:S.C_SUB, msg:M.invalid, data };
      return { next:S.C_DESCRIBE, msg:M.describe, data:{...data,subLabel:catData[n]} };
    }
    case S.C_DESCRIBE: {
      const ticketNo=tid();
      if(data.cat==="personal") return { next:S.C_DONE, msg:M.cDone(data.subLabel,ticketNo), data };
      return { next:S.C_PHOTO, msg:M.photo(data.village,data.mandal), data:{...data,ticketNo} };
    }
    case S.C_PHOTO:
      return { next:S.C_DONE, msg:M.cDone(data.subLabel,data.ticketNo), data };

    case S.C_DONE:
    case S.STATUS:
    case S.UPDATES:
    case S.FB_DONE:
    case S.TEAM:
      return goMain();

    case S.FB1: return { next:S.FB2, msg:M.fb2, data };
    case S.FB2: return { next:S.FB3, msg:M.fb3, data };
    case S.FB3: return { next:S.FB_DONE, msg:M.fbDone, data };

    default: return goMain();
  }
}

async function sendMessage(to, text){
  await axios.post(
    https://graph.facebook.com/v18.0/${PHONE_ID}/messages,
    { messaging_product:"whatsapp", to, type:"text", text:{ body:text } },
    { headers:{ Authorization:Bearer ${TOKEN}, "Content-Type":"application/json" } }
  );
}

app.get("/webhook", (req, res)=>{
  if(req.query["hub.verify_token"]===VERIFY_TOKEN){
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res)=>{
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const msg = change?.value?.messages?.[0];
    if(!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body || "";

    const session = getSession(from);
    const { next, msg:reply, data } = transition(session.state, text, session.data);
    session.state = next;
    session.data = data;

    await sendMessage(from, reply);
    res.sendStatus(200);
  } catch(e){
    console.error(e);
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(MLA Bot running on port ${PORT}));
