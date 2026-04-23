const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = "mlabot123";
const sessions = {};

// --- UTILS ---
function num(s) { const m = s.trim().match(/^(\d)/); return m ? +m[1] : 0; }
function tid() { return "#IBR2026-" + (Math.random() * 9000 + 1000 | 0); }

// --- CONSTANTS & DATA STRUCURES ---
const LANG_MSG = "Namaskaram! Welcome to the Ibrahimpatnam Constituency Official Helpline.\n\nPlease choose your language:\n1. Telugu\n2. English";
const REG_NAME = "Please enter your full name.";
const REG_VOTER = "Please enter your Voter ID (EPIC Number) so we can verify your constituency details.\n\n(If you don't have it handy right now, type 'skip')";
const REG_LOCATION = "Where do you reside? Please select your Mandal or Municipality:\n\n1. Ibrahimpatnam Mandal\n2. Manchal Mandal\n3. Yacharam Mandal\n4. Hayathnagar Mandal\n5. Abdullahpurmet Mandal\n6. Ibrahimpatnam Municipality\n7. Adibatla Municipality\n8. Turkayamjal Municipality\n9. Pedda Amberpet Municipality";

const LOCATIONS = [
  null, // index 0 buffer
  { name: "Ibrahimpatnam Mandal", type: "mandal" },
  { name: "Manchal Mandal", type: "mandal" },
  { name: "Yacharam Mandal", type: "mandal" },
  { name: "Hayathnagar Mandal", type: "mandal" },
  { name: "Abdullahpurmet Mandal", type: "mandal" },
  { name: "Ibrahimpatnam Municipality", type: "municipality" },
  { name: "Adibatla Municipality", type: "municipality" },
  { name: "Turkayamjal Municipality", type: "municipality" },
  { name: "Pedda Amberpet Municipality", type: "municipality" }
];

const MAIN_MENU = (n) => `Namaskaram ${n}, how can the MLA's office assist you today?\n\n1. 🏗️ Report a Local Issue\n2. 📜 Welfare & Revenue\n3. 🚨 Emergency / CMRF\n4. 🔍 Track My Request\n5. 📰 Latest MLA Updates`;

const CAT_MENUS = {
  local: "What type of local issue are you facing?\n1. Roads & Drainage\n2. Water Supply\n3. Power & Electricity\n4. Public Facilities\n5. Other",
  welfare: "Select the department:\n1. Dharani & Revenue\n2. Pensions (Aasara)\n3. Housing (2BHK/Indiramma)\n4. Ration Card\n5. Agriculture",
  cmrf: "Select emergency type:\n1. CMRF Letter Request\n2. LOC (Letter of Credit)\n3. Immediate Medical Emergency\n4. Police / Safety Issue"
};

const CATS = {
  local: ["", "Roads & Drainage", "Water Supply", "Power & Electricity", "Public Facilities", "Other"],
  welfare: ["", "Dharani & Revenue", "Pensions (Aasara)", "Housing", "Ration Card", "Agriculture"],
  cmrf: ["", "CMRF Letter Request", "LOC Request", "Medical Emergency", "Police / Safety"]
};

// The intelligent drill-down questions based on the exact issue
const DRILLDOWNS = {
  "Roads & Drainage": "Do you need a *New Road* sanctioned or an *Existing Road/Drain* repaired?\n\n(Type your answer or attach a photo)",
  "Pensions (Aasara)": "Is this a *New Application* or a *Delayed Payment*?\n\n(Type your answer or attach a photo)",
  "Dharani & Revenue": "Is this a *Mutation Issue*, *Passbook Issue*, or *Prohibited List (22A) Issue*?\n\n(Type your answer or attach a photo)",
  "Water Supply": "Are you facing *Mission Bhagiratha pipeline leaks* or *Erratic/No Supply*?\n\n(Type your answer or attach a photo)"
};
const DEFAULT_DRILLDOWN = "Please briefly describe the issue, or attach a photo of the problem.\n\n(Send text or upload an image)";

const STATUS_MSG = "Your recent complaints:\n\n#IBR2026-1284 - Dharani & Revenue - Under Review\n\nType anything to return to menu.";
const UPDATES_MSG = "Latest from MLA Office:\n\nApr 20 - New CC Road sanctioned in Adibatla\nApr 18 - 45 CMRF cheques distributed in Yacharam\n\nType anything to return to menu.";
const INVALID = "Please reply with a valid number from the options above.";

// --- STATE MACHINE ---
const S = {
  LANG: "LANG", REG_NAME: "REG_NAME", REG_VOTER: "REG_VOTER",
  REG_LOCATION: "REG_LOCATION", REG_VILLAGE_WARD: "REG_VILLAGE_WARD",
  MAIN: "MAIN", C_SUB: "C_SUB", C_DESCRIBE: "C_DESCRIBE", C_DONE: "C_DONE",
  STATUS: "STATUS", UPDATES: "UPDATES"
};

