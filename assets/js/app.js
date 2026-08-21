(()=>{'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const en=s=>String(s??'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٫/g,'.').replace(/٪/g,'%').replace(/،/g,',');
const num=v=>{const m=en(v).match(/[+-]?\d+(?:\.\d+)?/);return m?Number(m[0]):0}; const clamp=v=>Math.max(0,Math.min(100,num(v))); const fmt=v=>(Math.round(Number(v||0)*10)/10).toFixed(1).replace(/\.0$/,'')+'%';
let currentFile=null, currentImageData='', ocrText='', subjects=[];
function domainTemplate(grade,name){
 if(name==='القراءة') return ['استيعاب المقروء','دلالات الألفاظ'];
 if(name==='العلوم') return ['علوم الحياة','العلوم الفيزيائية','علوم الأرض والفضاء'];
 if(name==='الرياضيات'){
   if(grade==='g3') return ['الأعداد والعمليات','الهندسة والقياس','الجبر'];
   return ['الهندسة والقياس','الجبر','البيانات والاحتمالات','الأعداد والعمليات'];
 }
 return ['المجال الأول','المجال الثاني'];
}
function setStatus(text,type=''){const x=$('#readStatus');x.textContent=text;x.className='status '+type}
function setProgress(p){$('#progressBar').style.width=Math.max(0,Math.min(100,p))+'%'}
function show(id){$(id).classList.remove('hidden')}
function gradeLabel(v){return({g3:'الثالث الابتدائي',g6:'السادس الابتدائي',g9:'الثالث المتوسط'})[v]||v}
function defaultSubjectsForGrade(g){return g==='g3'?['الرياضيات','القراءة']:['الرياضيات','العلوم','القراءة']}
function makeSubject(name='الرياضيات',data={}){const grade=$('#grade')?.value||'g3';return{id:crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2),name,veryLow:data.veryLow??'',low:data.low??'',medium:data.medium??'',high:data.high??'',schoolAvg:data.schoolAvg??'',adminAvg:data.adminAvg??'',kingdomAvg:data.kingdomAvg??'',mastery:data.mastery??'',target:data.target??'',target2030:data.target2030??'',domains:(data.domains||domainTemplate(grade,name)).map(d=>typeof d==='string'?{name:d,value:'',benchmark:''}:d)}}
function renderSubjects(){const box=$('#subjects');box.innerHTML=subjects.map((s,si)=>`<article class="subject" data-si="${si}"><div class="subjectTop"><h4>${esc(s.name)}</h4><div class="btns"><button class="btn ghost subChange" type="button">تغيير المادة</button><button class="btn danger subDelete" type="button">حذف</button></div></div><div class="fields"><div class="field"><label>منخفض جدًا %</label><input data-k="veryLow" value="${s.veryLow}"></div><div class="field"><label>منخفض %</label><input data-k="low" value="${s.low}"></div><div class="field"><label>متوسط %</label><input data-k="medium" value="${s.medium}"></div><div class="field"><label>مرتفع %</label><input data-k="high" value="${s.high}"></div><div class="field"><label>متوسط المدرسة</label><input data-k="schoolAvg" value="${s.schoolAvg}"></div><div class="field"><label>متوسط إدارة التعليم</label><input data-k="adminAvg" value="${s.adminAvg}"></div><div class="field"><label>متوسط المملكة</label><input data-k="kingdomAvg" value="${s.kingdomAvg}"></div><div class="field"><label>نسبة اجتياز الحد الأدنى</label><input data-k="mastery" value="${s.mastery}"></div><div class="field"><label>المستهدف الحالي</label><input data-k="target" value="${s.target}"></div><div class="field"><label>المستهدف طويل المدى</label><input data-k="target2030" value="${s.target2030}"></div></div><div class="subjectTop" style="margin-top:15px"><h4 style="font-size:15px">المجالات الفرعية</h4><button class="btn secondary addDomain" type="button">＋ مجال</button></div><div class="domainRows">${s.domains.map((d,di)=>`<div class="domainRow" data-di="${di}"><div class="field"><label>اسم المجال</label><input data-dk="name" value="${esc(d.name)}"></div><div class="field"><label>المدرسة %</label><input data-dk="value" value="${d.value}"></div><div class="field"><label>المقارنة %</label><input data-dk="benchmark" value="${d.benchmark||''}"></div><button class="btn danger delDomain" type="button">×</button></div>`).join('')}</div></article>`).join('');
 box.querySelectorAll('.subject').forEach(el=>{const si=+el.dataset.si;el.querySelectorAll('[data-k]').forEach(inp=>inp.oninput=()=>subjects[si][inp.dataset.k]=inp.value===''?'':num(inp.value));el.querySelector('.subDelete').onclick=()=>{subjects.splice(si,1);renderSubjects()};el.querySelector('.subChange').onclick=()=>{const n=prompt('اسم المادة: الرياضيات / القراءة / العلوم',subjects[si].name);if(!n)return;subjects[si].name=n;subjects[si].domains=domainTemplate($('#grade').value,n).map(x=>({name:x,value:'',benchmark:''}));renderSubjects()};el.querySelector('.addDomain').onclick=()=>{subjects[si].domains.push({name:'مجال جديد',value:'',benchmark:''});renderSubjects()};el.querySelectorAll('.domainRow').forEach(row=>{const di=+row.dataset.di;row.querySelectorAll('[data-dk]').forEach(inp=>inp.oninput=()=>subjects[si].domains[di][inp.dataset.dk]=inp.dataset.dk==='name'?inp.value:(inp.value===''?'':num(inp.value)));row.querySelector('.delDomain').onclick=()=>{subjects[si].domains.splice(di,1);renderSubjects()}})});
}
function initSubjects(){subjects=defaultSubjectsForGrade($('#grade').value).map(n=>makeSubject(n,{domains:domainTemplate($('#grade').value,n)}));renderSubjects()}
function mostLikelyYear(text){const ys=[...en(text).matchAll(/20(?:2\d|3\d)/g)].map(m=>m[0]);if(!ys.length)return'2026';const f={};ys.forEach(y=>f[y]=(f[y]||0)+1);return Object.entries(f).sort((a,b)=>b[1]-a[1])[0][0]}
function parseHeader(text){const t=en(text);const lines=t.split(/\n+/).map(x=>x.trim()).filter(Boolean);let school=lines.find(x=>/الابتدائية|المتوسطة|الثانوية/.test(x)&&!/(المرحلة|الصف)/.test(x))||'';let region=lines.find(x=>/الإدارة العامة للتعليم|إدارة التعليم/.test(x))||'';let grade=/السادس/.test(t)?'g6':/الثالث\s*المتوسط|الصف\s*الثالث\s*المتوسط/.test(t)?'g9':'g3';let gender=/بنين/.test(t)?'بنين':'بنات';const year=mostLikelyYear(t);const nums=[...t.matchAll(/\b(\d{1,3})\b/g)].map(m=>+m[1]).filter(x=>x>=5&&x<=250);let total='',tested='';if(nums.length){const uniq=[...new Set(nums)].sort((a,b)=>b-a);total=uniq[0]||'';tested=uniq.find(x=>x<total)||''}return{school,region,grade,gender,year,total,tested}}
function applyHeader(p){$('#school').value=p.school;$('#region').value=p.region;$('#grade').value=p.grade;$('#gender').value=p.gender;$('#year').value=p.year;$('#totalStudents').value=p.total;$('#testedStudents').value=p.tested;$('#stage').value=p.grade==='g9'?'المرحلة المتوسطة':'المرحلة الابتدائية';subjects=defaultSubjectsForGrade(p.grade).map(n=>makeSubject(n,{domains:domainTemplate(p.grade,n)}));}
async function renderPdf(file){if(!window.pdfjsLib)throw new Error('تعذر تحميل مكتبة PDF. تأكدي من الاتصال بالإنترنت.');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';const data=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data}).promise;const page=await pdf.getPage(1);const vp=page.getViewport({scale:3.1});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;return c}
async function renderImage(file){return new Promise((res,rej)=>{const rd=new FileReader();rd.onload=()=>{const img=new Image();img.onload=()=>{const max=3600,scale=Math.min(1,max/img.width);const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);res(c)};img.onerror=rej;img.src=rd.result};rd.onerror=rej;rd.readAsDataURL(file)})}
function columnsFor(grade,W){return grade==='g3'?[{name:'القراءة',x0:.005*W,x1:.495*W},{name:'الرياضيات',x0:.505*W,x1:.995*W}]:[{name:'القراءة',x0:.005*W,x1:.328*W},{name:'العلوم',x0:.334*W,x1:.667*W},{name:'الرياضيات',x0:.672*W,x1:.995*W}]}
function matchColor(kind,r,g,b){if(kind==='red')return r>150&&g<75&&b<105;if(kind==='orange')return r>165&&r<245&&g>65&&g<170&&b<100;if(kind==='medium')return r>85&&r<200&&g>145&&g<240&&b>80&&b<215;if(kind==='high')return r<125&&g>95&&g<205&&b<180;if(kind==='purple')return r>50&&r<160&&g>30&&g<145&&b>100&&b<225;if(kind==='blue')return r>10&&r<135&&g>95&&g<225&&b>125&&b<250;if(kind==='gray')return r>120&&r<238&&g>120&&g<238&&b>120&&b<238&&Math.max(r,g,b)-Math.min(r,g,b)<32;if(kind==='green')return r<105&&g>95&&g<205&&b<155;return false}
function colorComponents(canvas,rect,kind){const x0=Math.max(0,Math.floor(rect.x)),y0=Math.max(0,Math.floor(rect.y)),w=Math.max(1,Math.floor(rect.w)),h=Math.max(1,Math.floor(rect.h));const id=canvas.getContext('2d').getImageData(x0,y0,w,h),d=id.data,n=w*h,mask=new Uint8Array(n);for(let i=0,p=0;i<n;i++,p+=4)if(matchColor(kind,d[p],d[p+1],d[p+2]))mask[i]=1;const q=new Int32Array(n),out=[];for(let i=0;i<n;i++){if(!mask[i])continue;let head=0,tail=0;q[tail++]=i;mask[i]=0;let minx=w,miny=h,maxx=0,maxy=0,area=0;while(head<tail){const z=q[head++],yy=(z/w)|0,xx=z-yy*w;area++;if(xx<minx)minx=xx;if(xx>maxx)maxx=xx;if(yy<miny)miny=yy;if(yy>maxy)maxy=yy;const l=z-1,r=z+1,u=z-w,dd=z+w;if(xx>0&&mask[l]){mask[l]=0;q[tail++]=l}if(xx<w-1&&mask[r]){mask[r]=0;q[tail++]=r}if(yy>0&&mask[u]){mask[u]=0;q[tail++]=u}if(yy<h-1&&mask[dd]){mask[dd]=0;q[tail++]=dd}}if(area>15)out.push({x:x0+minx,y:y0+miny,w:maxx-minx+1,h:maxy-miny+1,area})}return out}
function makeCrop(canvas,b,scale=6,invert=false,threshold=false){const x=Math.max(0,Math.floor(b.x)),y=Math.max(0,Math.floor(b.y)),w=Math.max(2,Math.floor(b.w)),h=Math.max(2,Math.floor(b.h)),c=document.createElement('canvas');c.width=Math.max(40,Math.round(w*scale));c.height=Math.max(30,Math.round(h*scale));const cx=c.getContext('2d');cx.drawImage(canvas,x,y,w,h,0,0,c.width,c.height);const id=cx.getImageData(0,0,c.width,c.height),d=id.data;for(let i=0;i<d.length;i+=4){let g=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);if(threshold)g=g<225?0:255;if(invert)g=255-g;d[i]=d[i+1]=d[i+2]=g}cx.putImageData(id,0,0);return c}
function parseNumberText(text){const t=en(text).replace(/\s+/g,'');const m=t.match(/[+\-]?\d+(?:\.\d+)?/);return m?Number(m[0]):null}
function normalizedNumber(v,hint=null){if(v==null||!isFinite(v))return null;let c=[v];if(v>100)c.push(v/10,v/100);if(hint!=null){c=c.filter(x=>x>=0&&x<=100);if(!c.length)return null;return c.sort((a,b)=>Math.abs(a-hint)-Math.abs(b-hint))[0]}return c.find(x=>x>=0&&x<=100)??null}
async function ocrNumeric(worker,canvas,b,hint=null,mode='label'){const pad=mode==='domain'?8:4,bb={x:b.x-pad,y:b.y-pad,w:b.w+pad*2,h:b.h+pad*2};for(const variant of [{inv:false,thr:false},{inv:true,thr:false},{inv:false,thr:true}]){const crop=makeCrop(canvas,bb,mode==='domain'?9:7,variant.inv,variant.thr);await worker.setParameters({tessedit_char_whitelist:'0123456789.%+-',tessedit_pageseg_mode:mode==='domain'?'10':'7'});const rr=await worker.recognize(crop);const raw=parseNumberText(rr.data.text||'');const v=normalizedNumber(raw,hint);if(v!=null&&(hint==null||Math.abs(v-hint)<=1.2))return Math.round(v*100)/100}return hint==null?null:Math.round(hint*10)/10}
async function ocrArabicHeader(worker,canvas){const c=makeCrop(canvas,{x:canvas.width*.37,y:canvas.height*.025,w:canvas.width*.62,h:canvas.height*.12},2,false,false);await worker.setParameters({tessedit_char_whitelist:'',tessedit_pageseg_mode:'6'});const r=await worker.recognize(c);return r.data.text||''}
function chooseLabelComponent(cs,W,H,grade,side='current'){let a=cs.filter(c=>c.w>W*.014&&c.w<W*.07&&c.h>H*.005&&c.h<H*.022&&c.area>80);if(!a.length)return null;a.sort((p,q)=>p.x-q.x);return grade==='g3'?a.sort((p,q)=>q.area-p.area)[0]:a[0]}
function levelValues(canvas,col){const H=canvas.height,W=canvas.width,rect={x:col.x0,y:H*.268,w:col.x1-col.x0,h:H*.045},kinds=['red','orange','medium','high'],comps={};for(const k of kinds){const cs=colorComponents(canvas,rect,k).filter(c=>c.area>300);comps[k]=cs.sort((a,b)=>b.area-a.area)[0]||null}const widths=kinds.map(k=>comps[k]?.w||0),sum=widths.reduce((a,b)=>a+b,0);if(!sum)return null;let vals=widths.map(x=>Math.round(x/sum*1000)/10);let diff=Math.round((100-vals.reduce((a,b)=>a+b,0))*10)/10;vals[vals.indexOf(Math.max(...vals))]=Math.round((vals[vals.indexOf(Math.max(...vals))]+diff)*10)/10;return{veryLow:vals[0],low:vals[1],medium:vals[2],high:vals[3]}}
async function extractAverages(worker,canvas,col,grade){const W=canvas.width,H=canvas.height,rect={x:col.x0,y:H*.32,w:col.x1-col.x0,h:H*.18},map={purple:'schoolAvg',gray:'adminAvg',blue:'kingdomAvg'},out={};for(const [kind,key] of Object.entries(map)){const comp=chooseLabelComponent(colorComponents(canvas,rect,kind).filter(c=>c.y>H*.36&&c.y<H*.47),W,H,grade);if(comp){const v=await ocrNumeric(worker,canvas,comp,null,'label');if(v!=null&&v>20)out[key]=v}}return out}
async function extractMastery(worker,canvas,col,grade){const W=canvas.width,H=canvas.height,rect={x:col.x0,y:H*.515,w:col.x1-col.x0,h:H*.18},out={};const p=chooseLabelComponent(colorComponents(canvas,rect,'purple'),W,H,grade);if(p){const v=await ocrNumeric(worker,canvas,p,null,'label');if(v!=null)out.mastery=v}const greens=colorComponents(canvas,rect,'green').filter(c=>c.w>W*.012&&c.h>H*.004&&c.area>60&&c.x>col.x0+(col.x1-col.x0)*.18);const vals=[];for(const c of greens){const v=await ocrNumeric(worker,canvas,c,null,'label');if(v!=null&&v>5&&v<=100)vals.push({v,x:c.x,y:c.y})}const uniq=[];for(const z of vals){if(!uniq.some(q=>Math.abs(q.v-z.v)<.2))uniq.push(z)}if(uniq.length){uniq.sort((a,b)=>a.v-b.v);out.target=uniq[0].v;out.target2030=uniq[uniq.length-1].v}return out}
async function extractDomains(worker,canvas,col,grade,name){const W=canvas.width,H=canvas.height,rect={x:col.x0,y:H*.71,w:col.x1-col.x0,h:H*.19};let bars=colorComponents(canvas,rect,'purple').filter(c=>c.area>700&&c.w>(col.x1-col.x0)*.10&&c.h>H*.018&&c.h<H*.16);bars.sort((a,b)=>a.x-b.x);const names=domainTemplate(grade,name),vals=[];if(bars.length>names.length)bars=bars.sort((a,b)=>b.area-a.area).slice(0,names.length).sort((a,b)=>a.x-b.x);for(let i=0;i<Math.min(bars.length,names.length);i++){const b=bars[i],label={x:b.x-b.w*.25,y:b.y-H*.023,w:b.w*1.5,h:H*.023};const v=await ocrNumeric(worker,canvas,label,null,'domain');vals.push({name:names[i],value:v??'',benchmark:''})}while(vals.length<names.length)vals.push({name:names[vals.length],value:'',benchmark:''});return vals}
async function readChange(worker,canvas){const H=canvas.height,W=canvas.width,b={x:W*.38,y:H*.025,w:W*.18,h:H*.045};const c=makeCrop(canvas,b,5,false,false);await worker.setParameters({tessedit_char_whitelist:'0123456789.%+-',tessedit_pageseg_mode:'11'});const r=await worker.recognize(c);const t=en(r.data.text||'').replace(/\s+/g,'');const m=t.match(/[+\-]?\d+(?:\.\d+)?/);if(!m)return'';let v=Number(m[0]);if(v>100)v/=10;return isFinite(v)?v:''}
async function smartExtract(canvas){if(!window.Tesseract)throw new Error('تعذر تحميل محرك القراءة الضوئية OCR.');setStatus('تهيئة محرك القراءة الموجهة…','warn');const worker=await Tesseract.createWorker(['ara','eng'],1,{logger:m=>{if(m.status==='recognizing text'&&m.progress)setProgress(18+Math.round(m.progress*20))}});try{setProgress(12);const header=await ocrArabicHeader(worker,canvas);ocrText=header;$('#rawOcr').textContent=header||'لم يُستخرج نص من رأس البطاقة.';const p=parseHeader(header);applyHeader(p);$('#change').value=await readChange(worker,canvas);const cols=columnsFor(p.grade,canvas.width);let completed=0,total=cols.length*4;for(const col of cols){const s=subjects.find(x=>x.name===col.name);if(!s)continue;setStatus(`قراءة ${col.name}: مستويات الأداء…`,'warn');Object.assign(s,levelValues(canvas,col)||{});completed++;setProgress(38+Math.round(completed/total*55));setStatus(`قراءة ${col.name}: المتوسطات…`,'warn');Object.assign(s,await extractAverages(worker,canvas,col,p.grade));completed++;setProgress(38+Math.round(completed/total*55));setStatus(`قراءة ${col.name}: الإتقان والمستهدفات…`,'warn');Object.assign(s,await extractMastery(worker,canvas,col,p.grade));completed++;setProgress(38+Math.round(completed/total*55));setStatus(`قراءة ${col.name}: المجالات الفرعية…`,'warn');s.domains=await extractDomains(worker,canvas,col,p.grade,col.name);completed++;setProgress(38+Math.round(completed/total*55))}renderSubjects();return p}finally{await worker.terminate()}}
async function readCurrent(){if(!currentFile)return;try{setProgress(3);setStatus('جاري تجهيز الصفحة…');const canvas=currentFile.type==='application/pdf'||/\.pdf$/i.test(currentFile.name)?await renderPdf(currentFile):await renderImage(currentFile);const prev=$('#preview');prev.innerHTML='';const display=canvas.cloneNode();display.width=canvas.width;display.height=canvas.height;display.getContext('2d').drawImage(canvas,0,0);prev.appendChild(display);currentImageData=canvas.toDataURL('image/png');setProgress(10);await smartExtract(canvas);setProgress(100);const d=capture(),filled=d.subjects.reduce((n,s)=>n+['veryLow','low','medium','high','schoolAvg','adminAvg','kingdomAvg','mastery','target','target2030'].filter(k=>s[k]!==''&&s[k]!=null).length+s.domains.filter(x=>x.value!==''&&x.value!=null).length,0);setStatus(`✅ اكتملت التعبئة الموجهة: تم ملء ${filled} قيمة تلقائيًا. راجعي القيم قبل الاعتماد.`,'good');show('#editSection');setTimeout(()=>$('#editSection').scrollIntoView({behavior:'smooth'}),150)}catch(e){console.error(e);setProgress(0);setStatus('تعذر إكمال القراءة التلقائية: '+e.message+' يمكنك إعادة القراءة أو تصحيح الحقول يدويًا.','warn');show('#editSection');if(!subjects.length)initSubjects()}}

