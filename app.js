
const $ = id => document.getElementById(id);
let soundEnabled = true;
let recognition = null;

function trNumber(value){
  return Number(String(value).replace(",", "."));
}
function speak(text){
  if(!soundEnabled || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "tr-TR"; u.rate = 0.96; u.pitch = 0.92;
  speechSynthesis.speak(u);
}
function setResponse(text, say=true){
  $("response").textContent = text;
  if(say) speak(text);
}
function markets(){
  return JSON.parse(localStorage.getItem("berzahMarkets") || "{}");
}
function saveMarkets(data){
  localStorage.setItem("berzahMarkets", JSON.stringify(data));
  renderMarkets();
}
function normalizeName(s){
  return s.toLocaleLowerCase("tr-TR").trim();
}
function findMarket(name){
  const all = markets(), key = normalizeName(name);
  return Object.values(all).find(x => key.includes(normalizeName(x.name)) || normalizeName(x.name).includes(key));
}
function analyze(budget, price, item="Bu ürün"){
  if(!Number.isFinite(budget) || !Number.isFinite(price) || budget < 0 || price < 0)
    return "Geçerli bir para ve fiyat değeri söylemelisin.";
  if(price > budget)
    return `${item} için paran yetmiyor. ${price-budget} won daha gerekiyor.`;
  const remain = budget-price;
  const ratio = budget === 0 ? 100 : price/budget*100;
  const market = findMarket(item);
  let verdict = ratio >= 85 ? "Riskli" : ratio >= 65 ? "Dikkatli alınabilir" : "Bütçe açısından alınabilir";
  let reason = `Alımdan sonra ${remain.toFixed(2).replace(".00","")} won kalır. Ürün bütçenin yüzde ${ratio.toFixed(1).replace(".",",")} kadarını kullanıyor.`;
  if(market){
    if(price > market.max){ verdict="Alınmaz"; reason += ` Kayıtlı piyasa üst sınırı ${market.max} won; fiyat ${price-market.max} won fazla.`; }
    else if(price <= market.min){ verdict="Alınır"; reason += ` Kayıtlı en düşük piyasa fiyatına eşit veya daha ucuz.`; }
    else if(price <= market.normal){ verdict="Alınabilir"; reason += ` Kayıtlı normal piyasa fiyatının üzerinde değil.`; }
    else { verdict="Pahalı"; reason += ` Normal fiyat ${market.normal} won, üst sınır ${market.max} won.`; }
  }
  return `${verdict}. ${reason}`;
}
function parseSpeech(text){
  const clean = text.replace(/^berzah[,\s]*/i,"").trim();
  const nums = [...clean.matchAll(/(\d+(?:[.,]\d+)?)\s*won/gi)].map(m=>trNumber(m[1]));
  const itemMatch = clean.match(/(?:param var[,.]?\s*)?(.+?)\s+(?:bileti\s+)?(\d+(?:[.,]\d+)?)\s*won/i);
  if(/piyasa|normal fiyat|en düşük|en yüksek/i.test(clean)){
    return "Piyasa bilgisini aşağıdaki Piyasa Hafızası bölümünden kaydedebilirsin.";
  }
  if(nums.length >= 2){
    let item = "Bu ürün";
    const m = clean.match(/(?:param var[,.]?\s*)(.+?)\s+\d+(?:[.,]\d+)?\s*won/i);
    if(m) item = m[1].replace(/işte|fiyatı|tanesi/gi,"").trim();
    return analyze(nums[0], nums[1], item);
  }
  const quantity = clean.match(/(\d+)\s*adet.*?(\d+(?:[.,]\d+)?)\s*won/i);
  if(quantity){
    const q=trNumber(quantity[1]), total=trNumber(quantity[2]);
    const unit=total/q;
    return `Tanesi ${unit.toFixed(4).replace(".",",")} won eder. ${unit > 1/3 ? "Alınmaz; 0,3333 won sınırından pahalı." : "Alınır; 0,3333 won sınırına eşit veya daha ucuz."}`;
  }
  return "Seni anladım fakat hesap için iki fiyat duymam gerekiyor. Örneğin: 210 won param var, Nemere bileti 175 won, alayım mı?";
}
function startListening(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    setResponse("Bu iPhone sürümünde tarayıcıdan ses tanıma açılamadı. Hızlı Analiz bölümünü kullanabilirsin.", false);
    return;
  }
  recognition = new SR();
  recognition.lang="tr-TR"; recognition.interimResults=false; recognition.continuous=false;
  $("orb").classList.add("listening"); $("status").textContent="Seni dinliyorum...";
  recognition.onresult=e=>{
    const text=e.results[0][0].transcript;
    $("status").textContent=`Duyduğum: ${text}`;
    setResponse(parseSpeech(text));
  };
  recognition.onerror=e=>{
    $("status").textContent="Ses algılanamadı. Mikrofon iznini kontrol et.";
    setResponse("Mikrofon erişimi başarısız oldu. Safari ayarlarından mikrofon iznini aç.", false);
  };
  recognition.onend=()=> $("orb").classList.remove("listening");
  recognition.start();
}
function renderMarkets(){
  const all=markets(), box=$("marketList"); box.innerHTML="";
  Object.entries(all).forEach(([key,x])=>{
    const row=document.createElement("div"); row.className="market-row";
    row.innerHTML=`<span><b>${x.name}</b><br>${x.min} / ${x.normal} / ${x.max} won</span><button data-key="${key}">Sil</button>`;
    row.querySelector("button").onclick=()=>{delete all[key];saveMarkets(all)};
    box.appendChild(row);
  });
}
$("micButton").onclick=startListening;
$("analyzeButton").onclick=()=>{
  const result=analyze(trNumber($("budget").value),trNumber($("price").value),$("itemName").value||"Bu ürün");
  setResponse(result);
};
$("saveMarketButton").onclick=()=>{
  const name=$("marketItem").value.trim(), min=trNumber($("marketMin").value), normal=trNumber($("marketNormal").value), max=trNumber($("marketMax").value);
  if(!name || ![min,normal,max].every(Number.isFinite)){setResponse("Piyasa kaydı için eşya adı ve üç fiyatı da doldur.",false);return}
  const all=markets(); all[normalizeName(name)]={name,min,normal,max}; saveMarkets(all);
  setResponse(`${name} piyasa bilgisi kaydedildi.`);
};
$("soundToggle").onclick=()=>{
  soundEnabled=!soundEnabled; $("soundToggle").textContent=soundEnabled?"🔊":"🔇";
};
renderMarkets();
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