function getSession(phone) {
  if (!sessions[phone]) sessions[phone] = { state: S.LANG, data: {} };
  return sessions[phone];
}

function transition(state, input, data) {
  const n = num(input);
  const goMain = () => ({ next: S.MAIN, msg: MAIN_MENU(data.name || "Citizen"), data });

  switch (state) {
    case S.LANG:
      if (n === 1 || n === 2) return { next: S.REG_NAME, msg: REG_NAME, data: { ...data, lang: n === 1 ? "TE" : "EN" } };
      return { next: S.LANG, msg: LANG_MSG, data };
      
    case S.REG_NAME:
      const name = input.trim() || "Citizen";
      return { next: S.REG_VOTER, msg: REG_VOTER, data: { ...data, name } };
      
    case S.REG_VOTER:
      const voterId = input.trim();
      return { next: S.REG_LOCATION, msg: REG_LOCATION, data: { ...data, voterId } };
      
    case S.REG_LOCATION:
      const loc = LOCATIONS[n];
      if (!loc || n < 1 || n > 9) return { next: S.REG_LOCATION, msg: INVALID + "\n\n" + REG_LOCATION, data };
      const promptMsg = loc.type === "mandal" ? "Please type your exact Village name." : "Please type your exact Ward number.";
      return { next: S.REG_VILLAGE_WARD, msg: promptMsg, data: { ...data, locationName: loc.name, locationType: loc.type } };
      
    case S.REG_VILLAGE_WARD:
      const villageOrWard = input.trim();
      const locDisplay = data.locationType === "mandal" ? "Village" : "Ward";
      return { 
        next: S.MAIN, 
        msg: `✅ Registration Complete!\n👤 ${data.name}\n📍 ${villageOrWard} (${locDisplay}), ${data.locationName}\n\n${MAIN_MENU(data.name)}`, 
        data: { ...data, villageOrWard } 
      };

    case S.MAIN:
      if (n === 1) return { next: S.C_SUB, msg: CAT_MENUS.local, data: { ...data, cat: "local" } };
      if (n === 2) return { next: S.C_SUB, msg: CAT_MENUS.welfare, data: { ...data, cat: "welfare" } };
      if (n === 3) return { next: S.C_SUB, msg: CAT_MENUS.cmrf, data: { ...data, cat: "cmrf" } };
      if (n === 4) return { next: S.STATUS, msg: STATUS_MSG, data };
      if (n === 5) return { next: S.UPDATES, msg: UPDATES_MSG, data };
      return { next: S.MAIN, msg: MAIN_MENU(data.name), data };

    case S.C_SUB:
      const catData = CATS[data.cat];
      if (!catData || n < 1 || n >= catData.length) return { next: S.C_SUB, msg: INVALID, data };
      const subLabel = catData[n];
      const drillMsg = DRILLDOWNS[subLabel] || DEFAULT_DRILLDOWN;
      return { next: S.C_DESCRIBE, msg: drillMsg, data: { ...data, subLabel } };

    case S.C_DESCRIBE:
      const ticketNo = tid();
      const successMsg = `✅ Your request has been registered directly with the MLA's office.\n\n*Ticket:* ${ticketNo}\n*Category:* ${data.subLabel}\n*Location:* ${data.villageOrWard}, ${data.locationName}\n\nThe concerned department coordinator will review this within 24 hours.\n\nType anything to return to the main menu.`;
      return { next: S.C_DONE, msg: successMsg, data };

    case S.C_DONE:
    case S.STATUS:
    case S.UPDATES:
      return goMain();
      
    default: 
      return goMain();
  }
}

// --- WHATSAPP API LOGIC ---
async function sendMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
      { messaging_product: "whatsapp", to, type: "text", text: { body: text } },
      { headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Failed to send message:", error?.response?.data || error.message);
  }
}

app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);
    
    const from = msg.from;
    
    // Improved logic to capture images and text gracefully
    let text = "";
    if (msg.type === "text") {
      text = msg.text?.body || "";
    } else if (msg.type === "image") {
      text = "[Image Uploaded]";
    } else {
      text = "[Other Media]"; 
    }

    // Hidden reset command for rapid testing
    if (text.toLowerCase() === "reset") {
      delete sessions[from];
      await sendMessage(from, "Session reset.");
      return res.sendStatus(200);
    }

    const session = getSession(from);
    const { next, msg: reply, data } = transition(session.state, text, session.data);
    
    session.state = next;
    session.data = data;
    
    await sendMessage(from, reply);
    res.sendStatus(200);
  } catch (e) {
    console.error("Webhook Error:", e);
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("MLA Bot running on port " + PORT));