/* ===== قارئ القالب الموجّه - الإصدار ٣ ===== */
const isMissing=v=>v===''||v===null||v===undefined||Number.isNaN(Number(v));
const fmtMaybe=(v,percent=true)=>isMissing(v)?'—':((Math.round(Number(v)*100)/100).toString()+(percent?'%':''));
const scoreFmt=v=>isMissing(v)?'—':(Math.round(Number(v)*100)/100).toString();
function cleanArabicOCR(s){return String(s||'').replace(/[A-Za-z]{1,8}/g,' ').replace(/[|_]+/g,' ').replace(/\s+/g,' ').trim()}
async function ocrRegionV3(worker,canvas,b,psm='6',whitelist=''){
  const crop=makeCrop(canvas,b,3.2,false,false);
  await worker.setParameters({tessedit_char_whitelist:whitelist,tessedit_pageseg_mode:psm});
  const r=await worker.recognize(crop); return r.data.text||'';
}
async function ocrPercentV3(worker,canvas,b,hint=null,mode='label'){
  const pad=mode==='domain'?10:5,bb={x:b.x-pad,y:b.y-pad,w:b.w+pad*2,h:b.h+pad*2};
  const vars=[{inv:false,thr:false},{inv:true,thr:false},{inv:false,thr:true},{inv:true,thr:true}];
  for(const variant of vars){
    const crop=makeCrop(canvas,bb,mode==='domain'?10:8,variant.inv,variant.thr);
    await worker.setParameters({tessedit_char_whitelist:'0123456789.%+-',tessedit_pageseg_mode:mode==='domain'?'7':'7'});
    const rr=await worker.recognize(crop); let raw=parseNumberText(rr.data.text||'');
    if(raw==null||!isFinite(raw))continue;
    let cand=[raw];
    if(raw>100&&raw<1000)cand.push(raw/10);
    if(raw>=1000)cand.push(raw/100);
    cand=cand.filter(x=>x>=0&&x<=100);
    if(!cand.length)continue;
    const v=hint==null?cand[0]:cand.sort((a,b)=>Math.abs(a-hint)-Math.abs(b-hint))[0];
    if(hint==null||Math.abs(v-hint)<=6)return Math.round(v*100)/100;
  }
  return null;
}
function solidCandidates(cs,cw,H){return cs.filter(c=>c.area>80&&c.w>cw*.035&&c.w<cw*.28&&c.h>H*.004&&c.h<H*.035&&(c.area/(c.w*c.h))>.42)}
async function parseHeaderV3(worker,canvas){
  const W=canvas.width,H=canvas.height;
  const schoolRaw=await ocrRegionV3(worker,canvas,{x:W*.64,y:H*.025,w:W*.35,h:H*.06},'6','');
  const regionRaw=await ocrRegionV3(worker,canvas,{x:W*.60,y:H*.065,w:W*.39,h:H*.075},'6','');
  const metaRaw=await ocrRegionV3(worker,canvas,{x:W*.37,y:H*.075,w:W*.62,h:H*.095},'6','');
  const all=[schoolRaw,regionRaw,metaRaw].join('\n');
  const base=parseHeader(all);
  let sl=schoolRaw.split(/\n+/).map(cleanArabicOCR).find(x=>/الابتدائية|المتوسطة|الثانوية/.test(x)&&!/(المرحلة|الصف)/.test(x));
  if(sl)base.school=sl.replace(/^المدرسة\s*/,'').trim();
  let rl=regionRaw.split(/\n+/).map(cleanArabicOCR).find(x=>/الإدارة العامة للتعليم|إدارة التعليم/.test(x));
  if(rl)base.region=rl.split(/حكومي|أهلي|عالمي/)[0].trim();
  const t=en(all);
  base.grade=/السادس/.test(t)?'g6':(/الثالث\s*المتوسط|الصف\s*الثالث\s*المتوسط/.test(t)?'g9':'g3');
  base.gender=/بنين/.test(t)?'بنين':'بنات';
  base.year=mostLikelyYear(t);
  const labelledTotal=t.match(/(?:عدد\s*الطلبة|الطلبة\s*الإجمالي)[^0-9]{0,30}(\d{1,3})/);
  const labelledTested=t.match(/(?:المختبرون|المختبرين)[^0-9]{0,30}(\d{1,3})/);
  if(labelledTotal)base.total=+labelledTotal[1];
  if(labelledTested)base.tested=+labelledTested[1];
  base.schoolType=/أهلي/.test(t)?'أهلي':/عالمي/.test(t)?'عالمي':'حكومي';
  base.stage=base.grade==='g9'?'المرحلة المتوسطة':'المرحلة الابتدائية';
  base._raw=all; return base;
}
function applyHeaderV3(p){applyHeader(p);$('#schoolType').value=p.schoolType||'حكومي';$('#stage').value=p.stage||($('#grade').value==='g9'?'المرحلة المتوسطة':'المرحلة الابتدائية')}
async function readChangeV3(worker,canvas){
  const W=canvas.width,H=canvas.height;
  const txt=await ocrRegionV3(worker,canvas,{x:W*.36,y:H*.025,w:W*.24,h:H*.06},'7','0123456789.%+-');
  const t=en(txt).replace(/\s+/g,''); const m=t.match(/[+\-]?\d+(?:\.\d+)?/); if(!m)return'';
  let v=Number(m[0]); if(!isFinite(v))return''; if(Math.abs(v)>100)return''; return v;
}
async function extractLevelsV3(worker,canvas,col){
  const H=canvas.height,cw=col.x1-col.x0,rect={x:col.x0,y:H*.265,w:cw,h:H*.05},kinds=['red','orange','medium','high'];
  const comps=kinds.map(k=>colorComponents(canvas,rect,k).filter(c=>c.area>250&&c.w>cw*.04&&c.h>H*.008).sort((a,b)=>b.area-a.area)[0]||null);
  const widths=comps.map(c=>c?.w||0),sum=widths.reduce((a,b)=>a+b,0); if(!sum)return{};
  const hints=widths.map(x=>x/sum*100); const vals=[];
  for(let i=0;i<comps.length;i++) vals.push(comps[i]?await ocrPercentV3(worker,canvas,comps[i],hints[i],'label'):null);
  let out=vals.map((v,i)=>v==null?Math.round(hints[i]*10)/10:v);
  const total=out.reduce((a,b)=>a+b,0);
  if(Math.abs(total-100)>1.2) out=hints.map(x=>Math.round(x*10)/10);
  let diff=Math.round((100-out.reduce((a,b)=>a+b,0))*10)/10; const mi=out.indexOf(Math.max(...out)); out[mi]=Math.round((out[mi]+diff)*10)/10;
  return{veryLow:out[0],low:out[1],medium:out[2],high:out[3]};
}
async function extractAveragesV3(worker,canvas,col){
  const H=canvas.height,cw=col.x1-col.x0,rect={x:col.x0,y:H*.335,w:cw,h:H*.15},map={purple:'schoolAvg',gray:'adminAvg',blue:'kingdomAvg'},out={};
  for(const [kind,key] of Object.entries(map)){
    let cs=solidCandidates(colorComponents(canvas,rect,kind),cw,H).filter(c=>c.y>H*.35&&c.y<H*.435&&c.h>H*.006);
    if(!cs.length)continue; cs.sort((a,b)=>a.x-b.x); const c=cs[0]; const v=await ocrPercentV3(worker,canvas,c,null,'label'); if(v!=null&&v>=20)out[key]=v;
  }
  return out;
}
async function extractMasteryV3(worker,canvas,col){
  const H=canvas.height,cw=col.x1-col.x0,rect={x:col.x0,y:H*.505,w:cw,h:H*.205},out={};
  let pur=solidCandidates(colorComponents(canvas,rect,'purple'),cw,H).filter(c=>c.y>H*.54&&c.y<H*.67);
  if(pur.length){pur.sort((a,b)=>a.x-b.x);const v=await ocrPercentV3(worker,canvas,pur[0],null,'label');if(v!=null)out.mastery=v}
  let greens=solidCandidates(colorComponents(canvas,rect,'green'),cw,H).filter(c=>c.x>col.x0+cw*.18&&c.x<col.x0+cw*.60&&c.y>H*.52&&c.y<H*.68);
  const got=[]; for(const c of greens){const v=await ocrPercentV3(worker,canvas,c,null,'label');if(v!=null&&v<=100)got.push({v,y:c.y})}
  if(got.length){got.sort((a,b)=>a.y-b.y);out.target2030=got[0].v;out.target=got[got.length-1].v}
  return out;
}
function groupDomainBarsV3(canvas,col){
  const H=canvas.height,cw=col.x1-col.x0,rect={x:col.x0,y:H*.755,w:cw,h:H*.13};
  let cs=colorComponents(canvas,rect,'purple').filter(c=>c.area>80&&c.w>cw*.018&&c.h>H*.0035&&c.y<H*.878&&(c.area/(c.w*c.h))>.30);
  const gs=[]; for(const c of cs.sort((a,b)=>(a.x+a.w/2)-(b.x+b.w/2))){const cx=c.x+c.w/2;let g=gs.find(q=>Math.abs(cx-q.cx)<cw*.05);if(!g){g={parts:[],cx};gs.push(g)}g.parts.push(c);const xs=g.parts.map(p=>p.x),x2=g.parts.map(p=>p.x+p.w),ys=g.parts.map(p=>p.y),y2=g.parts.map(p=>p.y+p.h);g.x=Math.min(...xs);g.y=Math.min(...ys);g.w=Math.max(...x2)-g.x;g.h=Math.max(...y2)-g.y;g.cx=g.x+g.w/2}
  return gs.filter(g=>g.h>H*.017&&g.w>cw*.03).sort((a,b)=>a.cx-b.cx);
}
async function extractDomainsV3(worker,canvas,col,grade,name){
  const H=canvas.height,cw=col.x1-col.x0,names=domainTemplate(grade,name);let bars=groupDomainBarsV3(canvas,col);
  if(bars.length>names.length)bars=bars.sort((a,b)=>b.h-a.h).slice(0,names.length).sort((a,b)=>a.cx-b.cx);
  const vals=[]; for(let i=0;i<Math.min(bars.length,names.length);i++){
    const b=bars[i],geom=Math.max(0,Math.min(100,(H*.859-b.y)/(H*(.859-.752))*100));
    const label={x:Math.max(col.x0,b.cx-cw*.14),y:Math.max(0,b.y-H*.04),w:Math.min(cw*.28,col.x1-Math.max(col.x0,b.cx-cw*.14)),h:H*.042};
    let v=await ocrPercentV3(worker,canvas,label,geom,'domain'); if(v==null)v=Math.round(geom*2)/2;
    vals.push({name:names[i],value:v,benchmark:''});
  }
  while(vals.length<names.length)vals.push({name:names[vals.length],value:'',benchmark:''}); return vals;
}
async function smartExtract(canvas){
  if(!window.Tesseract)throw new Error('تعذر تحميل محرك القراءة الضوئية OCR.');
  setStatus('تهيئة محرك القراءة الموجهة…','warn');
  const worker=await Tesseract.createWorker(['ara','eng'],1,{logger:m=>{if(m.status==='recognizing text'&&m.progress)setProgress(12+Math.round(m.progress*24))}});
  try{
    setProgress(8);const p=await parseHeaderV3(worker,canvas);ocrText=p._raw||'';$('#rawOcr').textContent=ocrText||'لم يُستخرج نص من رأس البطاقة.';applyHeaderV3(p);
    $('#change').value=await readChangeV3(worker,canvas);
    const cols=columnsFor(p.grade,canvas.width);let completed=0,total=cols.length*4;
    for(const col of cols){const s=subjects.find(x=>x.name===col.name);if(!s)continue;
      setStatus(`قراءة ${col.name}: مستويات الأداء الدقيقة…`,'warn');Object.assign(s,await extractLevelsV3(worker,canvas,col));completed++;setProgress(36+Math.round(completed/total*60));
      setStatus(`قراءة ${col.name}: متوسط المدرسة والمقارنات…`,'warn');Object.assign(s,await extractAveragesV3(worker,canvas,col));completed++;setProgress(36+Math.round(completed/total*60));
      setStatus(`قراءة ${col.name}: الإتقان والمستهدفات…`,'warn');Object.assign(s,await extractMasteryV3(worker,canvas,col));completed++;setProgress(36+Math.round(completed/total*60));
      setStatus(`قراءة ${col.name}: المجالات الفرعية…`,'warn');s.domains=await extractDomainsV3(worker,canvas,col,p.grade,col.name);completed++;setProgress(36+Math.round(completed/total*60));
    }
    renderSubjects();return p;
  }finally{await worker.terminate()}
}
function capture(){return{school:$('#school').value.trim(),region:$('#region').value.trim(),grade:$('#grade').value,year:$('#year').value,total:$('#totalStudents').value.trim()===''?'':num($('#totalStudents').value),tested:$('#testedStudents').value.trim()===''?'':num($('#testedStudents').value),change:$('#change').value.trim()===''?'':num($('#change').value),gender:$('#gender').value,schoolType:$('#schoolType').value,stage:$('#stage').value,subjects:JSON.parse(JSON.stringify(subjects))}}
function analyzeData(d){
 const validation=[],strengths=[],weaknesses=[],recs=[];
 if(d.tested>d.total&&d.total>0)validation.push('عدد المختبرين أكبر من عدد الطلبة الإجمالي - راجعي الرقمين.'); if(!d.tested)validation.push('عدد المختبرين غير مسجل.');
 d.subjects.forEach(s=>{
   const lv=[s.veryLow,s.low,s.medium,s.high]; if(lv.every(v=>!isMissing(v))){const sum=lv.reduce((a,b)=>a+Number(b),0);if(Math.abs(sum-100)>1.2)validation.push(`${s.name}: مجموع مستويات الأداء = ${fmtMaybe(sum)} وليس قريبًا من ١٠٠٪.`);const low=Number(s.veryLow)+Number(s.low),upper=Number(s.medium)+Number(s.high);if(upper>=50)strengths.push(`${s.name}: ${fmtMaybe(upper)} من الطلبة في المستويين المتوسط والمرتفع.`);if(Number(s.high)>=25)strengths.push(`${s.name}: نسبة المستوى المرتفع ${fmtMaybe(s.high)}.`);if(low>=50)weaknesses.push(`${s.name}: ${fmtMaybe(low)} من الطلبة في المستويين المنخفض والمنخفض جدًا؛ أولوية تحسين مرتفعة.`)}
   if(!isMissing(s.mastery)&&!isMissing(s.target)){const gap=Number(s.target)-Number(s.mastery);if(gap>0)weaknesses.push(`${s.name}: اجتياز الحد الأدنى ${fmtMaybe(s.mastery)} أقل من المستهدف ${fmtMaybe(s.target)} بفجوة ${fmtMaybe(gap)}.`);else strengths.push(`${s.name}: تجاوز المستهدف الحالي بمقدار ${fmtMaybe(Math.abs(gap))}.`)}
   const validDomains=s.domains.filter(x=>!isMissing(x.value)); if(validDomains.length){const sorted=[...validDomains].sort((a,b)=>Number(b.value)-Number(a.value));strengths.push(`${s.name}: أقوى مجال «${sorted[0].name}» بنسبة ${fmtMaybe(sorted[0].value)}.`);if(sorted.length>=2){const w=sorted[sorted.length-1];weaknesses.push(`${s.name}: أضعف مجال «${w.name}» بنسبة ${fmtMaybe(w.value)} ويحتاج تدخلًا علاجيًا موجهًا.`);recs.push(`${s.name} - ${w.name}: تشخيص المهارات الأقل إتقانًا، تدريب متدرج وممارسة صفية موجهة، ثم قياس بعدي ومقارنة الأثر.`)}}
   if(!isMissing(s.schoolAvg)&&!isMissing(s.kingdomAvg)){const diff=Number(s.schoolAvg)-Number(s.kingdomAvg);if(diff>=0)strengths.push(`${s.name}: متوسط المدرسة أعلى من متوسط المملكة بمقدار ${scoreFmt(diff)} درجة.`);else weaknesses.push(`${s.name}: متوسط المدرسة أقل من متوسط المملكة بمقدار ${scoreFmt(Math.abs(diff))} درجة.`)}
 });
 if(!isMissing(d.change)&&Number(d.change)>0)strengths.unshift(`الاتجاه العام تحسن بمقدار +${scoreFmt(d.change)} مقارنة بالقياس المرجعي.`); if(!isMissing(d.change)&&Number(d.change)<0)weaknesses.unshift(`الاتجاه العام تراجع بمقدار ${scoreFmt(d.change)}؛ يلزم تحليل أسباب الانخفاض.`);
 if(!recs.length)recs.push('استمرار القياس التكويني، وتحديد المهارات ذات النتائج الأقل، ثم تنفيذ تدخلات موجهة ومقارنة القياس البعدي بالمستهدف.');return{validation,strengths,weaknesses,recs};
}
function countsForSafe(s,tested){if(!tested)return['—','—','—','—'];const vals=[s.high,s.medium,s.low,s.veryLow];if(vals.some(isMissing))return['—','—','—','—'];let counts=vals.map(v=>Math.round(tested*Number(v)/100));let diff=tested-counts.reduce((a,b)=>a+b,0);counts[counts.indexOf(Math.max(...vals.map(Number)))]+=diff;return counts}
function reportSubject(s,d){
 const a=analyzeData({...d,subjects:[s]}),c=countsForSafe(s,d.tested),valid=s.domains.filter(x=>!isMissing(x.value)),sorted=[...valid].sort((x,y)=>Number(y.value)-Number(x.value)),strongest=sorted[0],weakest=sorted.length>=2?sorted[sorted.length-1]:null;
 const masteryGap=(!isMissing(s.mastery)&&!isMissing(s.target))?Number(s.target)-Number(s.mastery):null;
 return `<section class="reportSubject"><h3>${esc(s.name)}</h3><div class="rsBody"><div class="seg"><span class="vl" style="width:${isMissing(s.veryLow)?0:clamp(s.veryLow)}%">${fmtMaybe(s.veryLow)}</span><span class="lo" style="width:${isMissing(s.low)?0:clamp(s.low)}%">${fmtMaybe(s.low)}</span><span class="me" style="width:${isMissing(s.medium)?0:clamp(s.medium)}%">${fmtMaybe(s.medium)}</span><span class="hi" style="width:${isMissing(s.high)?0:clamp(s.high)}%">${fmtMaybe(s.high)}</span></div><div class="miniGrid"><div class="metric"><b>${scoreFmt(s.schoolAvg)}</b><small>متوسط المدرسة</small></div><div class="metric"><b>${fmtMaybe(s.mastery)}</b><small>اجتازوا الحد الأدنى</small></div><div class="metric"><b>${fmtMaybe(s.target)}</b><small>المستهدف الحالي</small></div><div class="metric"><b>${masteryGap==null?'—':(masteryGap>0?fmtMaybe(masteryGap):'متجاوز')}</b><small>الفجوة</small></div></div><div class="rTables" style="margin-top:13px"><table class="levelTable"><tr><th>مستوى الأداء</th><th>النسبة</th><th>العدد التقريبي</th></tr><tr><td class="c1">مرتفع</td><td>${fmtMaybe(s.high)}</td><td>${c[0]}</td></tr><tr><td class="c2">متوسط</td><td>${fmtMaybe(s.medium)}</td><td>${c[1]}</td></tr><tr><td class="c3">منخفض</td><td>${fmtMaybe(s.low)}</td><td>${c[2]}</td></tr><tr><td class="c4">منخفض جدًا</td><td>${fmtMaybe(s.veryLow)}</td><td>${c[3]}</td></tr></table><div class="narrative"><b>تحليل النتائج:</b><br>${strongest?`نقطة القوة الأعلى: ${esc(strongest.name)} (${fmtMaybe(strongest.value)}).<br>`:''}${weakest?`الأولوية العلاجية: ${esc(weakest.name)} (${fmtMaybe(weakest.value)}).<br>`:''}${a.weaknesses.slice(0,2).map(esc).join('<br>')}<br><b>التحسين المقترح:</b> ${esc(a.recs[0]||'متابعة الأداء وقياس الأثر.')}</div></div>${s.domains.length?`<div class="bars" style="margin-top:15px">${s.domains.map(x=>`<div class="barItem"><span>${esc(x.name)}</span><div class="track"><i style="width:${isMissing(x.value)?0:clamp(x.value)}%"></i></div><b>${fmtMaybe(x.value)}</b></div>`).join('')}</div>`:''}</div></section>`;
}
function buildReport(d){const all=analyzeData(d),ch=isMissing(d.change)?'—':(Number(d.change)>0?'+'+scoreFmt(d.change):scoreFmt(d.change));$('#report').innerHTML=`<article class="report"><header class="rHead"><div><small>تحليل نتائج بطاقة نافس</small><h2>${esc(d.school||'المدرسة')}</h2></div><div class="change">${esc(ch)}</div></header><div class="rMeta"><div><small>الصف</small><b>${gradeLabel(d.grade)}</b></div><div><small>العام الدراسي</small><b>${esc(d.year)}</b></div><div><small>عدد الطلبة</small><b>${d.total||'—'}</b></div><div><small>المختبرون</small><b>${d.tested||'—'}</b></div><div><small>الجهة</small><b>${esc(d.region||'—')}</b></div></div><div class="reportSubjects">${d.subjects.map(s=>reportSubject(s,d)).join('')}</div><footer class="rFoot"><b>القراءة العامة:</b> ${(all.strengths.slice(0,3).concat(all.weaknesses.slice(0,3))).map(esc).join(' ')}<br><b>أولويات التحسين:</b> ${all.recs.map(esc).join(' • ')}<br><small class="reportDisclaimer">بطاقة تحليل مدرسية مولدة من البيانات المعتمدة بعد المراجعة. لا تُعد تقريرًا رسميًا صادرًا من هيئة تقويم التعليم والتدريب.</small><div class="reportSignature"><span class="reportLogo brandMark" aria-hidden="true"></span><div><b>أ/ فاطمة هزازي</b><span>ملتقى معلمي ومعلمات الرياضيات · ملتقى التعليم التفاعلي</span></div></div></footer></article>`;show('#reportSection');setTimeout(()=>$('#reportSection').scrollIntoView({behavior:'smooth'}),150)}
/* ===== نهاية تحسينات الإصدار ٣ ===== */
function handleFile(f){if(!f)return;currentFile=f;readCurrent()}
function capture(){return{school:$('#school').value.trim(),region:$('#region').value.trim(),grade:$('#grade').value,year:$('#year').value,total:num($('#totalStudents').value),tested:num($('#testedStudents').value),change:num($('#change').value),gender:$('#gender').value,schoolType:$('#schoolType').value,stage:$('#stage').value,subjects:JSON.parse(JSON.stringify(subjects))}}
function analyzeData(d){const validation=[], strengths=[], weaknesses=[], recs=[];if(d.tested>d.total&&d.total>0)validation.push('عدد المختبرين أكبر من عدد الطلبة الإجمالي - راجعي الرقمين.');if(!d.tested)validation.push('عدد المختبرين غير مسجل.');d.subjects.forEach(s=>{const sum=s.veryLow+s.low+s.medium+s.high;if(Math.abs(sum-100)>1.5)validation.push(`${s.name}: مجموع مستويات الأداء = ${fmt(sum)} وليس قريبًا من ١٠٠٪.`);const low=s.veryLow+s.low, upper=s.medium+s.high;if(upper>=50)strengths.push(`${s.name}: ${fmt(upper)} من الطلبة في المستويين المتوسط والمرتفع.`);if(s.high>=25)strengths.push(`${s.name}: نسبة المستوى المرتفع ${fmt(s.high)}.`);if(low>=50)weaknesses.push(`${s.name}: ${fmt(low)} من الطلبة في المستويين المنخفض والمنخفض جدًا؛ أولوية تحسين مرتفعة.`);if(s.mastery&&s.target&&s.mastery<s.target)weaknesses.push(`${s.name}: اجتياز الحد الأدنى ${fmt(s.mastery)} أقل من المستهدف ${fmt(s.target)} بفجوة ${fmt(s.target-s.mastery)}.`);const sorted=[...s.domains].sort((a,b)=>b.value-a.value);if(sorted[0]&&sorted[0].value)strengths.push(`${s.name}: أقوى مجال «${sorted[0].name}» بنسبة ${fmt(sorted[0].value)}.`);if(sorted.length&&sorted[sorted.length-1].value){const w=sorted[sorted.length-1];weaknesses.push(`${s.name}: أضعف مجال «${w.name}» بنسبة ${fmt(w.value)} ويحتاج تدخلًا علاجيًا موجهًا.`);recs.push(`${s.name} - ${w.name}: تشخيص الأخطاء الشائعة، تدريس مصغر، تدريب متدرج، ثم قياس بعدي خلال ٢-٣ أسابيع.`)}if(s.schoolAvg&&s.kingdomAvg){const diff=s.schoolAvg-s.kingdomAvg;if(diff>=0)strengths.push(`${s.name}: متوسط المدرسة أعلى من متوسط المملكة بمقدار ${fmt(diff)}.`);else weaknesses.push(`${s.name}: متوسط المدرسة أقل من متوسط المملكة بمقدار ${fmt(Math.abs(diff))}.`)}});if(d.change>0)strengths.unshift(`الاتجاه العام تحسن بمقدار +${d.change} مقارنة بالقياس المرجعي.`);if(d.change<0)weaknesses.unshift(`الاتجاه العام تراجع بمقدار ${d.change}; يلزم مراجعة أسباب الانخفاض.`);if(!recs.length)recs.push('تثبيت الممارسات الناجحة مع قياس تكويني دوري، ثم مقارنة القياس البعدي بالمستهدف.');return{validation,strengths,weaknesses,recs}}
function renderAnalysis(d,a){$('#validation').innerHTML=a.validation.length?`<div class="notice">⚠️ <b>تحقق قبل اعتماد التقرير:</b><ul>${a.validation.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:`<div class="status good">✅ اجتازت البيانات أهم اختبارات الاتساق الحسابي.</div>`;$('#analysis').innerHTML=`<div class="listbox"><h4>✅ نقاط القوة</h4><ul>${(a.strengths.length?a.strengths:['لا توجد مؤشرات قوة كافية بعد.']).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="listbox"><h4>⚠️ نقاط الضعف والفجوات</h4><ul>${(a.weaknesses.length?a.weaknesses:['لا توجد فجوات مرتفعة وفق البيانات المدخلة.']).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="listbox" style="grid-column:1/-1"><h4>🛠️ التحسينات والخطة العلاجية المقترحة</h4><ol>${a.recs.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`;$('#charts').innerHTML=d.subjects.map(s=>`<div class="chart"><h4>${esc(s.name)} - توزيع مستويات الأداء</h4><div class="seg"><span class="vl" style="width:${clamp(s.veryLow)}%">${fmt(s.veryLow)}</span><span class="lo" style="width:${clamp(s.low)}%">${fmt(s.low)}</span><span class="me" style="width:${clamp(s.medium)}%">${fmt(s.medium)}</span><span class="hi" style="width:${clamp(s.high)}%">${fmt(s.high)}</span></div><div class="bars" style="margin-top:16px">${s.domains.map(x=>`<div class="barItem"><span>${esc(x.name)}</span><div class="track"><i style="width:${clamp(x.value)}%"></i></div><b>${fmt(x.value)}</b></div>`).join('')}</div></div>`).join('');show('#analysisSection');setTimeout(()=>$('#analysisSection').scrollIntoView({behavior:'smooth'}),150)}
function countsFor(s,tested){const vals=[s.high,s.medium,s.low,s.veryLow];let counts=vals.map(v=>Math.round(tested*v/100));let diff=tested-counts.reduce((a,b)=>a+b,0);if(counts.length)counts[counts.indexOf(Math.max(...vals))]+=diff;return counts}
function reportSubject(s,d){const a=analyzeData({...d,subjects:[s]});const c=countsFor(s,d.tested);const strongest=[...s.domains].sort((x,y)=>y.value-x.value)[0], weakest=[...s.domains].sort((x,y)=>x.value-y.value).find(x=>x.value>0);return `<section class="reportSubject"><h3>${esc(s.name)}</h3><div class="rsBody"><div class="seg"><span class="vl" style="width:${clamp(s.veryLow)}%">${fmt(s.veryLow)}</span><span class="lo" style="width:${clamp(s.low)}%">${fmt(s.low)}</span><span class="me" style="width:${clamp(s.medium)}%">${fmt(s.medium)}</span><span class="hi" style="width:${clamp(s.high)}%">${fmt(s.high)}</span></div><div class="miniGrid"><div class="metric"><b>${fmt(s.schoolAvg)}</b><small>متوسط المدرسة</small></div><div class="metric"><b>${fmt(s.mastery)}</b><small>اجتازوا الحد الأدنى</small></div><div class="metric"><b>${s.target?fmt(s.target):'—'}</b><small>المستهدف</small></div><div class="metric"><b>${s.target?fmt(Math.max(0,s.target-s.mastery)):'—'}</b><small>الفجوة</small></div></div><div class="rTables" style="margin-top:13px"><table class="levelTable"><tr><th>مستوى الأداء</th><th>النسبة</th><th>العدد التقريبي</th></tr><tr><td class="c1">مرتفع</td><td>${fmt(s.high)}</td><td>${c[0]}</td></tr><tr><td class="c2">متوسط</td><td>${fmt(s.medium)}</td><td>${c[1]}</td></tr><tr><td class="c3">منخفض</td><td>${fmt(s.low)}</td><td>${c[2]}</td></tr><tr><td class="c4">منخفض جدًا</td><td>${fmt(s.veryLow)}</td><td>${c[3]}</td></tr></table><div class="narrative"><b>تحليل النتائج:</b><br>${strongest&&strongest.value?`نقطة القوة الأعلى: ${esc(strongest.name)} (${fmt(strongest.value)}).<br>`:''}${weakest?`الأولوية العلاجية: ${esc(weakest.name)} (${fmt(weakest.value)}).<br>`:''}${a.weaknesses.slice(0,2).map(esc).join('<br>')}<br><b>التحسين المقترح:</b> ${esc(a.recs[0]||'متابعة الأداء وقياس الأثر.')}</div></div>${s.domains.length?`<div class="bars" style="margin-top:15px">${s.domains.map(x=>`<div class="barItem"><span>${esc(x.name)}</span><div class="track"><i style="width:${clamp(x.value)}%"></i></div><b>${fmt(x.value)}</b></div>`).join('')}</div>`:''}</div></section>`}
function buildReport(d){const all=analyzeData(d);const ch=d.change>0?'+'+d.change:d.change;$('#report').innerHTML=`<article class="report"><header class="rHead"><div><small>تحليل نتائج بطاقة نافس</small><h2>${esc(d.school||'المدرسة')}</h2></div><div class="change">${esc(ch||'—')}</div></header><div class="rMeta"><div><small>الصف</small><b>${gradeLabel(d.grade)}</b></div><div><small>العام الدراسي</small><b>${esc(d.year)}</b></div><div><small>عدد الطلبة</small><b>${d.total||'—'}</b></div><div><small>المختبرون</small><b>${d.tested||'—'}</b></div><div><small>الجهة</small><b>${esc(d.region||'—')}</b></div></div><div class="reportSubjects">${d.subjects.map(s=>reportSubject(s,d)).join('')}</div><footer class="rFoot"><b>القراءة العامة:</b> ${(all.strengths.slice(0,2).concat(all.weaknesses.slice(0,2))).map(esc).join(' ')}<br><b>أولويات التحسين:</b> ${all.recs.map(esc).join(' • ')}<br><small class="reportDisclaimer">بطاقة تحليل مدرسية مولدة من البيانات المعتمدة بعد المراجعة. لا تُعد تقريرًا رسميًا صادرًا من هيئة تقويم التعليم والتدريب.</small><div class="reportSignature"><span class="reportLogo brandMark" aria-hidden="true"></span><div><b>أ/ فاطمة هزازي</b><span>ملتقى معلمي ومعلمات الرياضيات · ملتقى التعليم التفاعلي</span></div></div></footer></article>`;show('#reportSection');setTimeout(()=>$('#reportSection').scrollIntoView({behavior:'smooth'}),150)}
function demo(){currentFile=null;$('#school').value='مدرسة نموذجية';$('#region').value='إدارة تعليم نموذجية - بيانات افتراضية';$('#grade').value='g3';$('#year').value='2026';$('#totalStudents').value='60';$('#testedStudents').value='58';$('#change').value='3.5';$('#gender').value='غير محدد';$('#schoolType').value='حكومي';$('#stage').value='المرحلة الابتدائية';subjects=[makeSubject('الرياضيات',{veryLow:12,low:28,medium:38,high:22,schoolAvg:68.4,adminAvg:66.9,kingdomAvg:67.6,mastery:60,target:70,target2030:80,domains:[{name:'الأعداد والعمليات عليها',value:72,benchmark:0},{name:'الهندسة والقياس',value:64,benchmark:0},{name:'الجبر',value:69.5,benchmark:0}]}),makeSubject('القراءة',{veryLow:10,low:24,medium:42,high:24,schoolAvg:70.2,adminAvg:68.7,kingdomAvg:69.1,mastery:66,target:72,target2030:82,domains:[{name:'استيعاب المقروء',value:74,benchmark:0},{name:'دلالات الألفاظ',value:62,benchmark:0}]})];renderSubjects();show('#editSection');setStatus('تم تحميل بيانات افتراضية عامة للتجربة؛ لا ترتبط بأي مدرسة أو مستخدم.','good');setTimeout(()=>$('#editSection').scrollIntoView({behavior:'smooth'}),150)}

/* ===== قارئ نافس الموجّه - الإصدار ٤ =====
   تحسينات: عامل OCR رقمي إنجليزي مستقل، قراءة أعداد الرأس من مواضع ثابتة،
   التحقق من إجمالي/مختبرين، قراءة مستويات الأداء من نصوص الشرائط لا من العرض فقط،
   اشتقاق الإتقان من (مرتفع+متوسط) للتحقق، وتحسين قراءة المتوسطات والمستهدفات والمجالات.
*/
function v4CanvasCrop(canvas,b,scale=8,mode='raw',threshold=190){
  const x=Math.max(0,Math.floor(b.x)),y=Math.max(0,Math.floor(b.y)),w=Math.max(2,Math.floor(b.w)),h=Math.max(2,Math.floor(b.h));
  const c=document.createElement('canvas');c.width=Math.max(70,Math.round(w*scale));c.height=Math.max(45,Math.round(h*scale));
  const cx=c.getContext('2d');cx.drawImage(canvas,x,y,w,h,0,0,c.width,c.height);
  if(mode!=='raw'){
    const id=cx.getImageData(0,0,c.width,c.height),d=id.data;
    for(let i=0;i<d.length;i+=4){let g=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);if(mode==='binary')g=g>threshold?255:0;d[i]=d[i+1]=d[i+2]=g}
    cx.putImageData(id,0,0)
  }
  return c;
}
function v4RawNums(text){
  const t=en(text||'').replace(/,/g,'.');
  const out=[]; for(const m of t.matchAll(/[+\-]?\d+(?:\.\d+)?/g)){const raw=Number(m[0]);if(!Number.isFinite(raw))continue;out.push({raw,token:m[0],decimal:m[0].includes('.')})}
  return out;
}
function v4CandidateForms(raw,min=0,max=100){
  const vals=[raw];const a=Math.abs(raw);
  if(a>100)vals.push(raw/10,raw/100,raw/1000);
  const uniq=[];for(const v of vals){if(v>=min&&v<=max&&!uniq.some(x=>Math.abs(x-v)<1e-8))uniq.push(v)}return uniq;
}
async function v4Recognize(worker,crop,psm='6',whitelist='0123456789.%+-'){
  await worker.setParameters({tessedit_char_whitelist:whitelist,tessedit_pageseg_mode:String(psm)});
  const r=await worker.recognize(crop);return r.data.text||'';
}
async function v4Number(worker,canvas,b,opt={}){
  const {hint=null,min=0,max=100,integer=false,profile='color'}=opt;
  const tries=profile==='dark'
    ?[{mode:'raw',psm:'6',scale:9},{mode:'raw',psm:'10',scale:9},{mode:'gray',psm:'6',scale:9},{mode:'binary',th:220,psm:'6',scale:9}]
    :[{mode:'raw',psm:'6',scale:9},{mode:'raw',psm:'10',scale:9},{mode:'raw',psm:'12',scale:8},{mode:'gray',psm:'6',scale:9},{mode:'binary',th:170,psm:'6',scale:9},{mode:'binary',th:190,psm:'6',scale:8},{mode:'binary',th:190,psm:'10',scale:8},{mode:'binary',th:220,psm:'6',scale:9}];
  const scored=[];
  for(let ti=0;ti<tries.length;ti++){
    const tr=tries[ti],crop=v4CanvasCrop(canvas,b,tr.scale,tr.mode,tr.th||190),txt=await v4Recognize(worker,crop,tr.psm);
    for(const tok of v4RawNums(txt))for(let v of v4CandidateForms(tok.raw,min,max)){
      if(integer)v=Math.round(v);
      const dist=hint==null?0:Math.abs(v-hint);
      if(hint!=null&&dist>Math.max(8,Math.abs(hint)*.35))continue;
      let score=0;score+=tok.decimal?4:0;score+=ti===0?2:ti===1?1:0;score+=hint==null?0:Math.max(0,8-dist*2);
      if(integer&&Number.isInteger(v))score+=2;
      scored.push({v:Math.round(v*100)/100,score,txt,ti});
    }
  }
  if(!scored.length)return null;
  // Boost repeated values across OCR variants.
  for(const z of scored){const key=Math.round(z.v*100)/100;z.score+=scored.filter(q=>Math.abs(q.v-key)<.03).length*2}
  scored.sort((a,b)=>b.score-a.score||(hint==null?0:Math.abs(a.v-hint)-Math.abs(b.v-hint)));
  return scored[0].v;
}
async function v4IntCandidates(workers,canvas,b,min=1,max=300){
  const all=[];
  for(const worker of workers){
    for(const psm of ['11','6','7','10']){
      const crop=v4CanvasCrop(canvas,b,8,'raw');const txt=await v4Recognize(worker,crop,psm,'0123456789');
      for(const tok of v4RawNums(txt))for(const v of v4CandidateForms(tok.raw,min,max)){const iv=Math.round(v);if(iv>=min&&iv<=max)all.push(iv)}
    }
  }
  const counts=new Map();for(const v of all)counts.set(v,(counts.get(v)||0)+1);
  return [...counts].map(([v,n])=>({v,n})).sort((a,b)=>b.n-a.n);
}
async function v4Header(arWorker,numWorker,canvas){
  const W=canvas.width,H=canvas.height;
  // Arabic text regions.
  const schoolRaw=await ocrRegionV3(arWorker,canvas,{x:W*.64,y:H*.025,w:W*.35,h:H*.06},'6','');
  const regionRaw=await ocrRegionV3(arWorker,canvas,{x:W*.60,y:H*.065,w:W*.39,h:H*.055},'6','');
  const metaRaw=await ocrRegionV3(arWorker,canvas,{x:W*.36,y:H*.07,w:W*.63,h:H*.07},'6','');
  const all=[schoolRaw,regionRaw,metaRaw].join('\n'),base=parseHeader(all);
  let sl=schoolRaw.split(/\n+/).map(cleanArabicOCR).find(x=>/الابتدائية|المتوسطة|الثانوية/.test(x)&&!/(المرحلة|الصف)/.test(x));
  if(sl)base.school=sl.replace(/^المدرسة\s*/,'').trim();
  let rl=regionRaw.split(/\n+/).map(cleanArabicOCR).find(x=>/الإدارة العامة للتعليم|إدارة التعليم/.test(x));if(rl)base.region=rl.split(/حكومي|أهلي|عالمي/)[0].trim();
  const t=en(all);base.grade=/السادس/.test(t)?'g6':(/الثالث\s*المتوسط|الصف\s*الثالث\s*المتوسط/.test(t)?'g9':'g3');base.gender=/بنين/.test(t)?'بنين':'بنات';base.schoolType=/أهلي/.test(t)?'أهلي':/عالمي/.test(t)?'عالمي':'حكومي';base.stage=base.grade==='g9'?'المرحلة المتوسطة':'المرحلة الابتدائية';
  // Exact numeric cells in the standard Nafes card.
  const totalC=await v4IntCandidates([arWorker,numWorker],canvas,{x:W*.565,y:H*.114,w:W*.13,h:H*.025},5,250);
  const testedC=await v4IntCandidates([arWorker,numWorker],canvas,{x:W*.405,y:H*.114,w:W*.145,h:H*.025},5,250);
  let bestPair=null;
  for(const a of totalC.slice(0,5))for(const b of testedC.slice(0,5)){
    if(b.v>a.v)continue;const ratio=b.v/a.v;if(ratio<.65||ratio>1.01)continue;const score=a.n+b.n+(ratio>.8?5:0)-Math.abs(a.v-b.v)*.05;if(!bestPair||score>bestPair.score)bestPair={total:a.v,tested:b.v,score};
  }
  if(bestPair){base.total=bestPair.total;base.tested=bestPair.tested}else{base.total=totalC[0]?.v||'';base.tested=testedC[0]?.v||''}
  const yr=await v4Number(numWorker,canvas,{x:W*.70,y:H*.114,w:W*.13,h:H*.025},{min:2020,max:2035,integer:true,profile:'dark'});base.year=yr&&yr>=2020?String(Math.round(yr)):mostLikelyYear(all);
  base._raw=all;return base;
}
async function v4Change(numWorker,canvas){
  const W=canvas.width,H=canvas.height;
  const v=await v4Number(numWorker,canvas,{x:W*.39,y:H*.035,w:W*.18,h:H*.045},{min:-100,max:100,profile:'dark'});
  // On cards without a numeric change, OCR often sees only a stray symbol; reject tiny/implausible artifacts.
  return v==null?'':v;
}
function v4LargestColor(canvas,rect,kind,cw,H){
  return colorComponents(canvas,rect,kind).filter(c=>c.area>180&&c.w>cw*.035&&c.h>H*.006).sort((a,b)=>b.area-a.area)[0]||null;
}
async function v4Levels(numWorker,canvas,col){
  const H=canvas.height,cw=col.x1-col.x0,rect={x:col.x0,y:H*.266,w:cw,h:H*.052},kinds=['red','orange','medium','high'];
  const comps=kinds.map(k=>v4LargestColor(canvas,rect,k,cw,H));const widths=comps.map(c=>c?.w||0),sum=widths.reduce((a,b)=>a+b,0);if(!sum)return{};
  const hints=widths.map(x=>x/sum*100),vals=[];
  for(let i=0;i<4;i++){
    const c=comps[i];if(!c){vals.push(null);continue}
    const shrink=i===3?.05:.08,b={x:c.x+c.w*shrink,y:c.y+c.h*.03,w:c.w*(1-shrink*2),h:c.h*.94};
    let v=await v4Number(numWorker,canvas,b,{hint:hints[i],min:0,max:100,profile:'color'});if(v==null)v=Math.round(hints[i]*10)/10;vals.push(v);
  }
  // Normalize only if OCR/fallback drifts slightly. Preserve exact read labels whenever the sum is already close.
  const tot=vals.reduce((a,b)=>a+Number(b||0),0);if(Math.abs(tot-100)>1.2){const h=hints.map(x=>Math.round(x*10)/10);let d=Math.round((100-h.reduce((a,b)=>a+b,0))*10)/10;h[h.indexOf(Math.max(...h))]=Math.round((h[h.indexOf(Math.max(...h))]+d)*10)/10;return{veryLow:h[0],low:h[1],medium:h[2],high:h[3]}}
  return{veryLow:Math.round(vals[0]*10)/10,low:Math.round(vals[1]*10)/10,medium:Math.round(vals[2]*10)/10,high:Math.round(vals[3]*10)/10};
}
function v4CurrentColorComponent(canvas,col,kind,y0=.33,y1=.48){
  const H=canvas.height,cw=col.x1-col.x0,rect={x:col.x0,y:H*y0,w:cw,h:H*(y1-y0)};
  let cs=solidCandidates(colorComponents(canvas,rect,kind),cw,H).filter(c=>c.h>H*.005&&c.y>H*(y0+.005)&&c.y<H*y1);
  if(!cs.length)return null;cs.sort((a,b)=>a.x-b.x);return cs[0];
}
async function v4Averages(numWorker,canvas,col){
  const out={};
  const pc=v4CurrentColorComponent(canvas,col,'purple',.33,.48),bc=v4CurrentColorComponent(canvas,col,'blue',.33,.48);
  if(pc)out.schoolAvg=await v4Number(numWorker,canvas,{x:pc.x-3,y:pc.y-3,w:pc.w+6,h:pc.h+6},{min:20,max:100,profile:'color'});
  if(bc)out.kingdomAvg=await v4Number(numWorker,canvas,{x:bc.x-3,y:bc.y-3,w:bc.w+6,h:bc.h+6},{min:20,max:100,profile:'color'});
  const gc=v4CurrentColorComponent(canvas,col,'gray',.33,.48);if(gc){const hint=out.schoolAvg!=null&&out.kingdomAvg!=null?(Number(out.schoolAvg)+Number(out.kingdomAvg))/2:null;out.adminAvg=await v4Number(numWorker,canvas,{x:gc.x-3,y:gc.y-3,w:gc.w+6,h:gc.h+6},{hint,min:20,max:100,profile:'color'})}
  for(const k of Object.keys(out))if(out[k]==null)delete out[k];return out;
}
function v4GreenTargets(canvas,col){
  const H=canvas.height,cw=col.x1-col.x0,rect={x:col.x0,y:H*.55,w:cw,h:H*.105};
  return solidCandidates(colorComponents(canvas,rect,'green'),cw,H).filter(c=>c.x<col.x0+cw*.60&&c.w>cw*.035&&c.h>H*.006).sort((a,b)=>a.y-b.y);
}
async function v4MasteryTargets(numWorker,canvas,col,levels){
  const out={};
  // On the Nafes card, mastery equals medium + high. This provides a strong arithmetic check and is more reliable than OCR of the tiny label.
  if(levels&&!isMissing(levels.medium)&&!isMissing(levels.high))out.mastery=Math.round((Number(levels.medium)+Number(levels.high))*10)/10;
  const gs=v4GreenTargets(canvas,col);const vals=[];
  for(const c of gs.slice(0,4)){const v=await v4Number(numWorker,canvas,{x:c.x-3,y:c.y-3,w:c.w+6,h:c.h+6},{min:15,max:100,profile:'color'});if(v!=null)vals.push({v,y:c.y})}
  const uniq=[];for(const z of vals)if(!uniq.some(q=>Math.abs(q.v-z.v)<.2))uniq.push(z);uniq.sort((a,b)=>a.y-b.y);
  if(uniq[0])out.target2030=Math.round(uniq[0].v*10)/10;if(uniq.length>1)out.target=Math.round(uniq[uniq.length-1].v*10)/10;
  return out;
}
function v4NormAr(s){return String(s||'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\u0600-\u06FF ]/g,' ').replace(/\s+/g,' ').trim()}
function v4DomainName(text,subject,grade,index){
  const t=v4NormAr(text);
  if(subject==='القراءة'){if(/استيع|مقرو/.test(t))return'استيعاب المقروء';if(/دلال|الفاظ|لفظ/.test(t))return'دلالات الألفاظ';const fb=grade==='g3'?['دلالات الألفاظ','استيعاب المقروء']:['استيعاب المقروء','دلالات الألفاظ'];return fb[index]||`مجال ${index+1}`}
  if(subject==='الرياضيات'){if(/جبر/.test(t))return'الجبر';if(/هندس|قياس/.test(t))return'الهندسة والقياس';if(/بيانات|احتمال/.test(t))return'البيانات والاحتمالات';if(/اعداد|عمليات/.test(t))return'الأعداد والعمليات';const fb=grade==='g3'?['الأعداد والعمليات','الهندسة والقياس','الجبر']:['الهندسة والقياس','الجبر','البيانات والاحتمالات','الأعداد والعمليات'];return fb[index]||`مجال ${index+1}`}
  if(subject==='العلوم'){if(/حياه/.test(t))return'علوم الحياة';if(/فيزي/.test(t))return'العلوم الفيزيائية';if(/ارض|فضا/.test(t))return'علوم الأرض والفضاء';return['علوم الحياة','العلوم الفيزيائية','علوم الأرض والفضاء'][index]||`مجال ${index+1}`}
  return `مجال ${index+1}`;
}
async function v4Domains(arWorker,numWorker,canvas,col,grade,subject){
  const H=canvas.height,cw=col.x1-col.x0;let bars=groupDomainBarsV3(canvas,col);const expected=domainTemplate(grade,subject).length;
  if(bars.length>expected)bars=bars.sort((a,b)=>b.h-a.h).slice(0,expected).sort((a,b)=>a.cx-b.cx);
  const out=[];
  for(let i=0;i<bars.length;i++){
    const b=bars[i],geom=Math.max(0,Math.min(100,(H*.859-b.y)/(H*(.859-.752))*100));
    const valBox={x:Math.max(col.x0,b.cx-cw*.15),y:Math.max(0,b.y-H*.042),w:Math.min(cw*.30,col.x1-Math.max(col.x0,b.cx-cw*.15)),h:H*.044};
    let value=await v4Number(numWorker,canvas,valBox,{hint:geom,min:0,max:100,profile:'dark'});if(value==null)value=Math.round(geom*10)/10;
    const labelBox={x:Math.max(col.x0,b.cx-cw*.19),y:H*.858,w:Math.min(cw*.38,col.x1-Math.max(col.x0,b.cx-cw*.19)),h:H*.045};
    const label=await ocrRegionV3(arWorker,canvas,labelBox,'6','');
    out.push({name:v4DomainName(label,subject,grade,i),value:Math.round(value*10)/10,benchmark:''});
  }
  // If label OCR produced duplicate names, restore a one-to-one mapping using the expected template for unresolved duplicates.
  const seen=new Set();const tpl=domainTemplate(grade,subject);for(let i=0;i<out.length;i++){if(seen.has(out[i].name)){const free=tpl.find(n=>!seen.has(n));if(free)out[i].name=free}seen.add(out[i].name)}
  while(out.length<expected){const free=tpl.find(n=>!out.some(x=>x.name===n))||tpl[out.length];out.push({name:free,value:'',benchmark:''})}
  return out;
}
async function smartExtract(canvas){
  if(!window.Tesseract)throw new Error('تعذر تحميل محرك القراءة الضوئية OCR.');
  setStatus('تهيئة قارئ نافس الدقيق - الإصدار ٤…','warn');
  const numWorker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text'&&m.progress)setProgress(10+Math.round(m.progress*12))}});
  const arWorker=await Tesseract.createWorker('ara',1,{logger:m=>{if(m.status==='recognizing text'&&m.progress)setProgress(22+Math.round(m.progress*10))}});
  try{
    setProgress(8);const p=await v4Header(arWorker,numWorker,canvas);ocrText=p._raw||'';$('#rawOcr').textContent=ocrText||'لم يُستخرج نص من رأس البطاقة.';applyHeaderV3(p);$('#change').value=await v4Change(numWorker,canvas);
    const cols=columnsFor(p.grade,canvas.width);let done=0,total=cols.length*4;
    for(const col of cols){const s=subjects.find(x=>x.name===col.name);if(!s)continue;
      setStatus(`قراءة ${col.name}: مستويات الأداء…`,'warn');const lv=await v4Levels(numWorker,canvas,col);Object.assign(s,lv);done++;setProgress(32+Math.round(done/total*64));
      setStatus(`قراءة ${col.name}: متوسطات المدرسة والإدارة والمملكة…`,'warn');Object.assign(s,await v4Averages(numWorker,canvas,col));done++;setProgress(32+Math.round(done/total*64));
      setStatus(`قراءة ${col.name}: الإتقان والمستهدفات…`,'warn');Object.assign(s,await v4MasteryTargets(numWorker,canvas,col,lv));done++;setProgress(32+Math.round(done/total*64));
      setStatus(`قراءة ${col.name}: المجالات الفرعية وتسمياتها…`,'warn');s.domains=await v4Domains(arWorker,numWorker,canvas,col,p.grade,col.name);done++;setProgress(32+Math.round(done/total*64));
    }
    // Header consistency guard: never keep impossible counts.
    const totalN=Number($('#totalStudents').value||0),testedN=Number($('#testedStudents').value||0);if(totalN&&testedN&&(testedN>totalN||testedN/totalN<.65)){ $('#totalStudents').value='';$('#testedStudents').value=''; }
    renderSubjects();return p;
  }finally{await numWorker.terminate();await arWorker.terminate()}
}
async function readCurrent(){if(!currentFile)return;try{setProgress(3);setStatus('جاري تجهيز الصفحة…');const canvas=currentFile.type==='application/pdf'||/\.pdf$/i.test(currentFile.name)?await renderPdf(currentFile):await renderImage(currentFile);const prev=$('#preview');prev.innerHTML='';const display=canvas.cloneNode();display.width=canvas.width;display.height=canvas.height;display.getContext('2d').drawImage(canvas,0,0);prev.appendChild(display);currentImageData=canvas.toDataURL('image/png');setProgress(8);await smartExtract(canvas);setProgress(100);const d=capture(),filled=d.subjects.reduce((n,s)=>n+['veryLow','low','medium','high','schoolAvg','adminAvg','kingdomAvg','mastery','target','target2030'].filter(k=>s[k]!==''&&s[k]!=null).length+s.domains.filter(x=>x.value!==''&&x.value!=null).length,0);setStatus(`✅ انتهت القراءة الموجّهة: تم ملء ${filled} قيمة. راجعي القيم ثم اعتمدي التحليل.`,'good');show('#editSection');setTimeout(()=>$('#editSection').scrollIntoView({behavior:'smooth'}),150)}catch(e){console.error(e);setProgress(0);setStatus('تعذر إكمال القراءة التلقائية: '+e.message+' — يمكن تصحيح الحقول يدويًا.','warn');show('#editSection');if(!subjects.length)initSubjects()}}
function capture(){return{school:$('#school').value.trim(),region:$('#region').value.trim(),grade:$('#grade').value,year:$('#year').value,total:$('#totalStudents').value.trim()===''?'':num($('#totalStudents').value),tested:$('#testedStudents').value.trim()===''?'':num($('#testedStudents').value),change:$('#change').value.trim()===''?'':num($('#change').value),gender:$('#gender').value,schoolType:$('#schoolType').value,stage:$('#stage').value,subjects:JSON.parse(JSON.stringify(subjects))}}
function analyzeData(d){
 const validation=[],strengths=[],weaknesses=[],recs=[];
 if(d.total&&d.tested&&d.tested>d.total)validation.push('عدد المختبرين أكبر من عدد الطلبة الإجمالي - راجعي الرقمين.');if(!d.tested)validation.push('عدد المختبرين غير مسجل أو لم تتم قراءته بثقة.');
 d.subjects.forEach(s=>{
   const lv=[s.veryLow,s.low,s.medium,s.high];if(lv.every(v=>!isMissing(v))){const sum=lv.reduce((a,b)=>a+Number(b),0);if(Math.abs(sum-100)>1.0)validation.push(`${s.name}: مجموع مستويات الأداء = ${fmtMaybe(sum)}؛ راجعي النسب.`);const derived=Math.round((Number(s.medium)+Number(s.high))*10)/10;if(!isMissing(s.mastery)&&Math.abs(Number(s.mastery)-derived)>.6)validation.push(`${s.name}: نسبة الإتقان لا تتسق مع مجموع المتوسط والمرتفع (${fmtMaybe(derived)}).`);const low=Number(s.veryLow)+Number(s.low),upper=Number(s.medium)+Number(s.high);if(upper>=50)strengths.push(`${s.name}: ${fmtMaybe(upper)} من الطلبة في المستويين المتوسط والمرتفع.`);if(low>=50)weaknesses.push(`${s.name}: ${fmtMaybe(low)} من الطلبة في المستويين المنخفض والمنخفض جدًا؛ أولوية تحسين مرتفعة.`)}
   if(!isMissing(s.mastery)&&!isMissing(s.target)){const gap=Number(s.target)-Number(s.mastery);if(gap>0)weaknesses.push(`${s.name}: اجتياز الحد الأدنى ${fmtMaybe(s.mastery)} أقل من المستهدف ${fmtMaybe(s.target)} بفجوة ${fmtMaybe(gap)}.`);else strengths.push(`${s.name}: تحقق المستهدف الحالي أو تم تجاوزه.`)}
   const valid=s.domains.filter(x=>!isMissing(x.value));if(valid.length){const sorted=[...valid].sort((a,b)=>Number(b.value)-Number(a.value));strengths.push(`${s.name}: أقوى مجال «${sorted[0].name}» بنسبة ${fmtMaybe(sorted[0].value)}.`);if(sorted.length>=2){const w=sorted[sorted.length-1];weaknesses.push(`${s.name}: أضعف مجال «${w.name}» بنسبة ${fmtMaybe(w.value)} ويحتاج تدخلًا علاجيًا موجهًا.`);recs.push(`${s.name} - ${w.name}: تحليل المهارات الأقل إتقانًا والأخطاء الشائعة، تنفيذ تدريس مصغر وممارسة متدرجة، ثم قياس تكويني وبعدي ومقارنة الأثر بالمستهدف.`)}}
   if(!isMissing(s.schoolAvg)&&!isMissing(s.kingdomAvg)){const diff=Number(s.schoolAvg)-Number(s.kingdomAvg);if(diff>=0)strengths.push(`${s.name}: متوسط المدرسة أعلى من متوسط المملكة بمقدار ${scoreFmt(diff)} درجة.`);else weaknesses.push(`${s.name}: متوسط المدرسة أقل من متوسط المملكة بمقدار ${scoreFmt(Math.abs(diff))} درجة.`)}
 });
 if(!isMissing(d.change)&&Number(d.change)>0)strengths.unshift(`الاتجاه العام تحسن بمقدار +${scoreFmt(d.change)} مقارنة بالعام/القياس المرجعي.`);if(!isMissing(d.change)&&Number(d.change)<0)weaknesses.unshift(`الاتجاه العام تراجع بمقدار ${scoreFmt(d.change)}؛ يلزم تحليل أسباب الانخفاض.`);if(!recs.length)recs.push('تثبيت الممارسات الناجحة، والاستمرار في القياس التكويني، ثم مقارنة القياس البعدي بالمستهدف.');return{validation,strengths,weaknesses,recs};
}
function countsForSafe(s,tested){if(!tested)return['—','—','—','—'];const vals=[s.high,s.medium,s.low,s.veryLow];if(vals.some(isMissing))return['—','—','—','—'];let counts=vals.map(v=>Math.round(tested*Number(v)/100));let diff=tested-counts.reduce((a,b)=>a+b,0);counts[counts.indexOf(Math.max(...vals.map(Number)))]+=diff;return counts}
function reportSubject(s,d){const a=analyzeData({...d,subjects:[s]}),c=countsForSafe(s,d.tested),valid=s.domains.filter(x=>!isMissing(x.value)),sorted=[...valid].sort((x,y)=>Number(y.value)-Number(x.value)),strongest=sorted[0],weakest=sorted.length>=2?sorted[sorted.length-1]:null;const gap=(!isMissing(s.mastery)&&!isMissing(s.target))?Number(s.target)-Number(s.mastery):null;return `<section class="reportSubject"><h3>${esc(s.name)}</h3><div class="rsBody"><div class="seg"><span class="vl" style="width:${isMissing(s.veryLow)?0:clamp(s.veryLow)}%">${fmtMaybe(s.veryLow)}</span><span class="lo" style="width:${isMissing(s.low)?0:clamp(s.low)}%">${fmtMaybe(s.low)}</span><span class="me" style="width:${isMissing(s.medium)?0:clamp(s.medium)}%">${fmtMaybe(s.medium)}</span><span class="hi" style="width:${isMissing(s.high)?0:clamp(s.high)}%">${fmtMaybe(s.high)}</span></div><div class="miniGrid"><div class="metric"><b>${scoreFmt(s.schoolAvg)}</b><small>متوسط المدرسة</small></div><div class="metric"><b>${fmtMaybe(s.mastery)}</b><small>اجتازوا الحد الأدنى</small></div><div class="metric"><b>${fmtMaybe(s.target)}</b><small>المستهدف الحالي</small></div><div class="metric"><b>${gap==null?'—':gap>0?fmtMaybe(gap):'متحقق'}</b><small>الفجوة</small></div></div><div class="rTables" style="margin-top:13px"><table class="levelTable"><tr><th>مستوى الأداء</th><th>النسبة</th><th>العدد التقريبي</th></tr><tr><td class="c1">مرتفع</td><td>${fmtMaybe(s.high)}</td><td>${c[0]}</td></tr><tr><td class="c2">متوسط</td><td>${fmtMaybe(s.medium)}</td><td>${c[1]}</td></tr><tr><td class="c3">منخفض</td><td>${fmtMaybe(s.low)}</td><td>${c[2]}</td></tr><tr><td class="c4">منخفض جدًا</td><td>${fmtMaybe(s.veryLow)}</td><td>${c[3]}</td></tr></table><div class="narrative"><b>تحليل النتائج:</b><br>${strongest?`نقطة القوة الأعلى: ${esc(strongest.name)} (${fmtMaybe(strongest.value)}).<br>`:''}${weakest?`الأولوية العلاجية: ${esc(weakest.name)} (${fmtMaybe(weakest.value)}).<br>`:''}${a.weaknesses.slice(0,3).map(esc).join('<br>')}<br><b>التحسين المقترح:</b> ${esc(a.recs[0]||'متابعة الأداء وقياس الأثر.')}</div></div>${s.domains.length?`<div class="bars" style="margin-top:15px">${s.domains.map(x=>`<div class="barItem"><span>${esc(x.name)}</span><div class="track"><i style="width:${isMissing(x.value)?0:clamp(x.value)}%"></i></div><b>${fmtMaybe(x.value)}</b></div>`).join('')}</div>`:''}</div></section>`}
function buildReport(d){const all=analyzeData(d),ch=isMissing(d.change)?'—':(Number(d.change)>0?'+'+scoreFmt(d.change):scoreFmt(d.change));$('#report').innerHTML=`<article class="report"><header class="rHead"><div><small>تحليل نتائج بطاقة نافس</small><h2>${esc(d.school||'المدرسة')}</h2></div><div class="change">${esc(ch)}</div></header><div class="rMeta"><div><small>الصف</small><b>${gradeLabel(d.grade)}</b></div><div><small>العام الدراسي</small><b>${esc(d.year||'—')}</b></div><div><small>عدد الطلبة</small><b>${d.total||'—'}</b></div><div><small>المختبرون</small><b>${d.tested||'—'}</b></div><div><small>الجهة</small><b>${esc(d.region||'—')}</b></div></div><div class="reportSubjects">${d.subjects.map(s=>reportSubject(s,d)).join('')}</div><footer class="rFoot"><b>القراءة العامة:</b> ${(all.strengths.slice(0,4).concat(all.weaknesses.slice(0,4))).map(esc).join(' ')}<br><b>أولويات التحسين:</b> ${all.recs.map(esc).join(' • ')}<br><small class="reportDisclaimer">بطاقة تحليل مدرسية مولدة من البيانات المعتمدة بعد المراجعة. لا تُعد تقريرًا رسميًا صادرًا من هيئة تقويم التعليم والتدريب.</small><div class="reportSignature"><span class="reportLogo brandMark" aria-hidden="true"></span><div><b>أ/ فاطمة هزازي</b><span>ملتقى معلمي ومعلمات الرياضيات · ملتقى التعليم التفاعلي</span></div></div></footer></article>`;show('#reportSection');setTimeout(()=>$('#reportSection').scrollIntoView({behavior:'smooth'}),150)}
/* ===== نهاية الإصدار ٤ ===== */


/* ===== قارئ نافس الموجّه - الإصدار ٥ =====
   تصحيح مبني على مقارنة ناتج الإصدار ٤ بالبطاقة الأصلية:
   - توسيع ورفع تباين خلايا إجمالي الطلبة/المختبرين.
   - تنظيف اسم الإدارة من التكرار الناتج عن OCR.
   - تحسين OCR للأرقام ذات الخلفية الملونة والرمادية.
   - قراءة المستهدفات الخضراء عبر عزل النص الأبيض من الخلفية الخضراء.
   - تضييق صندوق أرقام المجالات واستخدام تباين أعلى بدل الاعتماد على ارتفاع العمود فقط.
   - عدم اعتماد أي قيمة غير موثوقة كصفر.
*/
function v5ContrastCrop(canvas,b,scale=10,mode='contrast',threshold=190){
  const x=Math.max(0,Math.floor(b.x)),y=Math.max(0,Math.floor(b.y)),w=Math.max(2,Math.floor(b.w)),h=Math.max(2,Math.floor(b.h));
  const c=document.createElement('canvas');c.width=Math.max(80,Math.round(w*scale));c.height=Math.max(50,Math.round(h*scale));
  const cx=c.getContext('2d');cx.drawImage(canvas,x,y,w,h,0,0,c.width,c.height);
  if(mode!=='raw'){
    const id=cx.getImageData(0,0,c.width,c.height),d=id.data,gray=new Uint8Array(c.width*c.height);
    let lo=255,hi=0;
    for(let i=0,j=0;i<d.length;i+=4,j++){const g=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);gray[j]=g;if(g<lo)lo=g;if(g>hi)hi=g}
    const span=Math.max(18,hi-lo);
    for(let i=0,j=0;i<d.length;i+=4,j++){
      let g=Math.max(0,Math.min(255,Math.round((gray[j]-lo)*255/span)));
      if(mode==='contrast2') g=Math.max(0,Math.min(255,Math.round((g-128)*1.9+128)));
      if(mode==='binary') g=g<threshold?0:255;
      d[i]=d[i+1]=d[i+2]=g;
    }
    cx.putImageData(id,0,0);
  }
  return c;
}
function v5CandidateForms(raw,min=0,max=100){
  const vals=[raw],a=Math.abs(raw);
  if(a>100){vals.push(raw/10,raw/100,raw/1000);if(a>=100&&a<200)vals.push(raw-100)}
  const out=[];for(const v of vals)if(Number.isFinite(v)&&v>=min&&v<=max&&!out.some(x=>Math.abs(x-v)<1e-8))out.push(v);
  return out;
}
async function v5Number(worker,canvas,b,opt={}){
  const {hint=null,min=0,max=100,integer=false}=opt;
  const tries=[
    ['raw','6',10,190],['raw','10',10,190],['raw','7',10,190],
    ['contrast','10',11,190],['contrast','6',11,190],['contrast','7',11,190],
    ['contrast2','10',11,190],['binary','10',10,175],['binary','6',10,190],['binary','10',10,205]
  ];
  const scored=[];
  for(let ti=0;ti<tries.length;ti++){
    const [mode,psm,scale,th]=tries[ti],crop=v5ContrastCrop(canvas,b,scale,mode,th);
    const txt=await v4Recognize(worker,crop,psm,'0123456789.%+-');
    for(const tok of v4RawNums(txt)){
      for(let v of v5CandidateForms(tok.raw,min,max)){
        if(integer)v=Math.round(v);
        const dist=hint==null?0:Math.abs(v-hint);
        if(hint!=null&&dist>Math.max(5.5,Math.abs(hint)*.20))continue;
        let score=(tok.decimal?5:0)+(ti<=2?1:0)+(hint==null?0:Math.max(0,10-dist*2.2));
        if(integer&&Number.isInteger(v))score+=2;
        scored.push({v:Math.round(v*100)/100,score,ti,txt});
      }
    }
  }
  if(!scored.length)return null;
  for(const z of scored){z.score+=scored.filter(q=>Math.abs(q.v-z.v)<.03).length*2.4}
  scored.sort((a,b)=>b.score-a.score||(hint==null?0:Math.abs(a.v-hint)-Math.abs(b.v-hint)));
  return scored[0].v;
}
async function v5IntCandidates(workers,canvas,b,min=1,max=300){
  const vals=[];
  for(const worker of workers){
    for(const [mode,psm] of [['raw','11'],['raw','12'],['raw','6'],['contrast','11'],['contrast','12'],['contrast2','11'],['binary','11']]){
      const crop=v5ContrastCrop(canvas,b,9,mode,190);
      const txt=await v4Recognize(worker,crop,psm,'0123456789');
      for(const tok of v4RawNums(txt))for(const v of v5CandidateForms(tok.raw,min,max)){
        const iv=Math.round(v);if(iv>=min&&iv<=max)vals.push(iv);
      }
    }
  }
  const counts=new Map();for(const v of vals)counts.set(v,(counts.get(v)||0)+1);
  return [...counts].map(([v,n])=>({v,n})).sort((a,b)=>b.n-a.n);
}
function v5Lev(a,b){
  a=String(a||'');b=String(b||'');const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)dp[i][0]=i;for(let j=0;j<=b.length;j++)dp[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return dp[a.length][b.length];
}
function v5CleanRegion(s){
  const ws=String(s||'').replace(/\s+/g,' ').trim().split(' ');
  if(ws.length>=2&&v5Lev(ws[ws.length-1],ws[ws.length-2])<=1)ws.pop();
  return ws.join(' ').replace(/\s+(حكومي|أهلي|عالمي).*$/,'').trim();
}
async function v5Header(arWorker,numWorker,canvas){
  const W=canvas.width,H=canvas.height;
  const schoolRaw=await ocrRegionV3(arWorker,canvas,{x:W*.63,y:H*.022,w:W*.36,h:H*.065},'6','');
  const regionRaw=await ocrRegionV3(arWorker,canvas,{x:W*.58,y:H*.064,w:W*.41,h:H*.06},'6','');
  const metaRaw=await ocrRegionV3(arWorker,canvas,{x:W*.35,y:H*.065,w:W*.64,h:H*.09},'6','');
  const all=[schoolRaw,regionRaw,metaRaw].join('\n'),base=parseHeader(all);
  const sl=schoolRaw.split(/\n+/).map(cleanArabicOCR).find(x=>/الابتدائية|المتوسطة|الثانوية/.test(x)&&!/(المرحلة|الصف)/.test(x));
  if(sl)base.school=sl.replace(/^المدرسة\s*/,'').trim();
  const rl=regionRaw.split(/\n+/).map(cleanArabicOCR).find(x=>/الإدارة العامة للتعليم|إدارة التعليم/.test(x));
  if(rl)base.region=v5CleanRegion(rl);
  const t=en(all);
  base.grade=/السادس/.test(t)?'g6':(/الثالث\s*المتوسط|الصف\s*الثالث\s*المتوسط/.test(t)?'g9':'g3');
  base.gender=/بنين/.test(t)?'بنين':'بنات';base.schoolType=/أهلي/.test(t)?'أهلي':/عالمي/.test(t)?'عالمي':'حكومي';
  base.stage=base.grade==='g9'?'المرحلة المتوسطة':'المرحلة الابتدائية';
  const totalC=await v5IntCandidates([numWorker,arWorker],canvas,{x:W*.535,y:H*.098,w:W*.155,h:H*.045},5,250);
  const testedC=await v5IntCandidates([numWorker,arWorker],canvas,{x:W*.385,y:H*.098,w:W*.17,h:H*.045},5,250);
  let best=null;
  for(const a of totalC.slice(0,8))for(const b of testedC.slice(0,8)){
    if(b.v>a.v)continue;const ratio=b.v/a.v;if(ratio<.70||ratio>1.01)continue;
    const score=a.n+b.n+(ratio>.85?8:0)-Math.abs(a.v-b.v)*.08;
    if(!best||score>best.score)best={total:a.v,tested:b.v,score};
  }
  if(best){base.total=best.total;base.tested=best.tested}else{
    base.total=totalC.find(x=>x.v>=10)?.v||'';
    base.tested=testedC.find(x=>x.v>=10)?.v||'';
  }
  const yr=await v5Number(numWorker,canvas,{x:W*.68,y:H*.098,w:W*.16,h:H*.045},{min:2020,max:2035,integer:true});
  base.year=yr&&yr>=2020?String(Math.round(yr)):mostLikelyYear(all);
  base._raw=all;return base;
}
async function v5Levels(numWorker,canvas,col){
  const H=canvas.height,cw=col.x1-col.x0,rect={x:col.x0,y:H*.266,w:cw,h:H*.052},kinds=['red','orange','medium','high'];
  const comps=kinds.map(k=>v4LargestColor(canvas,rect,k,cw,H));const widths=comps.map(c=>c?.w||0),sum=widths.reduce((a,b)=>a+b,0);if(!sum)return{};
  const hints=widths.map(x=>x/sum*100),vals=[];
  for(let i=0;i<4;i++){
    const c=comps[i];if(!c){vals.push(null);continue}
    const b={x:c.x+c.w*.04,y:c.y+c.h*.01,w:c.w*.92,h:c.h*.96};
    let v=await v5Number(numWorker,canvas,b,{hint:hints[i],min:0,max:100});
    if(v==null)v=Math.round(hints[i]*10)/10;vals.push(Math.round(v*10)/10);
  }
  let total=vals.reduce((a,b)=>a+Number(b||0),0);
  const residual=Math.round((100-total)*10)/10;
  // إذا كان الفرق عُشرًا واحدًا وكان أحد القيم فقد العلامة العشرية (مثل 32 بدل 32.1)، أصلحه دون تغيير القيم الدقيقة الأخرى.
  if(Math.abs(residual)===.1){
    let idx=vals.findIndex(v=>Math.abs(v-Math.round(v))<.001);
    if(idx>=0)vals[idx]=Math.round((vals[idx]+residual)*10)/10;
  }
  total=vals.reduce((a,b)=>a+Number(b||0),0);
  if(Math.abs(total-100)>1.0){
    const hv=hints.map(x=>Math.round(x*10)/10),d=Math.round((100-hv.reduce((a,b)=>a+b,0))*10)/10;
    let mi=hv.indexOf(Math.max(...hv));hv[mi]=Math.round((hv[mi]+d)*10)/10;
    return{veryLow:hv[0],low:hv[1],medium:hv[2],high:hv[3]};
  }
  return{veryLow:vals[0],low:vals[1],medium:vals[2],high:vals[3]};
}
async function v5Averages(numWorker,canvas,col){
  const H=canvas.height,cw=col.x1-col.x0,rect={x:col.x0,y:H*.33,w:cw,h:H*.15},out={};
  const pick=kind=>solidCandidates(colorComponents(canvas,rect,kind),cw,H)
    .filter(c=>c.y>H*.35&&c.y<H*.46&&c.h>H*.006)
    .sort((a,b)=>b.area-a.area)[0]||null;
  const margin=Math.max(8,Math.round(H*.0048));
  const pc=pick('purple');if(pc){const v=await v5Number(numWorker,canvas,{x:pc.x-margin,y:pc.y-margin,w:pc.w+2*margin,h:pc.h+2*margin},{min:20,max:100});if(v!=null)out.schoolAvg=v}
  const bc=pick('blue');if(bc){const hint=out.schoolAvg??null;const v=await v5Number(numWorker,canvas,{x:bc.x-margin,y:bc.y-margin,w:bc.w+2*margin,h:bc.h+2*margin},{hint,min:20,max:100});if(v!=null)out.kingdomAvg=v}
  const gc=pick('gray');if(gc){const hint=(out.schoolAvg!=null&&out.kingdomAvg!=null)?(Number(out.schoolAvg)+Number(out.kingdomAvg))/2:(out.schoolAvg??out.kingdomAvg??null);const m2=Math.max(margin,Math.round(H*.006));const v=await v5Number(numWorker,canvas,{x:gc.x-m2,y:gc.y-m2,w:gc.w+2*m2,h:gc.h+2*m2},{hint,min:20,max:100});if(v!=null)out.adminAvg=v}
  return out;
}
function v5GreenMask(canvas,c,preset){
  const {r0,g0,b0}=preset,x=Math.max(0,Math.floor(c.x)),y=Math.max(0,Math.floor(c.y)),w=Math.max(2,Math.floor(c.w)),h=Math.max(2,Math.floor(c.h));
  const src=canvas.getContext('2d').getImageData(x,y,w,h),d=src.data,scale=14,out=document.createElement('canvas');
  out.width=w*scale;out.height=h*scale;const tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;const tx=tmp.getContext('2d'),id=tx.createImageData(w,h);
  for(let i=0;i<d.length;i+=4){
    const isText=d[i]>r0&&d[i+1]>g0&&d[i+2]>b0;
    id.data[i]=id.data[i+1]=id.data[i+2]=isText?0:255;id.data[i+3]=255;
  }
  tx.putImageData(id,0,0);out.getContext('2d').imageSmoothingEnabled=false;out.getContext('2d').drawImage(tmp,0,0,out.width,out.height);return out;
}
async function v5GreenCandidates(worker,canvas,c,min,max){
  const presets=[{r0:70,g0:140,b0:80},{r0:80,g0:150,b0:90},{r0:90,g0:140,b0:80},{r0:100,g0:160,b0:100},{r0:65,g0:135,b0:75}],all=[];
  for(const pr of presets)for(const psm of ['7','10','13']){
    const mask=v5GreenMask(canvas,c,pr),txt=await v4Recognize(worker,mask,psm,'0123456789.%');
    for(const tok of v4RawNums(txt))for(const v of v5CandidateForms(tok.raw,min,max))all.push(Math.round(v*10)/10);
  }
  const count=new Map();for(const v of all)count.set(v,(count.get(v)||0)+1);
  return [...count].map(([v,n])=>({v,n})).sort((a,b)=>b.n-a.n);
}
async function v5MasteryTargets(numWorker,canvas,col,levels){
  const out={};
  if(levels&&!isMissing(levels.medium)&&!isMissing(levels.high))out.mastery=Math.round((Number(levels.medium)+Number(levels.high))*10)/10;
  const H=canvas.height,cw=col.x1-col.x0,rect={x:col.x0,y:H*.55,w:cw,h:H*.105};
  const gs=solidCandidates(colorComponents(canvas,rect,'green'),cw,H)
    .filter(c=>c.x<col.x0+cw*.60&&c.w>cw*.035&&c.h>H*.006)
    .sort((a,b)=>a.y-b.y);
  if(gs.length>=2){
    const top=await v5GreenCandidates(numWorker,canvas,gs[0],50,100);
    const bot=await v5GreenCandidates(numWorker,canvas,gs[gs.length-1],15,95);
    let pair=null;
    for(const a of top.slice(0,8))for(const b of bot.slice(0,8)){
      if(a.v<=b.v+5)continue;const score=a.n+b.n+(a.v>=60?2:0);
      if(!pair||score>pair.score)pair={long:a.v,current:b.v,score};
    }
    if(pair){out.target2030=pair.long;out.target=pair.current}
    else{if(top[0])out.target2030=top[0].v;if(bot[0])out.target=bot[0].v}
  }
  return out;
}
function v5VisualDomainFallback(grade,subject,index){
  if(subject==='القراءة'&&grade==='g3')return['دلالات الألفاظ','استيعاب المقروء'][index]||`مجال ${index+1}`;
  if(subject==='الرياضيات'&&grade==='g3')return['الأعداد والعمليات','الهندسة والقياس','الجبر'][index]||`مجال ${index+1}`;
  return domainTemplate(grade,subject)[index]||`مجال ${index+1}`;
}
async function v5Domains(arWorker,numWorker,canvas,col,grade,subject){
  const H=canvas.height,cw=col.x1-col.x0;let bars=groupDomainBarsV3(canvas,col);const expected=domainTemplate(grade,subject).length;
  if(bars.length>expected)bars=bars.sort((a,b)=>b.h-a.h).slice(0,expected).sort((a,b)=>a.cx-b.cx);
  const out=[];
  for(let i=0;i<bars.length;i++){
    const b=bars[i],geom=Math.max(0,Math.min(100,(H*.859-b.y)/(H*(.859-.752))*100));
    const valBox={x:Math.max(col.x0,b.cx-cw*.105),y:Math.max(0,b.y-H*.037),w:Math.min(cw*.21,col.x1-Math.max(col.x0,b.cx-cw*.105)),h:H*.035};
    let value=await v5Number(numWorker,canvas,valBox,{hint:geom,min:0,max:100});
    if(value==null)value=Math.round(geom*10)/10;
    const labelBox={x:Math.max(col.x0,b.cx-cw*.19),y:H*.858,w:Math.min(cw*.38,col.x1-Math.max(col.x0,b.cx-cw*.19)),h:H*.045};
    const label=await ocrRegionV3(arWorker,canvas,labelBox,'6','');
    let name=v4DomainName(label,subject,grade,i);
    if(!label||/^مجال\s/.test(name))name=v5VisualDomainFallback(grade,subject,i);
    out.push({name,value:Math.round(value*10)/10,benchmark:''});
  }
  const seen=new Set();for(let i=0;i<out.length;i++){if(seen.has(out[i].name))out[i].name=v5VisualDomainFallback(grade,subject,i);seen.add(out[i].name)}
  while(out.length<expected){const name=v5VisualDomainFallback(grade,subject,out.length);out.push({name,value:'',benchmark:''})}
  return out;
}
async function v5Change(numWorker,canvas){
  const W=canvas.width,H=canvas.height;
  const b={x:W*.39,y:H*.028,w:W*.17,h:H*.04},v=await v5Number(numWorker,canvas,b,{min:-100,max:100});
  // إذا كانت البطاقة تعرض شرطة فقط فلا نملأ التغير.
  return v==null?'':v;
}
smartExtract=async function(canvas){
  if(!window.Tesseract)throw new Error('تعذر تحميل محرك القراءة الضوئية OCR.');
  setStatus('تهيئة قارئ نافس الدقيق - الإصدار ٥…','warn');
  const numWorker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text'&&m.progress)setProgress(8+Math.round(m.progress*12))}});
  const arWorker=await Tesseract.createWorker('ara',1,{logger:m=>{if(m.status==='recognizing text'&&m.progress)setProgress(20+Math.round(m.progress*10))}});
  try{
    const p=await v5Header(arWorker,numWorker,canvas);ocrText=p._raw||'';$('#rawOcr').textContent=ocrText||'لم يُستخرج نص من رأس البطاقة.';applyHeaderV3(p);$('#change').value=await v5Change(numWorker,canvas);
    const cols=columnsFor(p.grade,canvas.width);let done=0,total=cols.length*4;
    for(const col of cols){const s=subjects.find(x=>x.name===col.name);if(!s)continue;
      setStatus(`قراءة ${col.name}: مستويات الأداء…`,'warn');const lv=await v5Levels(numWorker,canvas,col);Object.assign(s,lv);done++;setProgress(30+Math.round(done/total*66));
      setStatus(`قراءة ${col.name}: متوسطات المدرسة والإدارة والمملكة…`,'warn');Object.assign(s,await v5Averages(numWorker,canvas,col));done++;setProgress(30+Math.round(done/total*66));
      setStatus(`قراءة ${col.name}: الإتقان والمستهدفات…`,'warn');Object.assign(s,await v5MasteryTargets(numWorker,canvas,col,lv));done++;setProgress(30+Math.round(done/total*66));
      setStatus(`قراءة ${col.name}: المجالات الفرعية…`,'warn');s.domains=await v5Domains(arWorker,numWorker,canvas,col,p.grade,col.name);done++;setProgress(30+Math.round(done/total*66));
    }
    const totalN=Number($('#totalStudents').value||0),testedN=Number($('#testedStudents').value||0);
    if(totalN&&testedN&&(testedN>totalN||testedN/totalN<.65)){$('#totalStudents').value='';}
    renderSubjects();return p;
  }finally{await numWorker.terminate();await arWorker.terminate()}
};
/* ===== نهاية الإصدار ٥ ===== */

$('#fileInput').onchange=e=>handleFile(e.target.files[0]);const drop=$('#drop');['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));drop.addEventListener('drop',e=>handleFile(e.dataTransfer.files[0]));$('#demoBtn').onclick=demo;$('#rerunOcr').onclick=()=>currentFile&&readCurrent();$('#toggleRaw').onclick=()=>$('#rawOcr').classList.toggle('hidden');$('#grade').onchange=()=>{if(confirm('هل تريدين إعادة تهيئة المواد المناسبة للصف؟'))initSubjects();$('#stage').value=$('#grade').value==='g9'?'المرحلة المتوسطة':'المرحلة الابتدائية'};$('#addSubject').onclick=()=>{subjects.push(makeSubject('الرياضيات'));renderSubjects()};$('#analyzeBtn').onclick=()=>{const d=capture(),a=analyzeData(d);renderAnalysis(d,a)};$('#toReport').onclick=()=>buildReport(capture());$('#printBtn').onclick=()=>window.print();$('#backEdit').onclick=()=>$('#editSection').scrollIntoView({behavior:'smooth'});$('#saveJson').onclick=()=>{const blob=new Blob([JSON.stringify(capture(),null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nafes-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
/* ===== محلل نتائج نافس وخطة التحسين - الإصدار ٦ ===== */
const v6Digits='٠١٢٣٤٥٦٧٨٩';
function v6Has(v){return !(v===''||v===null||v===undefined||Number.isNaN(Number(v)))}
function v6NumberValue(v){return v6Has(v)&&Number.isFinite(Number(v))?Number(v):null}
function v6Ar(value){return String(value??'').replace(/\d/g,d=>v6Digits[Number(d)])}
function v6ArText(value){return v6Ar(value).replace(/([٠-٩])\.([٠-٩])/g,'$1٫$2')}
function v6Round(v,d=1){const p=10**d;return Math.round(Number(v)*p)/p}
function v6Num(v,d=1){if(!v6Has(v))return'—';const n=v6Round(v,d),raw=String(n).replace('.', '٫');return v6Ar(raw)}
function v6Pct(v,d=1){return v6Has(v)?v6Num(v,d)+'٪':'—'}
function v6Signed(v,d=1){if(!v6Has(v))return'—';const n=v6Round(v,d);return(n>0?'+':n<0?'−':'')+v6Num(Math.abs(n),d)}
function v6GapText(v){if(!v6Has(v))return'—';const n=v6Round(v,1);if(n>0)return`أعلى بـ${v6Num(n)} نقطة`;if(n<0)return`أقل بـ${v6Num(Math.abs(n))} نقطة`;return'مطابق للمرجع'}
function v6Norm(s){return String(s||'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[ـًٌٍَُِّْ]/g,'').replace(/[^\u0600-\u06FF0-9 ]/g,' ').replace(/\s+/g,' ').trim()}
function v6Key(s){return v6Norm(s).replace(/\s/g,'')}
function v6GradeName(g){return gradeLabel(g)}
function v6StatusMeta(status){
  if(status==='strength')return{label:'🟢 نقطة قوة',cls:'strength'};
  if(status==='urgent')return{label:'🔴 أولوية عاجلة',cls:'urgent'};
  if(status==='improve')return{label:'🟡 تحتاج تحسينًا',cls:'improve'};
  return{label:'⚪ لا تتوفر بيانات كافية',cls:'nodata'};
}
function v6StatusTag(status){const m=v6StatusMeta(status);return`<span class="v6Tag ${m.cls}">${m.label}</span>`}
function v6SkillInfo(name,subject){
  const n=v6Key(name),s=v6Key(subject);
  if(n.includes('استيعابالمقروء'))return{measure:'فهم النص، واستخراج المعلومات الصريحة والضمنية، وربط الأفكار والاستنتاج.',focus:'تحديد نوع السؤال الذي تعثر فيه الطلبة: معلومة مباشرة، استنتاج، فكرة رئيسة، تسلسل، أو علاقة سبب ونتيجة.',preserve:'استمرار القراءة الموجهة، ومناقشة الأدلة من النص، وتنويع النصوص والأسئلة.'};
  if(n.includes('دلالاتالالفاظ')||n.includes('دلالاتالألفاظ'))return{measure:'فهم معنى الكلمة أو التركيب من السياق، والتمييز بين المرادف والضد والاستخدام المناسب.',focus:'تحليل أخطاء فهم المفردات في السياق، لا الاكتفاء بحفظ المعنى المنفصل.',preserve:'المحافظة على أنشطة المفردات السياقية، وشبكات المعنى، واستخدام الكلمة في جملة.'};
  if(n.includes('الاعدادوالعمليات')||n.includes('الأعدادوالعمليات'))return{measure:'فهم الأعداد وتمثيلها، وإجراء العمليات، واختيار الاستراتيجية المناسبة والتحقق من معقولية الناتج.',focus:'تحديد ما إذا كان الاحتياج في المفهوم العددي، أو الإجراء الحسابي، أو فهم المسألة اللفظية.',preserve:'الاستمرار في تنويع الاستراتيجيات، والحساب الذهني، وتفسير خطوات الحل.'};
  if(n.includes('الهندسهوالقياس')||n.includes('الهندسةوالقياس'))return{measure:'فهم الأشكال والعلاقات المكانية، واستخدام وحدات القياس والقوانين في مواقف تطبيقية.',focus:'تشخيص التمييز بين المفاهيم والقوانين والوحدات، ثم ربطها برسوم ومواقف واقعية.',preserve:'المحافظة على النمذجة البصرية، والقياس العملي، وتبرير اختيار القانون والوحدة.'};
  if(n.includes('الجبر'))return{measure:'اكتشاف الأنماط والعلاقات، واستخدام الرموز والتعبيرات والمعادلات لتمثيل المواقف وحلها.',focus:'تحديد الصعوبة بين فهم الرمز، وبناء العلاقة، وتنفيذ خطوات الحل، والتحقق من الناتج.',preserve:'استمرار استخدام الجداول والنماذج والتمثيلات المتعددة مع تفسير العلاقة.'};
  if(n.includes('البياناتوالاحتمالات')||n.includes('البياناتوالاحتمال'))return{measure:'قراءة البيانات وتمثيلها وتفسيرها، وحساب المقاييس المناسبة، وتقدير الاحتمالات.',focus:'تشخيص قراءة المحاور والمفاتيح، واختيار المقياس الإحصائي، وتفسير الاحتمال في السياق.',preserve:'المحافظة على جمع بيانات حقيقية، وتمثيلها، ومناقشة الاستنتاجات ومدى صحتها.'};
  if(n.includes('علومالحياه')||n.includes('علومالحياة'))return{measure:'فهم الكائنات الحية ووظائفها وتفاعلها مع البيئة والأنظمة الحيوية.',focus:'تحديد المفاهيم المتشابهة، وربط البنية بالوظيفة، وتفسير العلاقات في الأنظمة الحية.',preserve:'استمرار الملاحظة والاستقصاء والنماذج والربط بأمثلة من البيئة المحلية.'};
  if(n.includes('العلومالفيزيائيه')||n.includes('العلومالفيزيائية'))return{measure:'فهم المادة والطاقة والقوى والحركة والتغيرات الفيزيائية وتطبيقها في مواقف علمية.',focus:'تشخيص الخلط بين المفاهيم، وقراءة الرسوم، وتفسير السبب والنتيجة في الظواهر الفيزيائية.',preserve:'المحافظة على التجارب الآمنة، والتنبؤ قبل التجربة، وتفسير النتائج بالأدلة.'};
  if(n.includes('علومالارضوالفضاء')||n.includes('علومالأرضوالفضاء'))return{measure:'فهم مكونات الأرض والطقس والمناخ والنظام الشمسي والعمليات التي تغير سطح الأرض.',focus:'تحديد صعوبة التسلسل الزمني، وقراءة النماذج والخرائط، وربط الظاهرة بأسبابها وآثارها.',preserve:'استمرار استخدام النماذج والخرائط والبيانات الجوية والمقارنات الزمنية.'};
  if(s.includes('قراءه')||s.includes('قراءة'))return{measure:`يقيس الأداء في مهام القراءة المرتبطة بـ «${name}» كما وردت في البطاقة.`,focus:'تفصيل المجال إلى مؤشرات أداء صغيرة، ثم إجراء تشخيص إضافي لكل مؤشر.',preserve:'تثبيت الممارسات القرائية التي دعمت الأداء ومتابعتها بقياس تكويني.'};
  if(s.includes('رياضيات'))return{measure:`يقيس الأداء الرياضي في «${name}» وفق التسمية الواردة في البطاقة.`,focus:'تحليل الخطأ إلى فهم مفهوم، أو إجراء، أو تمثيل، أو تطبيق في مسألة.',preserve:'تثبيت التمثيلات المتعددة والتبرير والتحقق من الحل.'};
  if(s.includes('علوم'))return{measure:`يقيس الفهم العلمي والاستدلال في «${name}» كما ورد في البطاقة.`,focus:'تحديد المفاهيم الفرعية ونوع الاستدلال الذي يحتاج إلى تشخيص إضافي.',preserve:'تثبيت الاستقصاء واستخدام الأدلة العلمية في التفسير.'};
  return{measure:`يقيس أداء الطلبة في «${name}» وفق ما ورد في الملف.`,focus:'يحتاج إلى تشخيص إضافي لتحديد المؤشرات الفرعية ونوع الخطأ.',preserve:'المحافظة على الممارسات التي دعمت الأداء ومراقبة ثباته.'};
}

renderSubjects=function(){
  const box=$('#subjects');
  box.innerHTML=subjects.map((s,si)=>`<article class="subject" data-si="${si}">
    <div class="subjectTop"><h4>${esc(s.name)}</h4><div class="btns"><button class="btn ghost subChange" type="button">تغيير المادة</button><button class="btn danger subDelete" type="button">حذف</button></div></div>
    <div class="fields">
      <div class="field"><label>منخفض جدًا ٪</label><input inputmode="decimal" data-k="veryLow" value="${s.veryLow}"></div>
      <div class="field"><label>منخفض ٪</label><input inputmode="decimal" data-k="low" value="${s.low}"></div>
      <div class="field"><label>متوسط ٪</label><input inputmode="decimal" data-k="medium" value="${s.medium}"></div>
      <div class="field"><label>مرتفع ٪</label><input inputmode="decimal" data-k="high" value="${s.high}"></div>
      <div class="field"><label>متوسط المدرسة</label><input inputmode="decimal" data-k="schoolAvg" value="${s.schoolAvg}"></div>
      <div class="field"><label>متوسط إدارة التعليم</label><input inputmode="decimal" data-k="adminAvg" value="${s.adminAvg}"></div>
      <div class="field"><label>متوسط المملكة</label><input inputmode="decimal" data-k="kingdomAvg" value="${s.kingdomAvg}"></div>
      <div class="field"><label>نسبة اجتياز الحد الأدنى</label><input inputmode="decimal" data-k="mastery" value="${s.mastery}"></div>
      <div class="field"><label>المستهدف الحالي (إن ورد)</label><input inputmode="decimal" data-k="target" value="${s.target}"></div>
      <div class="field"><label>المستهدف طويل المدى (إن ورد)</label><input inputmode="decimal" data-k="target2030" value="${s.target2030}"></div>
    </div>
    <div class="subjectTop" style="margin-top:15px"><div><h4 style="font-size:15px">المهارات أو المجالات الفرعية</h4><small style="color:#6b807a">أدخلي القيمة المرجعية فقط إذا كانت ظاهرة رسميًا في التقرير.</small></div><button class="btn secondary addDomain" type="button">＋ مهارة/مجال</button></div>
    <div class="domainRows">${(s.domains||[]).map((d,di)=>`<div class="domainRow" data-di="${di}">
      <div class="field"><label>اسم المهارة/المجال</label><input data-dk="name" value="${esc(d.name)}"></div>
      <div class="field"><label>نتيجة المدرسة ٪</label><input inputmode="decimal" data-dk="value" value="${d.value}"></div>
      <div class="field"><label>القيمة المرجعية ٪</label><input inputmode="decimal" data-dk="benchmark" value="${v6Has(d.benchmark)?d.benchmark:''}" placeholder="إن وردت فقط"></div>
      <button class="btn danger delDomain" type="button" aria-label="حذف المهارة">×</button>
    </div>`).join('')}</div>
  </article>`).join('');
  box.querySelectorAll('.subject').forEach(el=>{
    const si=+el.dataset.si;
    el.querySelectorAll('[data-k]').forEach(inp=>inp.oninput=()=>subjects[si][inp.dataset.k]=inp.value.trim()===''?'':num(inp.value));
    el.querySelector('.subDelete').onclick=()=>{subjects.splice(si,1);renderSubjects()};
    el.querySelector('.subChange').onclick=()=>{const n=prompt('اسم المادة: الرياضيات / القراءة / العلوم',subjects[si].name);if(!n)return;subjects[si].name=n;subjects[si].domains=domainTemplate($('#grade').value,n).map(x=>({name:x,value:'',benchmark:''}));renderSubjects()};
    el.querySelector('.addDomain').onclick=()=>{subjects[si].domains.push({name:'مهارة جديدة',value:'',benchmark:''});renderSubjects()};
    el.querySelectorAll('.domainRow').forEach(row=>{
      const di=+row.dataset.di;
      row.querySelectorAll('[data-dk]').forEach(inp=>inp.oninput=()=>subjects[si].domains[di][inp.dataset.dk]=inp.dataset.dk==='name'?inp.value:(inp.value.trim()===''?'':num(inp.value)));
      row.querySelector('.delDomain').onclick=()=>{subjects[si].domains.splice(di,1);renderSubjects()};
    });
  });
};

function v6BuildUnits(d){
  const units=[];
  (d.subjects||[]).forEach((s,si)=>{
    const ds=(s.domains||[]);
    if(ds.length){
      ds.forEach((x,di)=>{
        const value=v6NumberValue(x.value),benchmark=v6NumberValue(x.benchmark);
        units.push({key:`${si}-${di}`,subject:s.name,name:x.name||`مهارة ${di+1}`,value,benchmark,gap:value!==null&&benchmark!==null?v6Round(value-benchmark,1):null,source:'domain',subjectData:s});
      });
    }else{
      const value=v6NumberValue(s.schoolAvg),benchmark=v6NumberValue(s.kingdomAvg)??v6NumberValue(s.adminAvg);
      units.push({key:`${si}-overall`,subject:s.name,name:'المؤشر العام للمادة',value,benchmark,gap:value!==null&&benchmark!==null?v6Round(value-benchmark,1):null,source:'overall',subjectData:s});
    }
  });
  const negatives=units.filter(u=>u.gap!==null&&u.gap<0).sort((a,b)=>a.gap-b.gap);
  const urgentKeys=new Set(negatives.slice(0,Math.min(3,negatives.length)).map(u=>u.key));
  units.forEach(u=>{
    if(u.value===null)u.status='nodata';
    else if(u.benchmark===null)u.status='nodata';
    else if(u.gap>=0)u.status='strength';
    else if(urgentKeys.has(u.key))u.status='urgent';
    else u.status='improve';
  });
  return units;
}
function v6Analyze(d){
  const units=v6BuildUnits(d),withData=units.filter(u=>u.value!==null),withRef=units.filter(u=>u.value!==null&&u.benchmark!==null);
  const negatives=units.filter(u=>u.gap!==null&&u.gap<0).sort((a,b)=>a.gap-b.gap);
  const positives=units.filter(u=>u.gap!==null&&u.gap>=0).sort((a,b)=>b.gap-a.gap);
  const rawDesc=[...withData].sort((a,b)=>b.value-a.value),rawAsc=[...withData].sort((a,b)=>a.value-b.value);
  const strongest=rawDesc.slice(0,3);
  const weakest=rawAsc.slice(0,3);
  const diagnostic=negatives.length?[]:rawAsc.filter(u=>u.benchmark===null).slice(0,3);
  const actionUnits=negatives.length?negatives:diagnostic;
  const priorities=(negatives.length?negatives:rawAsc).slice(0,3);
  const validation=[];
  if(d.total&&d.tested&&Number(d.tested)>Number(d.total))validation.push('عدد المختبرين أكبر من عدد الطلبة الإجمالي؛ يجب مراجعة الرقمين.');
  (d.subjects||[]).forEach(s=>{
    const lv=[s.veryLow,s.low,s.medium,s.high];
    if(lv.every(v6Has)){const sum=lv.reduce((a,b)=>a+Number(b),0);if(Math.abs(sum-100)>1)validation.push(`${s.name}: مجموع مستويات الأداء ${v6Pct(sum)} وليس قريبًا من ١٠٠٪.`)}
  });
  if(!withData.length)validation.push('لم تُسجل نتائج للمهارات أو المجالات الفرعية؛ لا يمكن بناء أولويات أو أوراق عمل قبل إدخال النتائج.');
  const noRef=withData.filter(u=>u.benchmark===null);
  return{units,withData,withRef,negatives,positives,strongest,weakest,diagnostic,actionUnits,priorities,largestGap:negatives[0]||null,noRef,validation};
}
function v6UnitLabel(u){return`${u.subject} — ${u.name}`}
function v6RankMap(a){const m=new Map();a.priorities.forEach((u,i)=>m.set(u.key,i+1));return m}
function v6DashboardHtml(d,a){
  const rank=v6RankMap(a);
  return`<section class="v6Section v6AvoidBreak">
    <div class="v6SectionTitle"><div><h3>📊 لوحة المؤشرات</h3><p>التصنيف يعتمد على القيمة المرجعية المدخلة من التقرير فقط. عند غيابها تظهر الحالة «لا تتوفر بيانات كافية»، ولا تُنشأ فجوة افتراضية.</p></div></div>
    <div class="v6Kpis">
      <div class="v6Kpi"><b>${v6Ar(a.units.length)}</b><small>المهارات/المجالات المسجلة</small></div>
      <div class="v6Kpi good"><b>${v6Ar(a.withRef.length)}</b><small>مؤشرات لها قيمة مرجعية</small></div>
      <div class="v6Kpi alert"><b>${v6Ar(a.negatives.length)}</b><small>فجوات سالبة فعلية</small></div>
      <div class="v6Kpi warn"><b>${v6Ar(a.noRef.length)}</b><small>نتائج بلا مرجع للمقارنة</small></div>
    </div>
    <div class="v6TableWrap" style="margin-top:14px"><table class="v6Table"><thead><tr><th>المادة</th><th>المهارة/المجال</th><th>نتيجة المدرسة</th><th>القيمة المرجعية</th><th>مقدار الفجوة</th><th>مستوى الأداء</th><th>الأولوية</th></tr></thead><tbody>
      ${a.units.map(u=>`<tr><td>${esc(u.subject)}</td><td>${esc(u.name)}</td><td>${v6Pct(u.value)}</td><td>${v6Pct(u.benchmark)}</td><td>${v6GapText(u.gap)}</td><td>${v6StatusTag(u.status)}</td><td>${rank.has(u.key)?(u.gap===null?'تشخيصية ':'')+v6Ar(rank.get(u.key)):'—'}</td></tr>`).join('')||'<tr><td colspan="7">لا توجد بيانات.</td></tr>'}
    </tbody></table></div>
    <div class="v6Note v6Warning" style="margin-top:12px">عند غياب القيمة المرجعية يمكن ترتيب النتائج وصفيًا فقط، لكن لا يجوز وصفها بالضعف أو تحديد فجوة رقمية. لذلك يُكتب: «يحتاج إلى تشخيص إضافي».</div>
  </section>`;
}
function v6InterpretationsHtml(d,a){
  return`<section class="v6Section"><div class="v6SectionTitle"><div><h3>🔍 تفسير كل مهارة أو مجال</h3><p>تفسير وصفي للنتيجة، مع فصل البيانات الفعلية عن الاحتمالات التي تحتاج إلى تشخيص.</p></div></div>
    <div class="v6Cards">${a.units.map(u=>{const info=v6SkillInfo(u.name,u.subject);let comparison='لا توجد قيمة مرجعية في البيانات المدخلة.';if(u.gap!==null)comparison=u.gap>=0?`أعلى من القيمة المرجعية بمقدار ${v6Num(Math.abs(u.gap))} نقطة.`:`أقل من القيمة المرجعية بمقدار ${v6Num(Math.abs(u.gap))} نقطة.`;let treatment=u.gap!==null&&u.gap<0?info.focus:(u.gap!==null?info.preserve:'يحتاج إلى تشخيص إضافي قبل تحديد جانب الضعف أو سببه.');return`<article class="v6Card"><h4>${esc(v6UnitLabel(u))}</h4><p><strong>ماذا تقيس؟</strong> ${esc(info.measure)}</p><p><strong>نتيجة المدرسة:</strong> ${v6Pct(u.value)}.</p><p><strong>المقارنة:</strong> ${esc(comparison)}</p><p><strong>الفجوة الفعلية:</strong> ${u.gap===null?'غير متاحة':v6GapText(u.gap)}.</p><p><strong>جانب المعالجة:</strong> ${esc(treatment)}</p><p><strong>ما يحافظ عليه:</strong> ${esc(info.preserve)}</p></article>`}).join('')||'<div class="v6Empty">لا توجد مهارات مضافة.</div>'}</div>
  </section>`;
}
function v6PrioritiesHtml(a){
  return`<section class="v6Section v6AvoidBreak"><div class="v6SectionTitle"><div><h3>🎯 الأولويات</h3><p>${a.negatives.length?'مرتبة وفق أكبر الفجوات السالبة الفعلية.':'ترتيب تشخيصي بحسب أقل النتائج المتاحة؛ لا يُعد حكمًا بوجود ضعف لغياب مرجع كافٍ.'}</p></div></div>
    <div class="v6Cards">${a.priorities.map((u,i)=>{const reason=u.gap!==null?`الفجوة بين نتيجة المدرسة والمرجع تبلغ ${v6Num(Math.abs(u.gap))} نقطة.`:`النتيجة ${v6Pct(u.value)} وهي من أقل النتائج المسجلة، لكن يلزم مرجع رسمي أو اختبار تشخيصي للحكم.`;return`<article class="v6Card v6Priority" data-rank="الأولوية ${v6Ar(i+1)}"><h4>${esc(v6UnitLabel(u))}</h4><p>${esc(reason)}</p><p><strong>القرار:</strong> ${u.gap!==null?'بدء تدخل موجه وقياس أثر.':'تنفيذ تشخيص إضافي أولًا، ثم تقرير نوع التدخل.'}</p></article>`}).join('')||'<div class="v6Empty">لا يمكن تحديد أولويات قبل إدخال نتائج.</div>'}</div>
  </section>`;
}
function v6StudentActions(u,diagnostic){
  const target=u.benchmark!==null?`الاقتراب من القيمة المرجعية ${v6Pct(u.benchmark)} أو تجاوزها`:'تحديد خط أساس دقيق ثم اعتماد مستهدف موثق';
  return[
    `اختبار تشخيصي قصير في «${u.name}» يحدد نوع السؤال ومؤشر الأداء الذي يحتاج دعمًا.`,
    `ورقة عمل متدرجة من الفهم المباشر إلى التطبيق في «${u.name}».`,
    `مجموعات دعم مرنة وفق نمط الخطأ، لا وفق وصف عام للطلبة.`,
    `تدريب أسبوعي قصير بأسئلة محاكية لطبيعة المهارة مع تغذية راجعة فورية.`,
    `نشاط إثرائي للطلاب المتقنين يطلب تفسير الحل أو بناء سؤال جديد.`,
    `قياس قبلي وبعدي موحد، والهدف الإجرائي: ${target}.`
  ];
}
function v6TeacherActions(u){return[
  `ورشة مصغرة لبناء أسئلة تقيس «${u.name}» وتدرجها معرفيًا.`,
  `مجتمع تعلم مهني لتحليل استجابات الطلبة والأخطاء الشائعة في المهارة نفسها.`,
  `زيارة صفية تبادلية تركز على استراتيجية تدريس واحدة مرتبطة بـ «${u.name}».`,
  `إعداد بنك أسئلة قصير مع محك تصحيح واضح، ثم مراجعته جماعيًا.`,
  `اختبار قصير بعد التدخل ومقارنة النتائج بالقياس القبلي والقيمة المرجعية إن توفرت.`
]}
function v6FamilyActions(u){return[
  `نشاط منزلي قصير لمدة عشر دقائق مرتبط بـ «${u.name}» دون تحميل الأسرة دور التدريس الكامل.`,
  `متابعة أسبوعية لورقة واحدة وتوقيعها بعد مناقشة المحاولة مع الطالب/ة.`,
  `طرح سؤالين منزليين تطبيقيين وإرسال الملاحظة للمدرسة عند استمرار الصعوبة.`,
  `رسالة توعوية: المطلوب هو التشجيع والانتظام، لا إعطاء الإجابة مباشرة.`
]}
function v6List(items){return`<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`}
function v6PlansHtml(d,a){
  const adminRows=[];
  const bodies=a.actionUnits.map((u,i)=>{
    const diagnostic=u.gap===null;
    adminRows.push(`<tr><td>${v6Ar(i+1)} — ${esc(v6UnitLabel(u))}</td><td>${diagnostic?'تشخيص تفصيلي ثم اعتماد التدخل':'اختبار قبلي، تدخل موجه، تدريب، قياس بعدي'}</td><td>معلم المادة · منسق التحصيل · القيادة المدرسية</td><td>الأسابيع ${v6Ar('1–4')}</td><td>اختبار قصير + سجل تقدم + مقارنة قبل/بعد</td><td>نموذج التشخيص · أوراق العمل · سجل الدعم · محضر مجتمع التعلم</td><td>يُستكمل بعد التنفيذ والقياس البعدي</td></tr>`);
    return`<div class="v6UnitHeader"><div><h4>${esc(v6UnitLabel(u))}</h4><small>${diagnostic?'أولوية تشخيصية لغياب المرجع':'فجوة فعلية: '+v6Num(Math.abs(u.gap))+' نقطة'}</small></div>${v6StatusTag(u.status)}</div><div class="v6PlanGrid"><div class="v6PlanBox"><h4>👩‍🎓 خطة الطلاب</h4>${v6List(v6StudentActions(u,diagnostic))}</div><div class="v6PlanBox"><h4>👩‍🏫 تطوير المعلمين والمعلمات</h4>${v6List(v6TeacherActions(u))}</div><div class="v6PlanBox"><h4>👨‍👩‍👧 دور الأسرة</h4>${v6List(v6FamilyActions(u))}</div></div>`;
  }).join('');
  return`<section class="v6Section"><div class="v6SectionTitle"><div><h3>🛠️ خطة التحسين العملية</h3><p>كل إجراء مرتبط بمهارة محددة، ولا ينسب سبب الضعف إلى الطالب أو المعلم أو الأسرة دون دليل.</p></div></div>${bodies||'<div class="v6Empty">لا توجد فجوات موثقة. أدخلي قيمة مرجعية أو نفذي تشخيصًا إضافيًا للنتائج الأقل.</div>'}
    <div class="v6SectionTitle" style="margin-top:20px"><div><h4>🏫 جدول متابعة الإدارة المدرسية</h4></div></div>
    <div class="v6TableWrap"><table class="v6Table"><thead><tr><th>الأولوية</th><th>الإجراء</th><th>المسؤول</th><th>زمن التنفيذ</th><th>أداة القياس</th><th>الشاهد</th><th>النتيجة بعد التنفيذ</th></tr></thead><tbody>${adminRows.join('')||'<tr><td colspan="7">يُستكمل بعد تحديد الأولويات.</td></tr>'}</tbody></table></div>
  </section>`;
}
function v6ImpactHtml(a){
  return`<section class="v6Section v6AvoidBreak"><div class="v6SectionTitle"><div><h3>📈 قياس الأثر</h3><p>لا تُسجل نتيجة بعدية أو مقدار تحسن قبل تنفيذ القياس فعليًا.</p></div></div><div class="v6TableWrap"><table class="v6Table"><thead><tr><th>المهارة</th><th>القياس القبلي</th><th>التدخل</th><th>القياس البعدي</th><th>مقدار التحسن</th><th>القرار التالي</th></tr></thead><tbody>${a.actionUnits.map(u=>`<tr><td>${esc(v6UnitLabel(u))}</td><td>${u.value!==null?'نتيجة التقرير: '+v6Pct(u.value)+'، ويُدعّم باختبار تشخيصي.':'اختبار تشخيصي أولي مطلوب.'}</td><td>تدريس مركز + تدريب متدرج + تغذية راجعة + متابعة أسبوعية</td><td>لا تُسجل قبل التنفيذ</td><td>يُحسب لاحقًا: البعدي − القبلي</td><td>${u.benchmark!==null?'إذا بلغ المرجع أو تجاوزه تُثبت الممارسة؛ وإلا يُعدّل التدخل.':'يُحدد المستهدف والقرار بعد التشخيص.'}</td></tr>`).join('')||'<tr><td colspan="6">لا توجد مهارات محددة للقياس بعد.</td></tr>'}</tbody></table></div></section>`;
}
function v6TimelineHtml(a){return`<section class="v6Section v6AvoidBreak"><div class="v6SectionTitle"><div><h3>📅 الخطة الزمنية لمدة ٤ أسابيع</h3><p>تُطبق على الأولويات المحددة، مع توثيق الشواهد في كل أسبوع.</p></div></div><div class="v6Timeline"><div class="v6Week"><b>الأسبوع الأول</b><p>اختبار تشخيصي، تحليل بنود واستجابات، تحديد المجموعات، واعتماد خط الأساس.</p></div><div class="v6Week"><b>الأسبوع الثاني</b><p>تدخل وتعليم مركز للمهارة، مع نمذجة الحل وتغذية راجعة مباشرة.</p></div><div class="v6Week"><b>الأسبوع الثالث</b><p>تدريب وتطبيق بأسئلة متدرجة ومحاكية، ومتابعة فردية وإثراء للمتقنين.</p></div><div class="v6Week"><b>الأسبوع الرابع</b><p>قياس بعدي، حساب التحسن، مقارنة المرجع، وتحديد قرار الاستمرار أو تعديل التدخل.</p></div></div></section>`}
function v6ItemText(u,mode='strong'){
  if(u.gap!==null)return`${v6UnitLabel(u)}: ${v6Pct(u.value)}، و${v6GapText(u.gap)}.`;
  return`${v6UnitLabel(u)}: ${v6Pct(u.value)}؛ ترتيب وصفي لغياب المرجع.`;
}
function v6ExecutiveHtml(d,a){
  const urgent=a.priorities[0];
  return`<section class="v6Section v6AvoidBreak"><div class="v6SectionTitle"><div><h3>✨ الملخص التنفيذي</h3><p>ملخص من صفحة واحدة للقيادة المدرسية وفريق التحسين.</p></div></div><div class="v6Executive"><div class="v6Card"><h4>أبرز النتائج</h4><p><strong>أقوى ٣ مهارات/مجالات:</strong></p><ol class="v6SummaryList">${a.strongest.map(u=>`<li>${esc(v6ItemText(u,'strong'))}</li>`).join('')||'<li>لا تتوفر بيانات كافية.</li>'}</ol><p><strong>أضعف ٣ مهارات/مجالات:</strong></p><ol class="v6SummaryList">${a.weakest.map(u=>`<li>${esc(v6ItemText(u,'weak'))}</li>`).join('')||'<li>لا تتوفر بيانات كافية.</li>'}</ol></div><div class="v6Card"><h4>قرار التحسين</h4><p><strong>أكبر فجوة:</strong> ${a.largestGap?esc(v6UnitLabel(a.largestGap))+' بمقدار '+v6Num(Math.abs(a.largestGap.gap))+' نقطة':'غير متاحة لعدم وجود فجوة مرجعية سالبة'}.</p><p><strong>أهم ٣ أولويات:</strong> ${a.priorities.length?a.priorities.map((u,i)=>`${v6Ar(i+1)}- ${esc(v6UnitLabel(u))}`).join(' · '):'غير محددة'}.</p><p><strong>الإجراء العاجل:</strong> ${urgent?(urgent.gap===null?'اختبار تشخيصي قصير قبل الحكم على الضعف.':'بدء اختبار قبلي وتدخل موجه في '+esc(urgent.name)+'.'):'إكمال البيانات أولًا'}</p><p><strong>المسؤول:</strong> معلم المادة، منسق التحصيل الدراسي، والقيادة المدرسية.</p><p><strong>موعد قياس الأثر:</strong> نهاية الأسبوع الرابع من بدء الخطة.</p></div></div>${a.validation.length?`<div class="notice" style="margin-top:12px"><b>تحقق مطلوب:</b><ul>${a.validation.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}</section>`;
}
function v6SubjectSummaryHtml(d){return`<section class="v6Section v6AvoidBreak"><div class="v6SectionTitle"><div><h3>📚 ملخص المواد</h3><p>جميع القيم مأخوذة من الحقول التي تمت مراجعتها واعتمادها.</p></div></div><div class="v6SubjectSummary">${(d.subjects||[]).map(s=>`<article class="v6SubjectCard"><h4>${esc(s.name)}</h4><div class="v6MetricRows"><div><b>${v6Num(s.schoolAvg)}</b><small>متوسط المدرسة</small></div><div><b>${v6Num(s.kingdomAvg)}</b><small>متوسط المملكة</small></div><div><b>${v6Pct(s.mastery)}</b><small>اجتياز الحد الأدنى</small></div><div><b>${v6Pct(s.target)}</b><small>المستهدف الحالي</small></div></div></article>`).join('')||'<div class="v6Empty">لا توجد مواد.</div>'}</div></section>`}

function v6Q(q,answer,explanation='',options=[]){return{q,answer,explanation,options}}
function v6ReadingPassage(grade){
  if(grade==='g3')return'زرع خالد شتلة صغيرة في حديقة المدرسة. كان يسقيها كل صباح، ويبعد عنها الأوراق اليابسة. بعد أسابيع نمت الشتلة وأزهرت، ففرح خالد لأن العناية اليومية صنعت فرقًا كبيرًا.';
  if(grade==='g6')return'أطلقت المدرسة مبادرة لترشيد استهلاك الماء. بدأ الطلاب بتسجيل كمية الماء المستخدمة يوميًا، ثم وضعوا ملصقات قرب الصنابير وأبلغوا عن أي تسرب. بعد شهر انخفض الاستهلاك، وأدرك الجميع أن التغيير الصغير إذا استمر يمكن أن يصنع أثرًا كبيرًا.';
  return'لا تُقاس جودة المعلومات بكثرة تداولها، بل بوضوح مصدرها وقوة الدليل الذي تستند إليه. وقد تنتشر بعض الأخبار بسرعة لأنها مثيرة، لا لأنها صحيحة. لذلك يحتاج القارئ الواعي إلى التحقق من المصدر، ومقارنة أكثر من مرجع، والتمييز بين الخبر والرأي قبل أن يعيد النشر.';
}
function v6ReadingComprehensionBank(grade){const passage=v6ReadingPassage(grade);if(grade==='g3')return{passage,core:[v6Q('من زرع الشتلة؟','خالد.'),v6Q('أين زرع خالد الشتلة؟','في حديقة المدرسة.'),v6Q('متى كان يسقيها؟','كل صباح.'),v6Q('ماذا كان يبعد عن الشتلة؟','الأوراق اليابسة.'),v6Q('ماذا حدث بعد أسابيع؟','نمت الشتلة وأزهرت.'),v6Q('لماذا فرح خالد؟','لأن عنايته اليومية أدت إلى نمو الشتلة وإزهارها.'),v6Q('ما الفكرة الرئيسة للنص؟','العناية المستمرة بالنبات تؤدي إلى نموه.'),v6Q('رتب الأحداث: أزهرت الشتلة — زرع خالد الشتلة — سقاها كل صباح.','زرع خالد الشتلة، ثم سقاها كل صباح، ثم أزهرت.'),v6Q('اقترح عنوانًا مناسبًا للنص.','العناية بالشتلة، أو ثمرة العناية.'),v6Q('اذكر دليلًا من النص على مسؤولية خالد.','كان يسقي الشتلة ويبعد عنها الأوراق اليابسة.')],thinking:[v6Q('ماذا تتوقع أن يحدث لو توقف خالد عن سقي الشتلة؟','قد تذبل أو يتوقف نموها، مع تعليل مناسب.'),v6Q('اذكر سلوكًا يوميًا يشبه عناية خالد بالشتلة.','إجابة مفتوحة مناسبة مثل العناية بالنظافة أو المذاكرة المنتظمة.')],exit:[v6Q('ما نتيجة العناية اليومية؟','نمو الشتلة وإزهارها.'),v6Q('هل النص خيالي أم واقعي؟ علل.','واقعي؛ لأن أحداثه ممكنة الحدوث.'),v6Q('اكتب جملة تلخص النص.','جملة صحيحة تتضمن العناية المستمرة ونتيجتها.')]};
  if(grade==='g6')return{passage,core:[v6Q('ما هدف المبادرة؟','ترشيد استهلاك الماء.'),v6Q('ما أول إجراء قام به الطلاب؟','تسجيل كمية الماء المستخدمة يوميًا.'),v6Q('أين وضع الطلاب الملصقات؟','قرب الصنابير.'),v6Q('ماذا فعلوا عند وجود تسرب؟','أبلغوا عنه.'),v6Q('ما النتيجة بعد شهر؟','انخفض استهلاك الماء.'),v6Q('ما الفكرة الرئيسة؟','العمل المنظم والمستمر يحقق ترشيدًا في استهلاك الماء.'),v6Q('ما العلاقة بين تسجيل الاستهلاك وانخفاضه؟','التسجيل ساعد على الوعي والمتابعة واتخاذ إجراءات تقلل الاستهلاك.'),v6Q('استخرج سلوكًا يدل على المسؤولية.','الإبلاغ عن التسرب أو متابعة الاستهلاك.'),v6Q('ما العبارة التي تلخص رسالة النص؟','التغيير الصغير المستمر يصنع أثرًا كبيرًا.'),v6Q('اقترح دليلًا آخر يمكن استخدامه لقياس نجاح المبادرة.','مقارنة فواتير أو قراءات العداد قبل المبادرة وبعدها.')],thinking:[v6Q('كيف تنقل فكرة المبادرة إلى المنزل؟','خطة مناسبة تتضمن المتابعة وإغلاق الصنابير وإصلاح التسرب.'),v6Q('هل الملصقات وحدها كافية؟ علل.','لا؛ تحتاج إلى متابعة وسلوك عملي وقياس، أو إجابة مبررة.')],exit:[v6Q('اذكر إجراءين من النص.','تسجيل الاستهلاك، وضع الملصقات، الإبلاغ عن التسرب.'),v6Q('ما سبب انخفاض الاستهلاك؟','استمرار الطلاب في إجراءات الترشيد والمتابعة.'),v6Q('ما نوع النص؟','نص معلوماتي/وصفي عن مبادرة.') ]};
  return{passage,core:[v6Q('بماذا تُقاس جودة المعلومات وفق النص؟','بوضوح المصدر وقوة الدليل.'),v6Q('لماذا قد تنتشر بعض الأخبار بسرعة؟','لأنها مثيرة، لا لأنها صحيحة بالضرورة.'),v6Q('ما الخطوة الأولى للقارئ الواعي؟','التحقق من المصدر.'),v6Q('لماذا يقارن القارئ أكثر من مرجع؟','للتأكد من صحة المعلومات وتقليل الخطأ أو التحيز.'),v6Q('ما الفرق الذي يدعو النص إلى تمييزه؟','الفرق بين الخبر والرأي.'),v6Q('استنتج موقف الكاتب من إعادة النشر السريع.','يرفضه دون تحقق ويعده سلوكًا غير واعٍ.'),v6Q('ما الفكرة الرئيسة؟','ضرورة التحقق النقدي من المعلومات قبل قبولها أو نشرها.'),v6Q('ما الحجة المستخدمة لإثبات أن الانتشار لا يعني الصحة؟','أن بعض الأخبار تنتشر لأنها مثيرة لا لأنها صحيحة.'),v6Q('اقترح عنوانًا مناسبًا.','القارئ الواعي، أو تحقق قبل أن تنشر.'),v6Q('ما نوع العلاقة بين قوة الدليل وجودة المعلومة؟','علاقة طردية؛ كلما قوي الدليل ارتفعت موثوقية المعلومة.')],thinking:[v6Q('ضع ثلاث خطوات عملية للتحقق من خبر رقمي.','التحقق من المصدر، مقارنة مراجع موثوقة، فحص التاريخ والدليل.'),v6Q('كيف تميز بين خبر ورأي في فقرة؟','الخبر يمكن التحقق منه، والرأي يتضمن حكمًا أو موقفًا شخصيًا، مع مثال.')],exit:[v6Q('هل كثرة التداول دليل كافٍ على الصحة؟','لا.'),v6Q('اذكر معيارين لجودة المعلومات.','وضوح المصدر وقوة الدليل.'),v6Q('اكتب خلاصة النص في سطر واحد.','خلاصة صحيحة عن التحقق النقدي قبل النشر.')]};}
function v6VocabularyBank(grade){const passage=v6ReadingPassage(grade);if(grade==='g3')return{passage,core:[v6Q('ما معنى «اليابسة» في النص؟','الجافة.'),v6Q('ما ضد كلمة «صغيرة»؟','كبيرة.'),v6Q('ما مرادف كلمة «فرح»؟','سُرَّ أو سعد.'),v6Q('اختر معنى «أزهرت»: جفّت — أخرجت زهورًا — سقطت.','أخرجت زهورًا.'),v6Q('استخدم كلمة «العناية» في جملة مفيدة.','إجابة صحيحة مثل: العناية بالنبات تجعله ينمو.'),v6Q('أي كلمة تدل على الزمن؟','بعد أسابيع، أو كل صباح.'),v6Q('ما جمع «ورقة»؟','أوراق.'),v6Q('ما مفرد «أسابيع»؟','أسبوع.'),v6Q('استبدل «صنعت فرقًا» بعبارة قريبة في المعنى.','أحدثت تغييرًا أو أثرت.'),v6Q('ما الكلمة الأنسب: ___ خالد الشتلة كل صباح. (يسقي — يقطف — يهمل)','يسقي.')],thinking:[v6Q('كيف ساعدك السياق على فهم كلمة «اليابسة»؟','لأنها أوراق تُبعد عن النبات وغالبًا تكون جافة، مع تعليل.'),v6Q('اكتب كلمتين من الحقل الدلالي للنبات.','شتلة، أوراق، أزهرت، حديقة.')],exit:[v6Q('مرادف «نمت».','كبرت.'),v6Q('ضد «العناية».','الإهمال.'),v6Q('ضع «أزهرت» في جملة جديدة.','جملة صحيحة.') ]};
  if(grade==='g6')return{passage,core:[v6Q('ما معنى «ترشيد»؟','استخدام المورد باعتدال ومنع الهدر.'),v6Q('ما ضد «انخفض»؟','ارتفع.'),v6Q('ما مرادف «تسرب» في السياق؟','خروج الماء من موضع غير محكم.'),v6Q('ما المقصود بـ «أثر»؟','نتيجة أو تأثير.'),v6Q('ما جمع «صنبور»؟','صنابير.'),v6Q('استخدم «المبادرة» في جملة.','جملة صحيحة تدل على عمل منظم يبدأه الأفراد.'),v6Q('أي كلمة تدل على الاستمرار؟','استمر، أو يوميًا، أو بعد شهر بحسب الصياغة.'),v6Q('ما العلاقة الدلالية بين «استهلاك» و«ترشيد»؟','الترشيد تنظيم وتقليل الاستهلاك غير الضروري.'),v6Q('استبدل «يصنع أثرًا» بعبارة قريبة.','يُحدث نتيجة أو تغييرًا.'),v6Q('اختر الأنسب: أبلغ الطلاب عن أي ___. (تسرب — ملصق — شهر)','تسرب.')],thinking:[v6Q('استنتج معنى «ترشيد» من الإجراءات الواردة.','تقليل الهدر من خلال المتابعة وإصلاح التسرب وإغلاق الصنابير.'),v6Q('كوّن شبكة كلمات حول «الماء».','صنبور، تسرب، استهلاك، ترشيد، عداد، مع كلمات مناسبة.')],exit:[v6Q('مرادف «أدرك».','فهم أو عرف.'),v6Q('ضد «الصغير».','الكبير.'),v6Q('اكتب جملة تستخدم «الاستمرار».','جملة صحيحة.') ]};
  return{passage,core:[v6Q('ما معنى «تداولها»؟','انتقالها وانتشارها بين الناس.'),v6Q('ما المقصود بـ «تستند إليه»؟','تعتمد عليه.'),v6Q('ما ضد «صحيحة»؟','خاطئة.'),v6Q('ما مرادف «التمييز»؟','التفريق.'),v6Q('ما دلالة كلمة «مثيرة» في السياق؟','جاذبة للانتباه أو العاطفة.'),v6Q('استخدم «مرجع» في جملة علمية.','جملة صحيحة تبين الرجوع إلى مصدر موثوق.'),v6Q('ما العلاقة بين «الخبر» و«الرأي»؟','مفهومان متقابلان من حيث إمكان التحقق ووجود الحكم الشخصي.'),v6Q('استبدل «قوة الدليل» بعبارة قريبة.','متانة البرهان أو جودة الإثبات.'),v6Q('ما المقصود بـ «القارئ الواعي»؟','القارئ الذي يتحقق ويفكر نقديًا قبل القبول أو النشر.'),v6Q('أي كلمة أنسب: يجب ___ من المصدر. (التحقق — التداول — الإثارة)','التحقق.')],thinking:[v6Q('كيف يغيّر السياق معنى كلمة «مصدر»؟','في النص تعني الجهة أو المرجع الذي جاءت منه المعلومة، لا منبع الماء مثلًا.'),v6Q('اكتب ثلاث كلمات تنتمي إلى حقل التحقق من المعلومات.','مصدر، دليل، مرجع، تحقق، مقارنة.')],exit:[v6Q('مرادف «تنتشر».','تشيع أو تتداول.'),v6Q('ضد «الوعي».','الغفلة أو عدم الوعي.'),v6Q('اكتب جملة بكلمة «الدليل».','جملة صحيحة.') ]};}

function v6NumbersBank(grade){
  if(grade==='g3')return{core:[
    v6Q('ما القيمة المنزلية للرقم ٥ في العدد ٥٤٨٢؟','٥٠٠٠.'),
    v6Q('أوجد ناتج ٣٤٢٦ + ١٥٧٣.','٤٩٩٩.'),
    v6Q('أوجد ناتج ٨٠٠٠ − ٢٧٤٥.','٥٢٥٥.'),
    v6Q('أوجد ناتج ٧ × ٦.','٤٢.'),
    v6Q('أوجد ناتج ٤٨ ÷ ٦.','٨.'),
    v6Q('أي العددين أكبر: ٦٣٥٠ أم ٦٣٠٥؟','٦٣٥٠.'),
    v6Q('أكمل: ٩ × □ = ٦٣.','٧.'),
    v6Q('قرّب العدد ٤٦٧٢ إلى أقرب مئة.','٤٧٠٠.'),
    v6Q('وُزعت ٢٤ قلمًا بالتساوي على ٤ علب. كم قلمًا في كل علبة؟','٦ أقلام.'),
    v6Q('أي الأعداد الآتية زوجي: ٨٤١، ٨٤٢، ٨٤٣؟','٨٤٢.')],thinking:[
    v6Q('اشترت سارة كتابًا بـ ٣٩٨ ريالًا وحقيبة بـ ٢٠٥ ريالات. قدّر المبلغ ثم أوجد الناتج الدقيق.','التقدير نحو ٦٠٠ ريال، والناتج الدقيق ٦٠٣ ريالات.'),
    v6Q('اكتب مسألة لفظية تمثل العملية ٩٦ ÷ ٨ ثم حلها.','مسألة صحيحة تتضمن توزيع ٩٦ على ٨ بالتساوي، والناتج ١٢.')],exit:[v6Q('٣٠٤ + ١٢٧ = ؟','٤٣١.'),v6Q('٩٠٠ − ٤٥٨ = ؟','٤٤٢.'),v6Q('٩ × ٤ = ؟','٣٦.')]};
  if(grade==='g6')return{core:[
    v6Q('أوجد ناتج ٣٫٧٥ + ٢٫٨.','٦٫٥٥.'),
    v6Q('أوجد ناتج ١٢٫٥ − ٤٫٧٨.','٧٫٧٢.'),
    v6Q('أوجد ناتج ٢٤ × ٣٥.','٨٤٠.'),
    v6Q('أوجد ناتج ٩٣٦ ÷ ١٨.','٥٢.'),
    v6Q('أوجد ناتج ٣⁄٤ + ١⁄٨.','٧⁄٨.'),
    v6Q('حوّل العدد الكسري ٢ ١⁄٣ إلى كسر غير فعلي.','٧⁄٣.'),
    v6Q('اكتب ٠٫٤٥ في صورة نسبة مئوية.','٤٥٪.'),
    v6Q('أي العددين أكبر: ٠٫٧ أم ٠٫٦٩؟','٠٫٧.'),
    v6Q('أوجد ناتج ٥⁄٦ − ١⁄٣.','١⁄٢.'),
    v6Q('أوجد ناتج ٢٫٤ × ٠٫٥.','١٫٢.')],thinking:[
    v6Q('خصم متجر ٢٥٪ من سلعة سعرها ١٢٠ ريالًا. ما مقدار الخصم والسعر بعده؟','الخصم ٣٠ ريالًا، والسعر بعد الخصم ٩٠ ريالًا.'),
    v6Q('رتب الأعداد ٢⁄٣، ٠٫٧، ٦٥٪ تصاعديًا مع توضيح طريقة المقارنة.','٦٥٪، ثم ٢⁄٣، ثم ٠٫٧.')],exit:[v6Q('١٫٢ + ٠٫٨ = ؟','٢.'),v6Q('٣⁄٥ في صورة عشرية.','٠٫٦.'),v6Q('١٥٪ من ٢٠٠ = ؟','٣٠.')]};
  return{core:[
    v6Q('أوجد ناتج −٧ + ١٢.','٥.'),
    v6Q('أوجد قيمة ٣⁴.','٨١.'),
    v6Q('أوجد الجذر التربيعي للعدد ١٤٤.','١٢.'),
    v6Q('أوجد ناتج ٢⁄٣ ÷ ٤⁄٥.','٥⁄٦.'),
    v6Q('أوجد القيمة المطلقة للعدد −٩.','٩.'),
    v6Q('اكتب ٠٫٠٠٠٥٦ بالصيغة العلمية.','٥٫٦ × ١٠⁻⁴.'),
    v6Q('أوجد ناتج (−٣)(٨).','−٢٤.'),
    v6Q('أوجد ناتج ٥⁄٦ + ١⁄٤.','١٣⁄١٢ أو ١ ١⁄١٢.'),
    v6Q('بسّط ٢³ × ٢⁴.','٢⁷ = ١٢٨.'),
    v6Q('رتب −٥، ٣، ٠، −٢ تصاعديًا.','−٥، −٢، ٠، ٣.')],thinking:[
    v6Q('درجة الحرارة ٤ درجات ثم انخفضت ٩ درجات. ما الدرجة الجديدة؟ فسّر بالإشارة إلى الأعداد الصحيحة.','−٥ درجات.'),
    v6Q('قارن بين ٣√٢ و٤ دون استخدام آلة حاسبة، وبرر.','٣√٢ أكبر قليلًا من ٤؛ لأن مربعه ١٨ أكبر من ١٦.')],exit:[v6Q('−٦ − ٣ = ؟','−٩.'),v6Q('٢⁵ = ؟','٣٢.'),v6Q('√٨١ = ؟','٩.')]};
}

function v6GeometryBank(grade){
  if(grade==='g3')return{core:[
    v6Q('كم ضلعًا للمربع؟','٤ أضلاع.'),v6Q('ما اسم الشكل الذي له ثلاثة أضلاع؟','المثلث.'),v6Q('أي وحدة أنسب لقياس طول قلم: السنتيمتر أم الكيلومتر؟','السنتيمتر.'),v6Q('أوجد محيط مستطيل طوله ٦ سم وعرضه ٣ سم.','١٨ سم.'),v6Q('أوجد مساحة مستطيل طوله ٥ وحدات وعرضه ٤ وحدات.','٢٠ وحدة مربعة.'),v6Q('كم وجهًا للكرة؟','ليس لها أوجه مستوية.'),v6Q('ما المجسم الذي له قاعدتان دائريتان؟','الأسطوانة.'),v6Q('كم دقيقة في نصف ساعة؟','٣٠ دقيقة.'),v6Q('أي أكبر: متر واحد أم ٩٠ سنتيمترًا؟','متر واحد.'),v6Q('هل للمستطيل خط تماثل؟','نعم، له خطا تماثل.')],thinking:[v6Q('صمّم مستطيلًا محيطه ٢٠ سم، واكتب طولًا وعرضًا ممكنين.','مثلًا: الطول ٦ سم والعرض ٤ سم.'),v6Q('لماذا نستخدم السنتيمتر لقياس الكتاب ولا نستخدم الكيلومتر؟','لأن السنتيمتر يناسب الأطوال الصغيرة والكيلومتر للمسافات الكبيرة.')],exit:[v6Q('محيط مربع طول ضلعه ٤ سم.','١٦ سم.'),v6Q('مساحة مربع طول ضلعه ٣ وحدات.','٩ وحدات مربعة.'),v6Q('٦٠ دقيقة تساوي كم ساعة؟','ساعة واحدة.')]};
  if(grade==='g6')return{core:[
    v6Q('أوجد مساحة مثلث قاعدته ٨ سم وارتفاعه ٥ سم.','٢٠ سم².'),v6Q('أوجد مساحة متوازي أضلاع قاعدته ٧ سم وارتفاعه ٤ سم.','٢٨ سم².'),v6Q('أوجد حجم متوازي مستطيلات أبعاده ٣، ٤، ٥ سم.','٦٠ سم³.'),v6Q('حوّل ٢٫٥ متر إلى سنتيمترات.','٢٥٠ سم.'),v6Q('ما مجموع زوايا المثلث؟','١٨٠ درجة.'),v6Q('زاويتان متتامتان، إحداهما ٣٥°. أوجد الأخرى.','٥٥°.'),v6Q('ما اسم المثلث الذي تتساوى أضلاعه الثلاثة؟','مثلث متساوي الأضلاع.'),v6Q('نصف قطر دائرة ٦ سم. ما قطرها؟','١٢ سم.'),v6Q('أي وحدة أنسب لحجم صندوق: سم³ أم سم²؟','سم³.'),v6Q('ما التحويل الهندسي الذي ينتج صورة مرآة؟','الانعكاس.')],thinking:[v6Q('حديقة مستطيلة مساحتها ٤٨ م² وعرضها ٦ م. أوجد طولها ومحيطها.','الطول ٨ م، والمحيط ٢٨ م.'),v6Q('فسر الفرق بين المساحة والحجم بمثال.','المساحة تغطي سطحًا بوحدات مربعة، والحجم يشغل حيزًا بوحدات مكعبة.')],exit:[v6Q('مساحة مثلث قاعدته ١٠ وارتفاعه ٤.','٢٠ وحدة².'),v6Q('١٫٢ متر = كم سنتيمترًا؟','١٢٠ سم.'),v6Q('قطر دائرة نصف قطرها ٧ سم.','١٤ سم.')]};
  return{core:[
    v6Q('أوجد ميل المستقيم المار بالنقطتين (١،٢) و(٥،١٠).','٢.'),v6Q('أوجد المسافة بين النقطتين (٠،٠) و(٣،٤).','٥ وحدات.'),v6Q('ما مجموع الزوايا الداخلية لمضلع خماسي؟','٥٤٠°.'),v6Q('إذا كان مثلثان متشابهان بنسبة ٢:٣، وطول ضلع في الأول ٨، فما المناظر في الثاني؟','١٢.'),v6Q('أوجد محيط دائرة نصف قطرها ٧ باستخدام π = ٢٢⁄٧.','٤٤ وحدة.'),v6Q('أوجد مساحة دائرة نصف قطرها ٥ بدلالة π.','٢٥π وحدة².'),v6Q('زاوية خارجية لمثلث تساوي مجموع الزاويتين الداخليتين البعيدتين. إذا كانتا ٤٠° و٦٥° فما الخارجية؟','١٠٥°.'),v6Q('ما معادلة مستقيم ميله ٣ ويقطع محور الصادات عند −٢؟','ص = ٣س − ٢.'),v6Q('أوجد حجم أسطوانة نصف قطرها ٣ وارتفاعها ٥ بدلالة π.','٤٥π وحدة³.'),v6Q('إذا كانت أضلاع مثلث ٦، ٨، ١٠، فهل هو قائم؟','نعم؛ لأن ٦² + ٨² = ١٠².')],thinking:[v6Q('برهن أن المثلث ذي الأضلاع ٥، ١٢، ١٣ قائم.','٥² + ١٢² = ٢٥ + ١٤٤ = ١٦٩ = ١٣².'),v6Q('صمّم مسألة واقعية تستخدم التشابه لإيجاد ارتفاع جسم.','مسألة صحيحة تستخدم تناسب الأطوال أو الظلال مع حل منطقي.')],exit:[v6Q('ميل مستقيم أفقي.','صفر.'),v6Q('مجموع زوايا رباعي.','٣٦٠°.'),v6Q('مساحة دائرة نصف قطرها ٢.','٤π وحدة².')]};
}

function v6AlgebraBank(grade){
  if(grade==='g3')return{core:[
    v6Q('أكمل النمط: ٤، ٨، ١٢، □.','١٦.'),v6Q('أكمل: ٧ + □ = ١٥.','٨.'),v6Q('إذا كانت القاعدة «أضف ٣»، فما مخرج ٥؟','٨.'),v6Q('المدخل ٤ والقاعدة «اضرب في ٢». ما المخرج؟','٨.'),v6Q('اكتب جملة عددية تمثل: مع سارة ٦ أقلام واشترت ٤.','٦ + ٤ = ١٠.'),v6Q('أي خاصية تظهر في ٣ + ٥ = ٥ + ٣؟','خاصية الإبدال.'),v6Q('أكمل النمط: ٢، ٥، ٨، ١١، □.','١٤.'),v6Q('إذا كان □ − ٩ = ١٢، فما العدد؟','٢١.'),v6Q('جدول قاعدته +٤: إذا كان المدخل ٧ فما المخرج؟','١١.'),v6Q('هل ٤ × ٦ = ٦ × ٤؟ ولماذا؟','نعم؛ بخاصية الإبدال في الضرب.')],thinking:[v6Q('أنشئ نمطًا يبدأ بـ ٣ ويزداد ٥ كل مرة، واكتب أول خمسة حدود.','٣، ٨، ١٣، ١٨، ٢٣.'),v6Q('فسر كيف تتحقق من العدد المفقود في □ + ١٧ = ٣٠.','نطرح ١٧ من ٣٠ فنحصل على ١٣، ثم نتحقق بالجمع.')],exit:[v6Q('٥، ١٠، ١٥، □.','٢٠.'),v6Q('□ + ٦ = ١٤.','٨.'),v6Q('قاعدة ×٣ ومدخل ٤.','١٢.')]};
  if(grade==='g6')return{core:[
    v6Q('بسّط ٣س + ٢س.','٥س.'),v6Q('أوجد قيمة ٢س + ٥ عندما س = ٤.','١٣.'),v6Q('حل المعادلة س + ٧ = ١٩.','س = ١٢.'),v6Q('حل ٣س = ٢١.','س = ٧.'),v6Q('اكتب تعبيرًا يمثل «خمسة أكثر من عدد ن».','ن + ٥.'),v6Q('أكمل النمط: ٢، ٦، ١٨، ٥٤، □.','١٦٢.'),v6Q('هل العدد ١٠ يحقق المعادلة س − ٣ = ٧؟','نعم.'),v6Q('بسّط ٤(س + ٢).','٤س + ٨.'),v6Q('جدول قاعدته ٢س + ١. أوجد المخرج عند س = ٥.','١١.'),v6Q('حل ٢س + ٣ = ١٥.','س = ٦.')],thinking:[v6Q('محيط مربع ٣٦ سم. اكتب معادلة ثم أوجد طول الضلع.','٤س = ٣٦، إذن س = ٩ سم.'),v6Q('قارن بين التعبيرين ٣(س+٢) و٣س+٦.','متكافئان بخاصية التوزيع.')],exit:[v6Q('س + ٤ = ٩.','س = ٥.'),v6Q('قيمة ٣س عند س=٦.','١٨.'),v6Q('بسّط س + س + س.','٣س.')]};
  return{core:[
    v6Q('حل ٣س − ٥ = ١٦.','س = ٧.'),v6Q('حل ٢(س + ٤) = ١٨.','س = ٥.'),v6Q('بسّط ٤س − ٣ + ٢س + ٧.','٦س + ٤.'),v6Q('حل المتباينة ٢س + ١ < ٩.','س < ٤.'),v6Q('حل النظام: س + ص = ٧، س − ص = ١.','س = ٤، ص = ٣.'),v6Q('حلل س² − ٩.','(س − ٣)(س + ٣).'),v6Q('أوجد جذري س² − ٥س + ٦ = ٠.','س = ٢ أو س = ٣.'),v6Q('إذا كانت د(س)=٢س−١ فأوجد د(٥).','٩.'),v6Q('اكتب معادلة مستقيم ميله ٢ ويمر بالنقطة (٠،٣).','ص = ٢س + ٣.'),v6Q('بسّط (س³)(س⁴).','س⁷.')],thinking:[v6Q('حل مسألة: مجموع عددين ٢٢ والفرق بينهما ٦.','العددان ١٤ و٨.'),v6Q('فسر لماذا تتغير إشارة المتباينة عند الضرب في عدد سالب.','لأن ترتيب الأعداد ينعكس على خط الأعداد؛ مع مثال صحيح.')],exit:[v6Q('٥س = ٣٥.','س = ٧.'),v6Q('حلل س² − ١٦.','(س−٤)(س+٤).'),v6Q('د(٣) إذا د(س)=س+٤.','٧.')]};
}

function v6DataProbabilityBank(grade){
  if(grade==='g3')return{core:[
    v6Q('في جدول: تفاح ٥، برتقال ٣، موز ٤. أيها الأكثر؟','التفاح.'),v6Q('كم يزيد التفاح على البرتقال؟','٢.'),v6Q('ما مجموع الفواكه؟','١٢.'),v6Q('إذا كان رمز واحد في التمثيل بالصور يساوي طالبين، فماذا تمثل ٤ رموز؟','٨ طلاب.'),v6Q('أي حدث مؤكد عند رمي مكعب أرقام من ١ إلى ٦: ظهور عدد أقل من ٧ أم ظهور ٨؟','ظهور عدد أقل من ٧.'),v6Q('أي حدث مستحيل عند رمي مكعب الأرقام؟','ظهور ٨.'),v6Q('كيس فيه ٥ كرات حمراء و١ زرقاء. أي اللونين أكثر احتمالًا؟','الأحمر.'),v6Q('ما أنسب تمثيل لمقارنة أعداد الطلاب في ثلاثة صفوف؟','الأعمدة.'),v6Q('رتب: مؤكد، مستحيل، ممكن لحدث ظهور ٣ عند رمي مكعب.','ممكن.'),v6Q('إذا اختار ٦ طلاب القراءة و٤ الرسم، فكم المجموع؟','١٠ طلاب.')],thinking:[v6Q('كوّن سؤالين يمكن الإجابة عنهما من جدول الفواكه.','سؤالان مناسبان مثل الأكثر والمجموع والفرق.'),v6Q('كيف تجعل سحب الكرة الزرقاء أكثر احتمالًا؟','إضافة كرات زرقاء أو تقليل الحمراء.')],exit:[v6Q('رمزان وكل رمز = ٣. ما القيمة؟','٦.'),v6Q('حدث ظهور ٩ على مكعب ١–٦.','مستحيل.'),v6Q('الأكثر بين ٧ و٥.','٧.')]};
  if(grade==='g6')return{core:[
    v6Q('أوجد المتوسط الحسابي للأعداد ٤، ٦، ٨، ١٠.','٧.'),v6Q('أوجد الوسيط للأعداد ٣، ٥، ٧، ٩، ١١.','٧.'),v6Q('أوجد المنوال: ٢، ٤، ٤، ٥، ٦.','٤.'),v6Q('أوجد المدى: ١٢، ١٧، ٩، ٢٠.','١١.'),v6Q('احتمال ظهور عدد زوجي عند رمي مكعب أرقام.','٣⁄٦ = ١⁄٢.'),v6Q('صندوق فيه ٣ حمراء و٢ زرقاء. احتمال الحمراء.','٣⁄٥.'),v6Q('إذا كان ٤٠٪ من ٥٠ طالبًا يفضلون العلوم، فكم عددهم؟','٢٠ طالبًا.'),v6Q('أي تمثيل أنسب لتغير درجة الحرارة عبر أسبوع؟','الخطوط.'),v6Q('هل المتوسط يتأثر بقيمة متطرفة؟','نعم.'),v6Q('في استطلاع ١٢٠ طالبًا، اختير ٣٠ عشوائيًا. ما الكسر الذي يمثل العينة؟','٣٠⁄١٢٠ = ١⁄٤.')],thinking:[v6Q('درجات: ٥، ٦، ٦، ٧، ٢٠. أي مقياس أنسب لوصف المركز؟ علل.','الوسيط؛ لأن ٢٠ قيمة متطرفة تؤثر في المتوسط.'),v6Q('صمّم تجربة عشوائية احتمال النجاح فيها ١⁄٤.','مثل سحب بطاقة واحدة مميزة من أربع بطاقات متساوية الاحتمال.')],exit:[v6Q('متوسط ٦ و٨.','٧.'),v6Q('مدى ٢، ٩، ٥.','٧.'),v6Q('احتمال صورة عند رمي قطعة نقود عادلة.','١⁄٢.')]};
  return{core:[
    v6Q('أوجد المتوسط للأعداد ٥، ٧، ٨، ١٠، ١٠.','٨.'),v6Q('أوجد الوسيط للأعداد ٢، ٤، ٦، ٨.','٥.'),v6Q('أوجد المدى الربيعي إذا كان الربيع الأول ٣ والثالث ١١.','٨.'),v6Q('احتمال حدث متممه ٠٫٣. أوجد احتمال الحدث.','٠٫٧.'),v6Q('رُميت قطعتا نقود. احتمال ظهور صورتين.','١⁄٤.'),v6Q('إذا كان احتمال النجاح ٠٫٨ في ٥٠ تجربة، فما العدد المتوقع؟','٤٠.'),v6Q('ما أثر زيادة ثابتة مقدارها ٣ لكل قيمة على المتوسط؟','يزداد المتوسط ٣.'),v6Q('ما أثر ضرب كل قيمة في ٢ على المدى؟','يتضاعف المدى.'),v6Q('هل الارتباط يعني السببية دائمًا؟','لا.'),v6Q('في عينة منحازة اختير المتطوعون فقط. ما المشكلة؟','العينة قد لا تمثل المجتمع.')],thinking:[v6Q('بيّن كيف يمكن لرسم بياني بمحور مبتور أن يضلل القارئ.','يبالغ في الفروق البصرية؛ يجب فحص مقياس المحور.'),v6Q('قارن بين عينة عشوائية وعينة ملائمة من حيث تمثيل المجتمع.','العشوائية غالبًا أقل تحيزًا؛ الملائمة أسهل لكنها قد لا تمثل المجتمع.')],exit:[v6Q('متمم احتمال ٠٫٢.','٠٫٨.'),v6Q('احتمال حدث مؤكد.','١.'),v6Q('احتمال حدث مستحيل.','٠.')]};
}

function v6LifeScienceBank(grade){
  const primary=grade==='g3';
  return{core:[
    v6Q(primary?'ما الوظيفة الرئيسة للجذور؟':'ما وظيفة الجذور في النبات؟','امتصاص الماء والأملاح وتثبيت النبات.'),
    v6Q('أي جزء يصنع الغذاء غالبًا في النبات؟','الأوراق.'),
    v6Q('ما الذي تحتاج إليه الكائنات الحية للبقاء؟','الماء والغذاء والهواء وبيئة مناسبة.'),
    v6Q('ما المقصود بالموطن؟','المكان الذي يعيش فيه الكائن ويوفر حاجاته.'),
    v6Q('كيف تساعد التكيفات الكائن الحي؟','تساعده على البقاء في بيئته.'),
    v6Q('ما دور المنتج في السلسلة الغذائية؟','يصنع غذاءه ويبدأ انتقال الطاقة.'),
    v6Q('اذكر مثالًا لمستهلك.','الإنسان أو الأرنب أو الأسد، مع مثال صحيح.'),
    v6Q('ماذا يحدث للطاقة خلال السلسلة الغذائية؟','تنتقل من كائن إلى آخر وتقل الطاقة المتاحة في المستويات الأعلى.'),
    v6Q('ما فائدة الهيكل العظمي؟','الدعم والحماية والمساعدة على الحركة.'),
    v6Q('لماذا تعد المحافظة على التنوع الحيوي مهمة؟','لثبات الأنظمة البيئية واستمرار مواردها.')],thinking:[
    v6Q('توقع أثر اختفاء النباتات من نظام بيئي.','تقل مصادر الغذاء والطاقة وتتأثر المستهلكات والسلسلة الغذائية.'),
    v6Q('اربط بين تركيب جزء من كائن حي ووظيفته.','مثال صحيح مثل شكل الأسنان ووظيفتها أو جذور النبات وامتصاص الماء.')],exit:[v6Q('من المنتج: العشب أم الأرنب؟','العشب.'),v6Q('ما معنى التكيف؟','صفة أو سلوك يساعد على البقاء.'),v6Q('وظيفة الأوراق.','صنع الغذاء غالبًا بالبناء الضوئي.')]};
}
function v6PhysicalScienceBank(grade){
  return{core:[
    v6Q('ما الفرق بين الكتلة والحجم؟','الكتلة مقدار المادة، والحجم الحيز الذي تشغله.'),
    v6Q('أي حالة من حالات المادة لها شكل وحجم ثابتان؟','الحالة الصلبة.'),
    v6Q('ما التغير الذي يحول السائل إلى غاز؟','التبخر.'),
    v6Q('هل انصهار الثلج تغير فيزيائي أم كيميائي؟','تغير فيزيائي.'),
    v6Q('ما القوة التي تجذب الأجسام نحو الأرض؟','الجاذبية.'),
    v6Q('كيف تؤثر قوة أكبر في حركة جسم؟','قد تزيد سرعته أو تغير اتجاهه بحسب اتجاه القوة.'),
    v6Q('أي المواد موصل جيد للكهرباء عادة: النحاس أم الخشب؟','النحاس.'),
    v6Q('ما مصدر الطاقة في المصباح اليدوي؟','الطاقة الكيميائية في البطارية تتحول إلى كهربائية وضوئية.'),
    v6Q('ماذا يحدث للظل عندما يقترب الجسم من مصدر الضوء؟','يكبر غالبًا.'),
    v6Q('لماذا يُعد صدأ الحديد تغيرًا كيميائيًا؟','لأنه ينتج مادة جديدة تختلف عن الحديد.')],thinking:[
    v6Q('صمّم تجربة تقارن أثر سطحين مختلفين في حركة جسم.','تحديد متغير مستقل وناتج وضبط بقية العوامل، مثل مقارنة مسافة حركة سيارة على سطح أملس وخشن.'),
    v6Q('فسر تحول الطاقة في لعبة تعمل بالبطارية وتتحرك وتصدر صوتًا.','كيميائية إلى كهربائية ثم حركية وصوتية.')],exit:[v6Q('تحول الغاز إلى سائل.','التكاثف.'),v6Q('قوة تعارض الحركة بين سطحين.','الاحتكاك.'),v6Q('الخشب موصل أم عازل غالبًا؟','عازل.')]};
}
function v6EarthSpaceBank(grade){
  return{core:[
    v6Q('ما سبب تعاقب الليل والنهار؟','دوران الأرض حول محورها.'),
    v6Q('ما سبب الفصول الأربعة؟','ميل محور الأرض مع دورانها حول الشمس.'),
    v6Q('ما الفرق بين الطقس والمناخ؟','الطقس حالة الجو قصيرة المدى، والمناخ نمطه خلال مدة طويلة.'),
    v6Q('ما الأداة المستخدمة لقياس درجة الحرارة؟','مقياس الحرارة.'),
    v6Q('ما العملية التي تصعد فيها المياه إلى الغلاف الجوي؟','التبخر.'),
    v6Q('ما الذي يسبب معظم الزلازل؟','حركة الصفائح الأرضية.'),
    v6Q('اذكر موردًا طبيعيًا متجددًا.','الشمس أو الرياح أو الماء، مع مثال صحيح.'),
    v6Q('لماذا نرى أطوارًا مختلفة للقمر؟','لتغير الجزء المضاء الذي نراه مع حركة القمر حول الأرض.'),
    v6Q('ما أقرب نجم إلى الأرض؟','الشمس.'),
    v6Q('كيف تقلل النباتات من انجراف التربة؟','تثبت الجذور التربة وتبطئ حركة الماء والرياح.')],thinking:[
    v6Q('فسر كيف تؤثر إزالة الغطاء النباتي في التربة.','يزداد الانجراف وتفقد التربة جزءًا من خصوبتها.'),
    v6Q('اقترح بيانات لازمة لمقارنة مناخ مدينتين.','متوسطات الحرارة والأمطار والرطوبة والرياح عبر سنوات.')],exit:[v6Q('دوران الأرض حول محورها يسبب ماذا؟','الليل والنهار.'),v6Q('ماء يتساقط من السحب.','هطول.'),v6Q('الشمس كوكب أم نجم؟','نجم.')]};
}

function v6GenericBank(u){
  const skill=u.name;
  return{core:Array.from({length:10},(_,i)=>v6Q(`سؤال تشخيصي قابل للتحرير ${v6Ar(i+1)} في «${skill}»: اكتبي هنا مؤشر الأداء والسؤال المناسب من المنهج.`,`محك الإجابة يُستكمل بعد تخصيص السؤال؛ لا يعتمد هذا القالب إجابة مفترضة.`)),thinking:[v6Q(`مهمة تطبيقية قابلة للتحرير تربط «${skill}» بموقف جديد.`,`يُبنى محك تصحيح واضح قبل التطبيق.`),v6Q(`سؤال تفسير أو تبرير قابل للتحرير في «${skill}».`,`إجابة مدعومة بالخطوات أو الدليل وفق طبيعة المهارة.`)],exit:[v6Q('تقويم ختامي ١ — يُخصص وفق مؤشر الأداء.','يُحدد بعد التخصيص.'),v6Q('تقويم ختامي ٢ — يُخصص وفق مؤشر الأداء.','يُحدد بعد التخصيص.'),v6Q('تقويم ختامي ٣ — يُخصص وفق مؤشر الأداء.','يُحدد بعد التخصيص.')],generic:true};
}

function v6WorksheetBank(u,grade){
  const n=v6Key(u.name),s=v6Key(u.subject);
  if(n.includes('استيعابالمقروء'))return v6ReadingComprehensionBank(grade);
  if(n.includes('دلالاتالالفاظ')||n.includes('دلالاتالألفاظ'))return v6VocabularyBank(grade);
  if(n.includes('الاعدادوالعمليات')||n.includes('الأعدادوالعمليات'))return v6NumbersBank(grade);
  if(n.includes('الهندسهوالقياس')||n.includes('الهندسةوالقياس'))return v6GeometryBank(grade);
  if(n.includes('الجبر'))return v6AlgebraBank(grade);
  if(n.includes('البياناتوالاحتمالات')||n.includes('البياناتوالاحتمال'))return v6DataProbabilityBank(grade);
  if(n.includes('علومالحياه')||n.includes('علومالحياة'))return v6LifeScienceBank(grade);
  if(n.includes('العلومالفيزيائيه')||n.includes('العلومالفيزيائية'))return v6PhysicalScienceBank(grade);
  if(n.includes('علومالارضوالفضاء')||n.includes('علومالأرضوالفضاء'))return v6EarthSpaceBank(grade);
  if(s.includes('قراءه')||s.includes('قراءة'))return v6ReadingComprehensionBank(grade);
  return v6GenericBank(u);
}

function v6QuestionHtml(q,i){
  const opts=(q.options||[]).length?`<div class="v6Options">${q.options.map((o,j)=>`<span>${v6Ar(j+1)}. ${esc(o)}</span>`).join('')}</div>`:'';
  return`<div class="v6Question"><b>${v6Ar(i)}.</b><div><div contenteditable="true">${esc(q.q)}</div>${opts}<div class="v6AnswerLine"></div></div></div>`;
}
function v6AnswerRow(q,i){return`<tr><td>${v6Ar(i)}</td><td>${esc(q.answer)}</td><td>${esc(q.explanation||'—')}</td></tr>`}
function v6WorksheetHtml(u,d,index){
  const bank=v6WorksheetBank(u,d.grade),all=[...(bank.core||[]),...(bank.thinking||[]),...(bank.exit||[])],info=v6SkillInfo(u.name,u.subject);
  const scoreMax=(bank.core||[]).length+((bank.thinking||[]).length*2)+(bank.exit||[]).length;
  return`<article class="v6Sheet v6A4Page" contenteditable="false">
    <header class="v6SheetHead"><div><small>ورقة عمل مرتبطة بنتائج نافس</small><h2>${esc(u.subject)} — ${esc(u.name)}</h2></div><span class="v6SheetNo">${v6Ar(index)}</span></header>
    <div class="v6SheetMeta"><span><b>المدرسة:</b> ${esc(d.school||'........................')}</span><span><b>الصف:</b> ${esc(v6GradeName(d.grade))}</span><span><b>اسم الطالب/ة:</b> ....................................</span><span><b>التاريخ:</b> ........ / ........ / ........</span></div>
    <div class="v6Objective"><b>الهدف:</b> أن يطبق الطالب/ة مهارات «${esc(u.name)}» في أسئلة متدرجة، ويبرر الإجابة عند الحاجة.</div>
    ${bank.generic?'<div class="v6Note v6Warning">هذه المهارة غير مطابقة لبنك المجالات القياسي؛ لذلك أُنشئ قالب تشخيصي قابل للتحرير دون اختراع محتوى أو إجابات.</div>':''}
    ${bank.passage?`<div class="v6Passage"><b>النص:</b><p>${esc(bank.passage)}</p></div>`:''}
    <h3 class="v6Subhead">أولًا: أسئلة متدرجة</h3>${(bank.core||[]).map((q,i)=>v6QuestionHtml(q,i+1)).join('')}
    <h3 class="v6Subhead">ثانيًا: التفكير والتطبيق</h3>${(bank.thinking||[]).map((q,i)=>v6QuestionHtml(q,(bank.core||[]).length+i+1)).join('')}
    <h3 class="v6Subhead">ثالثًا: تقويم ختامي قصير</h3>${(bank.exit||[]).map((q,i)=>v6QuestionHtml(q,(bank.core||[]).length+(bank.thinking||[]).length+i+1)).join('')}
    <footer class="v6Score"><span>الدرجة: ........ / ${v6Ar(scoreMax)}</span><span>ملاحظة المعلم/ة: ........................................................................</span></footer>
  </article>
  <article class="v6AnswerKey v6A4Page">
    <header class="v6SheetHead"><div><small>نموذج إجابة مستقل</small><h2>${esc(u.subject)} — ${esc(u.name)}</h2></div><span class="v6SheetNo">${v6Ar(index)}</span></header>
    <div class="v6Note"><b>تنبيه:</b> يراجع المعلم/ة ملاءمة الأسئلة للصف والمنهج قبل التطبيق، وتقبل البدائل الصحيحة في الأسئلة المفتوحة.</div>
    <div class="v6TableWrap"><table class="v6Table"><thead><tr><th>السؤال</th><th>الإجابة الصحيحة/المحك</th><th>تفسير مختصر</th></tr></thead><tbody>${all.map((q,i)=>v6AnswerRow(q,i+1)).join('')}</tbody></table></div>
  </article>`;
}
function v6WorksheetsHtml(d,a){
  if(!a.actionUnits.length)return`<section class="v6Section"><div class="v6SectionTitle"><div><h3>📄 أوراق العمل</h3></div></div><div class="v6Empty">لا تُنشأ أوراق عمل قبل تحديد مهارات ذات فجوة فعلية أو أولوية تشخيصية.</div></section>`;
  return`<section class="v6Section v6WorksheetsIntro"><div class="v6SectionTitle"><div><h3>📄 أوراق العمل ونماذج الإجابة</h3><p>ورقة مستقلة لكل أولوية، تتضمن ١٠ أسئلة متدرجة وسؤالين للتفكير و٣ أسئلة ختامية، يليها نموذج إجابة مستقل.</p></div></div><div class="v6Note">الأسئلة مبنية على المجالات القياسية الشائعة في نافس. يجب مراجعتها تربويًا قبل التطبيق، خصوصًا إذا كان اسم المهارة في التقرير عامًا أو مختلفًا.</div></section>${a.actionUnits.map((u,i)=>v6WorksheetHtml(u,d,i+1)).join('')}`;
}

function v6PackageHtml(d,a,includeWorksheets=true){return[
  v6ExecutiveHtml(d,a),v6SubjectSummaryHtml(d),v6DashboardHtml(d,a),v6InterpretationsHtml(d,a),v6PrioritiesHtml(a),v6PlansHtml(d,a),v6ImpactHtml(a),v6TimelineHtml(a),includeWorksheets?v6WorksheetsHtml(d,a):''
].join('')}

function v6RenderAnalysis(d,a){
  $('#validation').innerHTML=a.validation.length?`<div class="notice"><b>⚠️ تحقق قبل اعتماد الحزمة:</b><ul>${a.validation.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:`<div class="status good">✅ اجتازت البيانات اختبارات الاتساق الأساسية. تبقى المراجعة البشرية إلزامية.</div>`;
  $('#analysis').innerHTML=v6ExecutiveHtml(d,a);
  $('#charts').innerHTML=v6SubjectSummaryHtml(d);
  const map={v6Dashboard:v6DashboardHtml(d,a),v6Interpretation:v6InterpretationsHtml(d,a),v6Priorities:v6PrioritiesHtml(a),v6Plans:v6PlansHtml(d,a),v6Impact:v6ImpactHtml(a),v6Timeline:v6TimelineHtml(a),v6Worksheets:v6WorksheetsHtml(d,a)};
  Object.entries(map).forEach(([id,html])=>{const el=document.getElementById(id);if(el)el.innerHTML=html});
  window.v6Last={d,a};show('#analysisSection');setTimeout(()=>$('#analysisSection').scrollIntoView({behavior:'smooth'}),120);
}
function v6BuildReport(d){
  const a=v6Analyze(d),ch=v6Has(d.change)?(Number(d.change)>0?'+'+v6Num(d.change):v6Num(d.change)):'—';
  $('#report').innerHTML=`<article class="report v6FinalReport"><header class="rHead"><div><small>لوحة تحليل نتائج نافس وخطة رفع مستوى الأداء</small><h2>${esc(d.school||'المدرسة')}</h2></div><div class="change">${esc(ch)}</div></header><div class="rMeta"><div><small>الصف</small><b>${esc(v6GradeName(d.grade))}</b></div><div><small>العام الدراسي</small><b>${esc(v6Ar(d.year||'—'))}</b></div><div><small>عدد الطلبة</small><b>${v6Has(d.total)?v6Ar(d.total):'—'}</b></div><div><small>المختبرون</small><b>${v6Has(d.tested)?v6Ar(d.tested):'—'}</b></div><div><small>الجهة</small><b>${esc(d.region||'—')}</b></div></div><div class="v6Profile"><span><b>المرحلة:</b> ${esc(d.stage||v6GradeName(d.grade))}</span><span><b>نوع المدرسة:</b> ${esc(d.schoolType||'—')}</span><span><b>الفئة:</b> ${esc(d.gender||'—')}</span><span><b>مصدر البيانات:</b> ${currentFile?esc(currentFile.name):'إدخال يدوي / بيانات تجريبية'}</span></div><div class="v6ReportBody">${v6PackageHtml(d,a,true)}</div><footer class="rFoot"><small class="reportDisclaimer">تحليل مدرسي مبني على البيانات التي راجعها المستخدم واعتمدها. لا يُعد تقريرًا رسميًا صادرًا من هيئة تقويم التعليم والتدريب، ولا يثبت سببًا للنتائج دون تشخيص إضافي.</small><div class="reportSignature"><span class="reportLogo brandMark" aria-hidden="true"></span><div><b>أ/ فاطمة هزازي</b><span>ملتقى معلمي ومعلمات الرياضيات · ملتقى التعليم التفاعلي</span></div></div></footer></article>`;
  window.v6Last={d,a};show('#reportSection');setTimeout(()=>$('#reportSection').scrollIntoView({behavior:'smooth'}),120);
}
function v6ReviewReady(){
  const chk=document.getElementById('reviewConfirmed');if(chk&&chk.checked)return true;
  const gate=document.querySelector('.reviewGate');if(gate){gate.classList.add('v6Shake');setTimeout(()=>gate.classList.remove('v6Shake'),550);gate.scrollIntoView({behavior:'smooth',block:'center'})}
  alert('راجعي جميع القيم المستخرجة أولًا، ثم فعّلي مربع تأكيد المراجعة.');return false;
}
function v6ResetReview(){const chk=document.getElementById('reviewConfirmed');if(chk)chk.checked=false}

// لا تعتمد قراءة الإصدار ٦ قيمًا هندسية بديلة عند تعذر OCR.
v5Levels=async function(numWorker,canvas,col){
  const H=canvas.height,cw=col.x1-col.x0,rect={x:col.x0,y:H*.266,w:cw,h:H*.052},kinds=['red','orange','medium','high'];
  const comps=kinds.map(k=>v4LargestColor(canvas,rect,k,cw,H)),vals=[];
  for(const c of comps){if(!c){vals.push('');continue}const b={x:c.x+c.w*.04,y:c.y+c.h*.01,w:c.w*.92,h:c.h*.96};const v=await v5Number(numWorker,canvas,b,{min:0,max:100});vals.push(v==null?'':Math.round(v*10)/10)}
  return{veryLow:vals[0],low:vals[1],medium:vals[2],high:vals[3]};
};
v5MasteryTargets=async function(numWorker,canvas,col){
  const out={},H=canvas.height,cw=col.x1-col.x0;
  const pur=solidCandidates(colorComponents(canvas,{x:col.x0,y:H*.52,w:cw,h:H*.16},'purple'),cw,H).filter(c=>c.y>H*.54&&c.y<H*.68).sort((a,b)=>b.area-a.area)[0];
  if(pur){const v=await v5Number(numWorker,canvas,{x:pur.x-6,y:pur.y-6,w:pur.w+12,h:pur.h+12},{min:0,max:100});if(v!=null)out.mastery=Math.round(v*10)/10}
  const gs=solidCandidates(colorComponents(canvas,{x:col.x0,y:H*.55,w:cw,h:H*.105},'green'),cw,H).filter(c=>c.x<col.x0+cw*.60&&c.w>cw*.035&&c.h>H*.006).sort((a,b)=>a.y-b.y);
  if(gs.length>=2){const top=await v5GreenCandidates(numWorker,canvas,gs[0],50,100),bot=await v5GreenCandidates(numWorker,canvas,gs[gs.length-1],15,95);if(top[0])out.target2030=top[0].v;if(bot[0])out.target=bot[0].v}
  return out;
};
v5Domains=async function(arWorker,numWorker,canvas,col,grade,subject){
  const H=canvas.height,cw=col.x1-col.x0;let bars=groupDomainBarsV3(canvas,col);const expected=domainTemplate(grade,subject).length;
  if(bars.length>expected)bars=bars.sort((a,b)=>b.h-a.h).slice(0,expected).sort((a,b)=>a.cx-b.cx);
  const out=[];for(let i=0;i<bars.length;i++){const b=bars[i],geom=Math.max(0,Math.min(100,(H*.859-b.y)/(H*(.859-.752))*100)),valBox={x:Math.max(col.x0,b.cx-cw*.105),y:Math.max(0,b.y-H*.037),w:Math.min(cw*.21,col.x1-Math.max(col.x0,b.cx-cw*.105)),h:H*.035};const value=await v5Number(numWorker,canvas,valBox,{hint:geom,min:0,max:100});const labelBox={x:Math.max(col.x0,b.cx-cw*.19),y:H*.858,w:Math.min(cw*.38,col.x1-Math.max(col.x0,b.cx-cw*.19)),h:H*.045};const label=await ocrRegionV3(arWorker,canvas,labelBox,'6','');let name=v4DomainName(label,subject,grade,i);if(!label||/^مجال\s/.test(name))name=v5VisualDomainFallback(grade,subject,i);out.push({name,value:value==null?'':Math.round(value*10)/10,benchmark:''})}
  while(out.length<expected){out.push({name:v5VisualDomainFallback(grade,subject,out.length),value:'',benchmark:''})}return out;
};

function v6Demo(){
  currentFile=null;$('#school').value='مدرسة نموذجية';$('#region').value='إدارة تعليم نموذجية — بيانات افتراضية';$('#grade').value='g3';$('#year').value='2026';$('#totalStudents').value='60';$('#testedStudents').value='58';$('#change').value='3.5';$('#gender').value='غير محدد';$('#schoolType').value='حكومي';$('#stage').value='المرحلة الابتدائية';
  subjects=[makeSubject('الرياضيات',{veryLow:12,low:28,medium:38,high:22,schoolAvg:68.4,adminAvg:66.9,kingdomAvg:67.6,mastery:60,target:70,target2030:80,domains:[{name:'الأعداد والعمليات',value:72,benchmark:70},{name:'الهندسة والقياس',value:64,benchmark:66},{name:'الجبر',value:59,benchmark:68}]}),makeSubject('القراءة',{veryLow:10,low:24,medium:42,high:24,schoolAvg:70.2,adminAvg:68.7,kingdomAvg:69.1,mastery:66,target:72,target2030:82,domains:[{name:'استيعاب المقروء',value:74,benchmark:70},{name:'دلالات الألفاظ',value:62,benchmark:68}]})];
  renderSubjects();v6ResetReview();show('#editSection');setStatus('تم تحميل بيانات افتراضية عامة للتجربة؛ لا ترتبط بأي مدرسة أو مستخدم.','good');setTimeout(()=>$('#editSection').scrollIntoView({behavior:'smooth'}),120);
}

$('#demoBtn').onclick=v6Demo;
$('#analyzeBtn').onclick=()=>{if(!v6ReviewReady())return;const d=capture(),a=v6Analyze(d);v6RenderAnalysis(d,a)};
$('#toReport').onclick=()=>{if(!v6ReviewReady())return;v6BuildReport(capture())};
$('#printBtn').onclick=()=>window.print();
$('#fileInput').addEventListener('change',v6ResetReview);
document.addEventListener('input',e=>{if(e.target.closest&&e.target.closest('#editSection')&&e.target.id!=='reviewConfirmed')v6ResetReview()});

initSubjects();
})();
