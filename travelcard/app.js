(()=>{'use strict';
const KEY='my_quote_cards_v1';const $=id=>document.getElementById(id);
let state={tags:[],cards:[]},filter='all',editing=null,locked=false;
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};

function normalize(raw){
 if(!raw||!Array.isArray(raw.cards)||!Array.isArray(raw.tags))throw Error('備份格式不正確');
 const tags=[];
 for(const t of raw.tags){if(typeof t==='string'&&t.trim()&&!tags.includes(t.trim()))tags.push(t.trim())}
 const cards=raw.cards.filter(c=>c&&typeof c==='object').map(c=>({
  id:String(c.id||uid()),title:String(c.title||'未命名'),body:String(c.body||''),source:String(c.source||''),
  tags:Array.isArray(c.tags)?[...new Set(c.tags.filter(t=>tags.includes(t)))]:[]
 }));
 return {tags,cards};
}

// 修正 1、2：儲存失敗要告知；原始資料讀取失敗且無法另存備份時，禁止覆蓋。
function save(){
 if(locked){alert('原始資料讀取失敗，而且無法另存備份。為避免覆蓋舊資料，已暫停儲存。\n請不要新增資料，並從瀏覽器開發者工具的 localStorage 取出「'+KEY+'」自行保存。');return false}
 try{localStorage.setItem(KEY,JSON.stringify(state));return true}
 catch(e){alert('儲存失敗（可能容量已滿或瀏覽器封鎖儲存）：'+e.message+'\n請立刻按 Backup 備份目前內容。');return false}
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

function render(){renderTags();renderCards()}
function renderTags(){
 const root=$('tagFilters');root.replaceChildren();
 const all=make('button','tag-pill'+(filter==='all'?' active':''),'全部 ('+state.cards.length+')');
 all.onclick=()=>{filter='all';render()};root.append(all);
 state.tags.forEach(t=>{
  const count=state.cards.filter(c=>c.tags.includes(t)).length;
  const b=make('button','tag-pill'+(filter===t?' active':''),t+' ('+count+')');
  b.onclick=()=>{filter=t;render()};root.append(b);
 });
 $('tagCount').textContent='· '+state.tags.length+' 個分類';renderTagManager();
}
function renderTagManager(){
 const root=$('tagManageList');root.replaceChildren();
 state.tags.forEach(t=>{
  const row=make('div','tag-manage-row');row.append(make('span','',t));
  const rename=make('button','secondary','重新命名'),del=make('button','secondary','刪除');
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

// 僅允許常見排版標籤與安全連結；不允許事件屬性、script 或外部嵌入。
const allowedTags=new Set(['A','B','STRONG','I','EM','U','S','BR','P','DIV','SPAN','UL','OL','LI','BLOCKQUOTE','H2','H3','H4','HR','CODE','PRE','SMALL','SUB','SUP']);
// 內容中是否真的含有允許的 HTML 標籤；沒有就當純文字，避免 <name>、&amp; 被吃掉。
const HTML_LIKE=/<\/?(a|b|strong|i|em|u|s|br|p|div|span|ul|ol|li|blockquote|h[2-4]|hr|code|pre|small|sub|sup)\b[^>]*>/i;
// 含區塊標籤時改用一般換行，避免標籤間的換行字元被 pre-wrap 顯示成多餘空行。
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
 // 只針對非超連結文字節點自動轉網址，並去掉網址結尾的標點。
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

function renderCards(){
 const root=$('cardContainer');root.replaceChildren();
 const cards=state.cards.filter(c=>filter==='all'||c.tags.includes(filter));
 if(!cards.length){root.append(make('div','empty muted',filter==='all'?'還沒有語錄，按 + Add 開始收藏。':'這個 TAG 目前沒有卡片。'));return}
 cards.forEach(c=>{
  const card=make('article','quote-card');
  const toolbar=make('div','card-toolbar'),edit=make('button','small-btn','📝 Edit'),del=make('button','small-btn danger','🗑 Delete');
  edit.onclick=()=>openEditor(c.id);
  del.onclick=()=>{
   if(!confirm('確定刪除「'+c.title+'」？刪除後無法復原。'))return;
   state.cards=state.cards.filter(x=>x.id!==c.id);save();render();
  };
  toolbar.append(edit,del);
  const body=make('div','card-body'+(HTML_LIKE.test(c.body)&&BLOCK_HTML.test(c.body)?' html-mode':''));
  body.append(safeHTML(c.body));
  card.append(toolbar,make('div','card-title',c.title),body);
  const tags=make('div','card-tags');c.tags.forEach(t=>tags.append(make('span','card-tag','#'+t)));card.append(tags);
  if(c.source)card.append(make('div','card-source','來源／備註：'+c.source));
  root.append(card);
 });
}

function openEditor(id=null){
 editing=id;const c=state.cards.find(x=>x.id===id);
 $('dialogTitle').textContent=c?'編輯語錄':'新增語錄';
 $('cardTitle').value=c?.title||'';$('cardBody').value=c?.body||'';$('cardSource').value=c?.source||'';
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
 const title=$('cardTitle').value.trim(),body=$('cardBody').value.trim();if(!title||!body)return;
 const tags=[...$('editTags').querySelectorAll('input:checked')].map(x=>x.value);
 const data={title,body,source:$('cardSource').value.trim(),tags};
 if(editing){const c=state.cards.find(x=>x.id===editing);if(c)Object.assign(c,data)}
 else state.cards.unshift({id:uid(),...data});
 save();$('cardDialog').close();render();
};
$('cancelDialog').onclick=()=>$('cardDialog').close();
$('addCardBtn').onclick=()=>openEditor();
$('manageBtn').onclick=()=>{$('tagManager').hidden=!$('tagManager').hidden};
$('closeTagManager').onclick=()=>{$('tagManager').hidden=true};
document.addEventListener('pointerdown',e=>{const panel=$('tagManager');if(!panel.hidden&&!panel.contains(e.target)&&!$('manageBtn').contains(e.target))panel.hidden=true});

function addTag(){
 const name=$('newTag').value.trim();if(!name)return;
 if(state.tags.includes(name)){alert('TAG 已存在');return}
 state.tags.push(name);$('newTag').value='';save();render();
}
$('createTag').onclick=addTag;$('newTag').onkeydown=e=>{if(e.key==='Enter')addTag()};

// 直接下載 .txt 檔（內容是 JSON，之後用 Load 匯入）
$('exportBtn').onclick=()=>{
 const data=JSON.stringify({format:'QuoteCard',version:1,exportedAt:new Date().toISOString(),...state},null,2);
 const name='QuoteCard_Backup_'+new Date().toISOString().slice(0,10)+'.txt';
 const blob=new Blob([data],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
};

$('importFile').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  const raw=JSON.parse(await file.text());const next=normalize(raw);
  if(!confirm('確定要覆蓋舊檔案嗎？'))return;
  const prev=state,prevFilter=filter;
  state=next;filter='all';
  if(!save()){state=prev;filter=prevFilter;render();return}
  render();alert('匯入完成');
 }catch(err){alert('匯入失敗：請選擇 Quote Card 匯出的 TXT/JSON 備份。\n'+err.message)}
};
// 暗色模式：選擇存在獨立的 key，不影響語錄資料與備份；未選擇過時跟隨系統。
const THEME_KEY='quote_cards_theme',themeBtn=$('themeBtn');
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

// Quote Card 專用 PWA：僅註冊 quotecard/ 內的 Service Worker。
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch(err => console.warn('Quote Card 離線功能註冊失敗：', err));
  });
}
