(()=>{'use strict';

/* ============================================================
   設定區
   ============================================================ */
const KEY='my_travel_cards_v2';            // 新版資料
const LEGACY_KEY='my_travel_cards';        // 舊版（整段 HTML）資料，只讀取、不修改
const THEME_KEY='travel_cards_theme';
const DEFAULT_TAGS=['North','South','Central','Islands'];   // 第一次使用時的預設 TAG
const MAPS_LABEL='Google Maps';            // 此欄位的連結會顯示成按鈕

// +Add 的欄位模板：label = 欄位名稱、rows = 輸入框高度、hint = 灰色提示文字
// 想增減欄位或改提示，改這個陣列就好（已存的卡片不受影響）
const TEMPLATE=[
 {label:'日期',rows:1,hint:'YYYY(民國)/MM/DD'},
 {label:MAPS_LABEL,rows:2,hint:'直接貼上連結，多地點就每行貼一個，會自動變成按鈕'},
 {label:'出發前的精神狀態',rows:4,hint:'或稱：今日背景音、為什麼想去\n• 概念：在出發前，記錄下自己現在的心情（例如：抽離、稍微迷茫、或單純想吹風）。也可以為這趟行程挑選一張專輯或一個 Podcast 節目作為這趟路的「背景音樂」，用聽覺來定調這段時空。'},
 {label:'感官採集：視覺與聽覺',rows:4,hint:'影片或照片記錄\n• 概念：把自己當成一個冷靜的觀察者。在行程中，刻意去留意並記錄一個「畫面」或「聲音」。\n• 例子：「午後三點，打在磨石子地板上的特定光影角度」、「巷弄裡遠處傳來的傳統攤販叫賣聲」。'},
 {label:'這次最有感的瞬間',rows:3,hint:'寫下這次最有感的瞬間'},
 {label:'天氣適性',rows:3,hint:'因為有些地方：\n晴天封神\n陰天像異世界\n下雨反而超美'},
 {label:'下次可以更好的地方',rows:4,hint:'不是檢討，而是：\n太晚出門／穿錯鞋／少帶行動電源\n原來平日去比較舒服\n原來自己適合慢慢走兩個點就好\n這會讓你慢慢建立：「適合自己的旅行節奏」'},
 {label:'回到家後的切換儀式',rows:4,hint:'• 概念：旅程的結束，才是新生活的開始。\n• 做法：記錄你回到家後想做的一件事，例如「洗個熱水澡，把這趟路沾上的塵土洗掉」、「喝一杯給自己泡的茶」。'},
 {label:'實際支出',rows:2,hint:'期望預算一天200在吃的上，100在紀念品'},
 {label:'體力消耗等級',rows:3,hint:'Lv1 幾乎坐著\nLv2 輕鬆散步\nLv3 會累\nLv4 很耗體力\nLv5 回家像被卡車撞過'}
];

/* ============================================================
   基本工具與狀態
   ============================================================ */
const $=id=>document.getElementById(id);
let state={tags:[...DEFAULT_TAGS],cards:[]},filter='all',editing=null,locked=false;
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const templateFor=label=>TEMPLATE.find(t=>t.label===label);

/* ============================================================
   資料：驗證、儲存、讀取
   ============================================================ */
function normalize(raw){
 if(!raw||!Array.isArray(raw.cards)||!Array.isArray(raw.tags))throw Error('備份格式不正確');
 if(raw.format&&raw.format!=='TravelCard')throw Error('這不是 Travel Card 的備份檔（格式：'+raw.format+'）');
 const tags=[];
 for(const t of raw.tags){if(typeof t==='string'&&t.trim()&&!tags.includes(t.trim()))tags.push(t.trim())}
 const cards=raw.cards.filter(c=>c&&typeof c==='object').map(c=>({
  id:String(c.id||uid()),
  title:String(c.title||'未命名'),
  sections:Array.isArray(c.sections)
   ?c.sections.filter(s=>s&&typeof s==='object').map(s=>({label:String(s.label||'').trim()||'未命名欄位',body:String(s.body||'')}))
   :[],
  tags:Array.isArray(c.tags)?[...new Set(c.tags.filter(t=>tags.includes(t)))]:[]
 }));
 return {tags,cards};
}

// 儲存失敗要告知；原始資料讀取失敗且無法另存備份時，禁止覆蓋。
function save(){
 if(locked){alert('原始資料讀取失敗，而且無法另存備份。為避免覆蓋舊資料，已暫停儲存。\n請不要新增資料，並從瀏覽器開發者工具的 localStorage 取出「'+KEY+'」自行保存。');return false}
 try{localStorage.setItem(KEY,JSON.stringify(state));return true}
 catch(e){alert('儲存失敗（可能容量已滿或瀏覽器封鎖儲存）：'+e.message+'\n請立刻按 Backup 備份目前內容。');return false}
}

/* 舊版格式：整段 HTML（卡片是 .travelCard，標題 .Location_tit，欄位 .stit + .content） */
function parseLegacy(text){
 const doc=new DOMParser().parseFromString(text,'text/html');
 const cards=[];
 doc.querySelectorAll('.travelCard').forEach(el=>{
  const title=(el.querySelector('.Location_tit')?.textContent||'').trim()||'未命名';
  const sections=[];
  el.querySelectorAll('.stit').forEach(s=>{
   const label=s.textContent.replace(/[【】]/g,'').trim()||'未命名欄位';
   let n=s.nextElementSibling;
   while(n&&!n.classList.contains('content')&&!n.classList.contains('stit'))n=n.nextElementSibling;
   let body='';
   if(n&&n.classList.contains('content')){
    body=n.children.length?n.innerHTML:n.textContent;
    body=body.split('\n').map(l=>l.trim()).join('\n').trim();
   }
   sections.push({label,body});
  });
  cards.push({id:uid(),title,sections,tags:[]});
 });
 return cards;
}

let rawSaved=null;
try{
 rawSaved=localStorage.getItem(KEY);
 if(rawSaved)state=normalize(JSON.parse(rawSaved));
}catch(e){
 state={tags:[],cards:[]};
 let backedUp=false;
 if(rawSaved){try{localStorage.setItem(KEY+'_corrupt_'+Date.now(),rawSaved);backedUp=true}catch(_){}}
 if(rawSaved&&!backedUp)locked=true;
 alert('讀取本機資料失敗。'+(backedUp?'已把原始資料另存為「'+KEY+'_corrupt_…」，不會遺失。':(locked?'且無法另存備份，已暫停儲存以免覆蓋。':''))+'\n錯誤：'+e.message);
}

// 第一次開新版時，若偵測到舊版瀏覽器資料，詢問是否轉換（舊資料不會被刪除）
if(!rawSaved&&!locked){
 try{
  const legacy=localStorage.getItem(LEGACY_KEY);
  if(legacy&&!localStorage.getItem('travel_legacy_declined')){
   const cards=parseLegacy(legacy);
   if(cards.length){
    if(confirm('偵測到舊版旅記資料（'+cards.length+' 張卡片），要轉換並匯入嗎？\n（舊資料不會被刪除）')){state.cards=cards;save()}
    else localStorage.setItem('travel_legacy_declined','1');
   }
  }
 }catch(_){}
}

/* ============================================================
   畫面：TAG
   ============================================================ */
function render(){renderTags();renderCards()}

function renderTags(){
 const root=$('tagFilters');root.replaceChildren();
 const all=make('button','tag-pill'+(filter==='all'?' active':''),'全部 ('+state.cards.length+')');
 all.type='button';all.onclick=()=>{filter='all';render()};root.append(all);
 state.tags.forEach(t=>{
  const count=state.cards.filter(c=>c.tags.includes(t)).length;
  const b=make('button','tag-pill'+(filter===t?' active':''),t+' ('+count+')');
  b.type='button';b.onclick=()=>{filter=t;render()};root.append(b);
 });
 $('tagCount').textContent='· '+state.tags.length+' 個分類';
 document.querySelectorAll('.region').forEach(b=>b.classList.toggle('active',filter===b.dataset.tag));
 renderTagManager();
}

function renderTagManager(){
 const root=$('tagManageList');root.replaceChildren();
 state.tags.forEach(t=>{
  const row=make('div','tag-manage-row');row.append(make('span','',t));
  const rename=make('button','secondary','重新命名'),del=make('button','secondary','刪除');
  rename.type='button';del.type='button';
  rename.onclick=()=>{
   const name=prompt('重新命名 TAG：',t);if(name===null)return;
   const next=name.trim();if(!next||next===t)return;
   if(state.tags.includes(next)){alert('TAG 名稱已存在');return}
   state.tags=state.tags.map(x=>x===t?next:x);
   state.cards.forEach(c=>c.tags=c.tags.map(x=>x===t?next:x));
   if(filter===t)filter=next;save();render();
  };
  del.onclick=()=>{
   if(!confirm('確定刪除 TAG「'+t+'」？卡片會保留。'))return;
   state.tags=state.tags.filter(x=>x!==t);
   state.cards.forEach(c=>c.tags=c.tags.filter(x=>x!==t));
   if(filter===t)filter='all';save();render();
  };
  row.append(rename,del);root.append(row);
 });
}

/* ============================================================
   內容安全處理：只允許常見排版標籤與安全連結
   ============================================================ */
const allowedTags=new Set(['A','B','STRONG','I','EM','U','S','BR','P','DIV','SPAN','UL','OL','LI','BLOCKQUOTE','H2','H3','H4','HR','CODE','PRE','SMALL','SUB','SUP']);
// 內容是否真的含有允許的 HTML 標籤；沒有就當純文字，避免 <name>、&amp; 被吃掉
const HTML_LIKE=/<\/?(a|b|strong|i|em|u|s|br|p|div|span|ul|ol|li|blockquote|h[2-4]|hr|code|pre|small|sub|sup)\b[^>]*>/i;
// 含區塊標籤時改用一般換行，避免標籤間的換行字元被 pre-wrap 顯示成多餘空行
const BLOCK_HTML=/<(p|div|ul|ol|li|blockquote|h[2-4]|hr|pre)\b/i;
const COLOR_OK=/^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|red|blue|green|black|gray|grey|purple|teal|navy|maroon)$/i;

function safeHTML(html){
 const out=document.createDocumentFragment();
 if(!HTML_LIKE.test(html)){
  out.append(document.createTextNode(html));
 }else{
  const doc=new DOMParser().parseFromString(html,'text/html');
  const clean=node=>{
   if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.nodeValue);
   if(node.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
   const name=node.tagName;
   if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','TEMPLATE'].includes(name))return document.createDocumentFragment();
   const el=allowedTags.has(name)?document.createElement(name.toLowerCase()):document.createDocumentFragment();
   if(name==='A'&&el.nodeType===Node.ELEMENT_NODE){
    const href=(node.getAttribute('href')||'').trim();
    try{const u=new URL(href);if(['http:','https:','mailto:'].includes(u.protocol)){el.href=u.href;el.target='_blank';el.rel='noopener noreferrer'}}catch(_){}
   }
   if(name==='SPAN'&&el.nodeType===Node.ELEMENT_NODE){
    const color=(node.style.color||'').trim();
    if(COLOR_OK.test(color))el.style.color=color;
   }
   [...node.childNodes].forEach(child=>el.append(clean(child)));
   return el;
  };
  [...doc.body.childNodes].forEach(n=>out.append(clean(n)));
 }
 // 只針對非超連結文字節點自動轉網址，並去掉網址結尾的標點
 const walker=document.createTreeWalker(out,NodeFilter.SHOW_TEXT);const texts=[];
 while(walker.nextNode())texts.push(walker.currentNode);
 for(const node of texts){
  if(node.parentElement?.closest('a,code,pre'))continue;
  const re=/https?:\/\/[^\s<>"'，。；、）)]+/g;const value=node.nodeValue;
  let match,last=0,found=false;const frag=document.createDocumentFragment();
  while((match=re.exec(value))){
   const url=match[0].replace(/[.,!?:;」』》】”’！？：…]+$/,'');
   found=true;
   if(match.index>last)frag.append(document.createTextNode(value.slice(last,match.index)));
   const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=url;frag.append(a);
   last=match.index+url.length;re.lastIndex=last;
  }
  if(found){frag.append(document.createTextNode(value.slice(last)));node.replaceWith(frag)}
 }
 return out;
}

// Google Maps 欄位：連結改成按鈕。網址文字會換成「📍 Google Maps」（多個則編號）；你自己寫的連結名稱會保留。
function toMapButtons(root){
 const links=[...root.querySelectorAll('a')];
 links.forEach((a,i)=>{
  a.classList.add('location-btn');
  if(/^https?:\/\//i.test(a.textContent.trim()))a.textContent='📍 '+(links.length>1?'地點 '+(i+1):MAPS_LABEL);
 });
}

/* ============================================================
   畫面：卡片
   ============================================================ */
function renderCards(){
 const root=$('cardContainer');root.replaceChildren();
 const cards=state.cards.filter(c=>filter==='all'||c.tags.includes(filter));
 if(!cards.length){root.append(make('div','empty muted',filter==='all'?'還沒有旅記，按 + Add 開始記錄。':'這個 TAG 目前沒有卡片。'));return}
 cards.forEach(c=>{
  const card=make('article','travelCard');

  const toolbar=make('div','card-toolbar');
  const edit=make('button','edit-btn','📝Edit'),del=make('button','delete-btn','🗑️Delete');
  edit.type='button';del.type='button';
  edit.onclick=()=>openEditor(c.id);
  del.onclick=()=>{
   if(!confirm('確定要刪除「'+c.title+'」這張旅記卡片嗎？\n(刪除後無法復原)'))return;
   state.cards=state.cards.filter(x=>x.id!==c.id);save();render();
  };
  toolbar.append(edit,del);

  const content=make('div','card-content');
  content.append(make('div','Location_tit',c.title));
  c.sections.forEach(s=>{
   if(!s.body.trim())return;                       // 空白欄位不顯示
   content.append(make('div','stit','【'+s.label+'】'));
   const isMaps=s.label===MAPS_LABEL;
   const htmlMode=HTML_LIKE.test(s.body)&&BLOCK_HTML.test(s.body);
   const body=make('div','content'+(isMaps?' maps':'')+(htmlMode?' html-mode':''));
   body.append(safeHTML(s.body));
   if(isMaps)toMapButtons(body);
   content.append(body);
  });

  const tags=make('div','card-tags');
  c.tags.forEach(t=>tags.append(make('span','card-tag','#'+t)));

  card.append(toolbar,content,tags);
  root.append(card);
 });
}

/* ============================================================
   新增／編輯視窗（欄位依 TEMPLATE）
   ============================================================ */
function openEditor(id=null){
 editing=id;const c=state.cards.find(x=>x.id===id);
 $('dialogTitle').textContent=c?'編輯旅記':'新增旅記';
 $('cardTitle').value=c?.title||'';

 // 先放卡片原有欄位，再補上模板中還沒有的欄位（舊卡片也能補填新欄位）
 const secs=(c?c.sections:[]).map(s=>({...s}));
 TEMPLATE.forEach(t=>{if(!secs.some(s=>s.label===t.label))secs.push({label:t.label,body:''})});

 const sroot=$('editSections');sroot.replaceChildren();
 secs.forEach((s,i)=>{
  const tpl=templateFor(s.label);
  const field=make('div','field'),lab=make('label','','【'+s.label+'】');
  const ta=document.createElement('textarea');
  ta.id='sec'+i;lab.htmlFor=ta.id;
  ta.dataset.label=s.label;ta.rows=tpl?.rows||4;ta.placeholder=tpl?.hint||'';ta.value=s.body;
  field.append(lab,ta);sroot.append(field);
 });

 const root=$('editTags');root.replaceChildren();
 state.tags.forEach(t=>{
  const label=make('label');const cb=document.createElement('input');
  cb.type='checkbox';cb.value=t;cb.checked=!!c?.tags.includes(t);
  label.append(cb,document.createTextNode(' '+t));root.append(label);
 });
 $('cardDialog').showModal();
}

$('cardForm').onsubmit=e=>{
 e.preventDefault();
 const title=$('cardTitle').value.trim();if(!title)return;
 const sections=[...$('editSections').querySelectorAll('textarea')].map(t=>({label:t.dataset.label,body:t.value.trim()}));
 const tags=[...$('editTags').querySelectorAll('input:checked')].map(x=>x.value);
 const data={title,sections,tags};
 if(editing){const c=state.cards.find(x=>x.id===editing);if(c)Object.assign(c,data)}
 else state.cards.unshift({id:uid(),...data});
 save();$('cardDialog').close();render();
};
$('cancelDialog').onclick=()=>$('cardDialog').close();
$('addCardBtn').onclick=()=>openEditor();

/* ============================================================
   TAG 管理面板、區域快捷
   ============================================================ */
$('manageBtn').onclick=()=>{$('tagManager').hidden=!$('tagManager').hidden};
$('closeTagManager').onclick=()=>{$('tagManager').hidden=true};
document.addEventListener('pointerdown',e=>{const panel=$('tagManager');if(!panel.hidden&&!panel.contains(e.target)&&!$('manageBtn').contains(e.target))panel.hidden=true});

function addTag(){
 const name=$('newTag').value.trim();if(!name)return;
 if(state.tags.includes(name)){alert('TAG 已存在');return}
 state.tags.push(name);$('newTag').value='';save();render();
}
$('createTag').onclick=addTag;
$('newTag').onkeydown=e=>{if(e.key==='Enter')addTag()};

document.querySelectorAll('.region').forEach(b=>{
 b.onclick=()=>{filter=filter===b.dataset.tag?'all':b.dataset.tag;render()};
});

/* ============================================================
   備份／匯入
   ============================================================ */
// 優先使用系統分享（iOS 主畫面 App 較可靠），不支援時退回下載
$('exportBtn').onclick=async()=>{
 const data=JSON.stringify({format:'TravelCard',version:1,exportedAt:new Date().toISOString(),...state},null,2);
 const name='TravelCard_Backup_'+new Date().toISOString().slice(0,10)+'.txt';
 try{
  const file=new File([data],name,{type:'text/plain'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
   await navigator.share({files:[file],title:name});return;
  }
 }catch(err){if(err&&err.name==='AbortError')return}
 const blob=new Blob([data],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
};

// 可匯入新版備份（JSON），也可匯入舊版旅記的 .txt 備份（HTML）
$('importFile').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  const text=await file.text();
  let json=null;try{json=JSON.parse(text)}catch(_){}
  let next,legacy=false;
  if(json!==null){
   next=normalize(json);
  }else{
   const cards=parseLegacy(text);
   if(!cards.length)throw Error('不是 Travel Card 的備份格式');
   next={tags:[...state.tags],cards};legacy=true;
  }
  if(!confirm('匯入'+(legacy?'（舊版格式，會自動轉換）':'')+'將取代目前所有旅記與 TAG（'+next.cards.length+' 張卡片）。建議先 Backup，確定繼續？'))return;
  const prev=state,prevFilter=filter;
  state=next;filter='all';
  if(!save()){state=prev;filter=prevFilter;render();return}
  render();alert('匯入完成');
 }catch(err){alert('匯入失敗：請選擇 Travel Card 匯出的備份。\n'+err.message)}
};

/* ============================================================
   暗色模式：選擇存在獨立的 key，不影響旅記資料與備份；未選擇過時跟隨系統
   ============================================================ */
const themeBtn=$('themeBtn');
const currentTheme=()=>document.documentElement.dataset.theme==='dark'?'dark':'light';
function applyTheme(t){
 document.documentElement.dataset.theme=t;
 themeBtn.textContent=t==='dark'?'☀️ Light':'🌙 Dark';
 const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==='dark'?'#0f1c21':'#005073';
}
themeBtn.onclick=()=>{const next=currentTheme()==='dark'?'light':'dark';applyTheme(next);try{localStorage.setItem(THEME_KEY,next)}catch(_){}};
applyTheme(currentTheme());

render();
})();

// Travel Card 專用 PWA：僅註冊 travelcard/ 內的 Service Worker。
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch(err => console.warn('Travel Card 離線功能註冊失敗：', err));
  });
}
