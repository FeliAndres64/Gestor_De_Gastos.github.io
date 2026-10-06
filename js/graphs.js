/* =====================================================
   FELIOS ECONOMY — GRÁFICOS / ANALÍTICA v1
   - Estado financiero mensual
   - Evolución patrimonial estimada
   - Ingresos, gastos/salidas, ahorro
   - Compromisos, metas y deudas
   - Comparación mensual e indicadores de tendencia
===================================================== */

const financeUI = {
    month: new Date().toISOString().slice(0,7),
    range: 6
};

function financeNum(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function financeMoney(v){ return typeof fmt!=='undefined'?fmt.format(financeNum(v)):new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP'}).format(financeNum(v)); }
function financeCompact(v){
    const n=Math.abs(financeNum(v));
    if(n>=1e9)return `${(n/1e9).toFixed(n>=1e10?0:1)}B`;
    if(n>=1e6)return `${(n/1e6).toFixed(n>=1e7?0:1)}M`;
    if(n>=1e3)return `${(n/1e3).toFixed(n>=1e4?0:1)}k`;
    return Math.round(n).toLocaleString('es-CO');
}
function financeEsc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function financeDateOnly(v){
    if(!v)return '';
    const s=String(v); const m=s.match(/^(\d{4}-\d{2}-\d{2})/); if(m)return m[1];
    const d=new Date(v); if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function financeMonthKey(v){ const d=financeDateOnly(v); return d?d.slice(0,7):''; }
function financeMonthLabel(key,{short=false}={}){
    if(!/^\d{4}-\d{2}$/.test(key))return key;
    const [y,m]=key.split('-').map(Number); const d=new Date(y,m-1,1);
    return new Intl.DateTimeFormat('es-CO',short?{month:'short'}:{month:'long',year:'numeric'}).format(d).replace(/^./,x=>x.toUpperCase());
}
function financeShiftMonth(key,delta){
    const [y,m]=key.split('-').map(Number); const d=new Date(y,m-1+delta,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function financeMonthEnd(key){
    const [y,m]=key.split('-').map(Number); const d=new Date(y,m,0);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function financeMonthKeys(endKey,count){ return Array.from({length:count},(_,i)=>financeShiftMonth(endKey,i-count+1)); }
function financePctChange(current,previous){
    current=financeNum(current);previous=financeNum(previous);
    if(Math.abs(previous)<.00001)return Math.abs(current)<.00001?0:null;
    return (current-previous)/Math.abs(previous)*100;
}
function financeTrend(current,previous,{inverse=false}={}){
    const delta=financeNum(current)-financeNum(previous); const eps=Math.max(1,Math.abs(previous)*.005);
    if(Math.abs(delta)<=eps)return {cls:'flat',icon:'→',text:'Sin cambio relevante',delta};
    const rawUp=delta>0; const good=inverse?!rawUp:rawUp;
    return {cls:good?'up':'down',icon:rawUp?'↑':'↓',text:`${rawUp?'+':''}${financeMoney(delta)} vs mes anterior`,delta};
}
function financeMonthFilter(date,key){ return financeMonthKey(date)===key; }

function financeCurrentDebts(){
    const sum=arr=>(Array.isArray(arr)?arr:[]).reduce((total,g)=>{
        if(Array.isArray(g.entries))return total+g.entries.reduce((s,e)=>s+Math.max(0,financeNum(e.remaining??e.amount)),0);
        return total+Math.max(0,financeNum(g.total??g.amount));
    },0);
    return {debt:sum(window.debts||[]),credit:sum(window.credits||[])};
}
function financeDesireStats(){
    const desires=[];
    (window.pockets||[]).forEach(p=>(p.desires||[]).forEach(d=>desires.push({p,d})));
    const reserved=desires.reduce((s,x)=>s+Math.max(0,financeNum(x.d.reserved)),0);
    const targetKnown=desires.filter(x=>financeNum(x.d.target)>0);
    const target=targetKnown.reduce((s,x)=>s+financeNum(x.d.target),0);
    const targetReserved=targetKnown.reduce((s,x)=>s+Math.min(financeNum(x.d.reserved),financeNum(x.d.target)),0);
    return {desires,reserved,target,targetReserved,known:targetKnown.length,unknown:desires.length-targetKnown.length};
}
function financePocketAssets(){
    let unlinked=0,linked=0;
    (window.pockets||[]).forEach(p=>{
        const desireReserved=(p.desires||[]).reduce((s,d)=>s+Math.max(0,financeNum(d.reserved)),0);
        const total=Math.max(0,financeNum(p.balance))+desireReserved;
        const validLink=typeof getPocketCapitalPair==='function' && !!getPocketCapitalPair(p);
        if(validLink) linked+=total; else unlinked+=total;
    });
    return {unlinked,linked};
}
function financeCurrentPosition(){
    const capitalTotal=(window.capital||[]).reduce((s,c)=>s+Math.max(0,financeNum(c.balance)),0);
    const saving=Math.max(0,financeNum(window.pocketSystem?.saving?.balance));
    const pocketAssets=financePocketAssets();
    const dc=financeCurrentDebts();
    const commitments=financeDesireStats().reserved;
    const assets=capitalTotal+saving+pocketAssets.unlinked;
    const netWorth=assets+dc.credit-dc.debt;
    return {capitalTotal,saving,pocketAssets,assets,netWorth,debts:dc.debt,credits:dc.credit,commitments};
}

function financeIncomeRecords(){
    return (window.pocketSystem?.incomes||[]).map(i=>({
        date:financeDateOnly(i.date||i.createdAt), amount:Math.max(0,financeNum(i.amount)),
        savingContribution:Math.max(0,financeNum(i.savingContribution)), savingNetChange:financeNum(i.savingNetChange), label:i.label||'Ingreso'
    })).filter(i=>i.date&&i.amount>0);
}
function financeIncomeForMonth(key){ return financeIncomeRecords().filter(i=>financeMonthFilter(i.date,key)).reduce((s,i)=>s+i.amount,0); }
function financeSavingForMonth(key){ return financeIncomeRecords().filter(i=>financeMonthFilter(i.date,key)).reduce((s,i)=>s+i.savingContribution,0); }
function financeSavingNetForMonth(key){ return financeIncomeRecords().filter(i=>financeMonthFilter(i.date,key)).reduce((s,i)=>s+i.savingNetChange,0); }

function financeParseMoneyValues(text=''){
    const matches=String(text).match(/(?:COP\s*)?\$?\s*-?\d[\d.]*,\d{2}|(?:COP\s*)?\$?\s*-?\d[\d.]*/g)||[];
    return matches.map(raw=>{
        const cleaned=raw.replace(/COP|\$|\s/g,'');
        if(cleaned.includes(','))return Number(cleaned.replace(/\./g,'').replace(',','.'))||0;
        return Number(cleaned.replace(/\./g,''))||0;
    });
}
function financeEventDate(raw){return financeDateOnly(raw?.date||raw?.occurredAt||raw?.createdAt);}
function financeHistoryRaw(){return Array.isArray(window.history)?window.history:[];}
function financeIsTransfer(raw){
    const a=String(raw?.action||'').toLowerCase(),d=String(raw?.detail||'').toLowerCase();
    return a==='transfer'||a.startsWith('link-')||a==='link'||d.includes('transferencia manual')||d.includes('sincroniz')||d.includes('vinculad');
}
function financeExplicitExpense(raw){
    if(financeIsTransfer(raw))return 0;
    const module=String(raw?.module||''),action=String(raw?.action||''),detail=String(raw?.detail||'').toLowerCase();
    if(module==='debts'&&action==='payment')return Math.max(0,financeNum(raw.amount));
    if(detail.includes('registrado como gasto'))return Math.max(0,financeNum(raw.amount)||financeParseMoneyValues(raw.detail).at(-1)||0);
    if(detail.includes('objetivo completado'))return Math.max(0,financeNum(raw.amount)||financeParseMoneyValues(raw.detail).at(-1)||0);
    return 0;
}
function financeExpensesForMonth(key){return financeHistoryRaw().filter(h=>financeMonthFilter(financeEventDate(h),key)).reduce((s,h)=>s+financeExplicitExpense(h),0);}

function financeCapitalAdjustmentDelta(raw){
    if(String(raw?.module||'')!=='capital'||String(raw?.action||'')!=='balance')return 0;
    const vals=financeParseMoneyValues(raw.detail); if(vals.length<2)return 0;
    return vals[vals.length-1]-vals[vals.length-2];
}
function financeAssetDeltaFromHistory(raw){
    if(financeIsTransfer(raw))return 0;
    const module=String(raw?.module||''),action=String(raw?.action||'');
    if(module==='debts'&&action==='payment')return -Math.max(0,financeNum(raw.amount));
    if(module==='debts'&&action==='collection')return Math.max(0,financeNum(raw.amount));
    const exp=financeExplicitExpense(raw); if(exp)return -exp;
    return financeCapitalAdjustmentDelta(raw);
}
function financeDebtDelta(raw,direction){
    if(String(raw?.module||'')!=='debts'||String(raw?.direction||'')!==direction)return 0;
    const action=String(raw?.action||''),amount=Math.max(0,financeNum(raw.amount));
    if(action==='create')return amount;
    if(direction==='debt'&&action==='payment')return -amount;
    if(direction==='credit'&&action==='collection')return -amount;
    if(action==='delete')return -amount;
    return 0;
}
function financeReconstructedAtMonthEnd(key){
    const current=financeCurrentPosition(); const end=financeMonthEnd(key);
    let assets=current.assets, debt=current.debts, credit=current.credits;
    financeHistoryRaw().forEach(raw=>{
        const date=financeEventDate(raw); if(!date||date<=end)return;
        assets-=financeAssetDeltaFromHistory(raw);
        debt-=financeDebtDelta(raw,'debt'); credit-=financeDebtDelta(raw,'credit');
    });
    financeIncomeRecords().forEach(i=>{if(i.date>end)assets-=i.amount;});
    assets=Math.max(0,assets); debt=Math.max(0,debt); credit=Math.max(0,credit);
    return {assets,debt,credit,netWorth:assets+credit-debt};
}
function financeFirstKnownMonth(){
    const dates=[...financeIncomeRecords().map(i=>i.date),...financeHistoryRaw().map(financeEventDate).filter(Boolean)].sort();
    return dates.length?financeMonthKey(dates[0]):financeUI.month;
}

function financeDebtAtMonthEnd(key){
    const pos=financeReconstructedAtMonthEnd(key); return {debt:pos.debt,credit:pos.credit};
}

function financeEnsureAnalytics(){
    if(!window.analytics||typeof window.analytics!=='object')window.analytics={version:1,snapshots:[]};
    if(!Array.isArray(window.analytics.snapshots))window.analytics.snapshots=[];
    return window.analytics;
}
function financeCaptureSnapshot(){
    const a=financeEnsureAnalytics(),now=new Date().toISOString(),date=financeDateOnly(now),p=financeCurrentPosition(),d=financeDesireStats();
    const snapshot={date,createdAt:now,assets:p.assets,netWorth:p.netWorth,debts:p.debts,credits:p.credits,saving:p.saving,commitments:d.reserved,goalTarget:d.target,goalReserved:d.targetReserved};
    const ix=a.snapshots.findIndex(x=>x.date===date); if(ix>=0)a.snapshots[ix]=snapshot; else a.snapshots.push(snapshot);
    a.snapshots=a.snapshots.sort((x,y)=>String(x.date).localeCompare(String(y.date))).slice(-800);
}
function financeSnapshotForMonth(key){
    const a=financeEnsureAnalytics(); const matches=a.snapshots.filter(s=>financeMonthKey(s.date)===key).sort((x,y)=>String(x.date).localeCompare(String(y.date)));
    return matches.at(-1)||null;
}

function financeMonthlyRow(key){
    const snapshot=financeSnapshotForMonth(key); const reconstructed=financeReconstructedAtMonthEnd(key);
    const debt=financeDebtAtMonthEnd(key);
    return {
        key,label:financeMonthLabel(key,{short:true}),
        income:financeIncomeForMonth(key),expenses:financeExpensesForMonth(key),saving:financeSavingForMonth(key),savingNet:financeSavingNetForMonth(key),
        netWorth:snapshot?financeNum(snapshot.netWorth):reconstructed.netWorth,
        debts:snapshot?financeNum(snapshot.debts):debt.debt,credits:snapshot?financeNum(snapshot.credits):debt.credit,
        snapshot:Boolean(snapshot)
    };
}

function financeSvgLine(rows,key){
    if(!rows.length)return '<div class="finance-chart-empty"><span>⌁</span><strong>Sin datos suficientes</strong><p>Los datos aparecerán cuando existan movimientos financieros.</p></div>';
    const W=720,H=220,pad={l:48,r:18,t:18,b:34}; const vals=rows.map(r=>financeNum(r[key]));
    let min=Math.min(...vals),max=Math.max(...vals); if(Math.abs(max-min)<1){max=min+1;} const margin=(max-min)*.12; min=Math.max(0,min-margin);max+=margin;
    const x=i=>pad.l+(W-pad.l-pad.r)*(rows.length===1?.5:i/(rows.length-1)); const y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-min)/(max-min));
    const points=rows.map((r,i)=>`${x(i)},${y(financeNum(r[key]))}`).join(' ');
    const area=`${pad.l},${H-pad.b} ${points} ${x(rows.length-1)},${H-pad.b}`;
    const grid=Array.from({length:4},(_,i)=>{const yy=pad.t+(H-pad.t-pad.b)*(i/3);const val=max-(max-min)*(i/3);return `<line class="grid" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"/><text x="4" y="${yy+4}">${financeEsc(financeCompact(val))}</text>`}).join('');
    const labels=rows.map((r,i)=>`<text x="${x(i)}" y="${H-8}" text-anchor="middle">${financeEsc(r.label.replace('.',''))}</text>`).join('');
    const dots=rows.map((r,i)=>`<circle class="point" cx="${x(i)}" cy="${y(financeNum(r[key]))}" r="4"><title>${financeEsc(financeMonthLabel(r.key))}: ${financeEsc(financeMoney(r[key]))}</title></circle>`).join('');
    return `<svg class="finance-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución financiera">${grid}<polygon class="area" points="${area}"/><polyline class="line" points="${points}"/>${dots}${labels}</svg>`;
}
function financeSvgBars(rows,keyA,keyB){
    if(!rows.length)return '<div class="finance-chart-empty"><span>▥</span><strong>Sin movimientos en el periodo</strong></div>';
    const W=720,H=220,pad={l:48,r:18,t:18,b:34}; const max=Math.max(1,...rows.flatMap(r=>[financeNum(r[keyA]),financeNum(r[keyB])])); const groupW=(W-pad.l-pad.r)/rows.length;const bw=Math.min(24,groupW*.28);
    const y=v=>pad.t+(H-pad.t-pad.b)*(1-v/max); const grid=Array.from({length:4},(_,i)=>{const yy=pad.t+(H-pad.t-pad.b)*(i/3),val=max*(1-i/3);return `<line class="grid" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"/><text x="4" y="${yy+4}">${financeEsc(financeCompact(val))}</text>`}).join('');
    const bars=rows.map((r,i)=>{const cx=pad.l+groupW*i+groupW/2,a=financeNum(r[keyA]),b=financeNum(r[keyB]),ya=y(a),yb=y(b);return `<rect class="income" x="${cx-bw-2}" y="${ya}" width="${bw}" height="${H-pad.b-ya}" rx="5"><title>${financeEsc(financeMonthLabel(r.key))} · Ingresos ${financeEsc(financeMoney(a))}</title></rect><rect class="expense" x="${cx+2}" y="${yb}" width="${bw}" height="${H-pad.b-yb}" rx="5"><title>${financeEsc(financeMonthLabel(r.key))} · Gastos ${financeEsc(financeMoney(b))}</title></rect><text x="${cx}" y="${H-8}" text-anchor="middle">${financeEsc(r.label.replace('.',''))}</text>`}).join('');
    return `<svg class="finance-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos y gastos">${grid}${bars}</svg>`;
}
function financeSvgSaving(rows){
    if(!rows.some(r=>r.saving>0))return '<div class="finance-chart-empty"><span>🐷</span><strong>Aún no hay ahorro histórico</strong><p>Se alimenta de los ingresos registrados en Bolsillos.</p></div>';
    const W=720,H=220,pad={l:48,r:18,t:18,b:34};const max=Math.max(1,...rows.map(r=>r.saving));const groupW=(W-pad.l-pad.r)/rows.length,bw=Math.min(38,groupW*.5);const y=v=>pad.t+(H-pad.t-pad.b)*(1-v/max);
    const grid=Array.from({length:4},(_,i)=>{const yy=pad.t+(H-pad.t-pad.b)*(i/3),val=max*(1-i/3);return `<line class="grid" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"/><text x="4" y="${yy+4}">${financeEsc(financeCompact(val))}</text>`}).join('');
    const bars=rows.map((r,i)=>{const cx=pad.l+groupW*i+groupW/2,v=r.saving,yy=y(v);return `<rect class="saving" x="${cx-bw/2}" y="${yy}" width="${bw}" height="${H-pad.b-yy}" rx="6"><title>${financeEsc(financeMonthLabel(r.key))}: ${financeEsc(financeMoney(v))}</title></rect><text x="${cx}" y="${H-8}" text-anchor="middle">${financeEsc(r.label.replace('.',''))}</text>`}).join('');
    return `<svg class="finance-svg" viewBox="0 0 ${W} ${H}">${grid}${bars}</svg>`;
}

function financeDeltaMarkup(current,previous,{inverse=false,percent=false}={}){
    const t=financeTrend(current,previous,{inverse}); const pc=financePctChange(current,previous);
    let txt=t.text;
    if(percent && pc!=null)txt=`${pc>0?'+':''}${pc.toFixed(1)}% vs mes anterior`;
    return `<small class="${t.cls}">${t.icon} ${financeEsc(txt)}</small>`;
}
function financeKpi(label,value,current,previous,opts={}){
    return `<div class="finance-kpi"><span>${financeEsc(label)}</span><strong>${financeEsc(financeMoney(value))}</strong>${financeDeltaMarkup(current,previous,opts)}</div>`;
}

function financeRenderGoals(){
    const stats=financeDesireStats();
    if(!stats.desires.length)return '<div class="finance-chart-empty"><span>✨</span><strong>Aún no hay metas activas</strong><p>Los deseos con objetivo aparecerán aquí.</p></div>';
    const list=stats.desires.filter(x=>financeNum(x.d.target)>0).sort((a,b)=>{
        const ap=financeNum(a.d.target)?financeNum(a.d.reserved)/financeNum(a.d.target):0,bp=financeNum(b.d.target)?financeNum(b.d.reserved)/financeNum(b.d.target):0;return bp-ap;
    }).slice(0,6);
    const known=list.map(x=>{const pct=Math.min(100,financeNum(x.d.reserved)/Math.max(1,financeNum(x.d.target))*100);return `<div class="finance-goal" style="--goal-color:${financeEsc(x.d.color||'var(--felios-primary)')}"><div class="finance-goal-top"><span>${financeEsc(x.d.icon||'✨')} ${financeEsc(x.d.name)}</span><strong>${pct.toFixed(0)}%</strong></div><div class="finance-goal-track"><i style="width:${pct}%"></i></div><div class="finance-goal-note">${financeEsc(financeMoney(x.d.reserved))} de ${financeEsc(financeMoney(x.d.target))} · ${financeEsc(x.p.name)}</div></div>`}).join('');
    const unknown=stats.unknown?`<div class="finance-goal-note">＋ ${stats.unknown} meta${stats.unknown===1?'':'s'} con precio todavía indefinido.</div>`:'';
    return `<div class="finance-goals">${known||'<div class="finance-chart-empty"><strong>Las metas actuales no tienen precio definido</strong></div>'}${unknown}</div>`;
}
function financeRenderCommitments(){
    const pos=financeCurrentPosition(),stats=financeDesireStats(); const liquid=Math.max(0,pos.assets); const pct=liquid>0?Math.min(100,stats.reserved/liquid*100):0;
    const byPocket=(window.pockets||[]).map(p=>({name:`${p.icon||'🐷'} ${p.name}`,amount:(p.desires||[]).reduce((s,d)=>s+financeNum(d.reserved),0)})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount).slice(0,5);
    const max=Math.max(1,...byPocket.map(x=>x.amount));
    return `<div class="finance-donut-wrap"><div class="finance-donut" style="--donut-pct:${pct}%"><div class="finance-donut-center"><strong>${pct.toFixed(0)}%</strong><span>comprometido*</span></div></div><div class="finance-breakdown">${byPocket.length?byPocket.map(x=>`<div class="finance-breakdown-row"><span>${financeEsc(x.name)}</span><strong>${financeEsc(financeMoney(x.amount))}</strong><div class="finance-breakdown-track"><i style="width:${x.amount/max*100}%"></i></div></div>`).join(''):'<div class="finance-chart-empty compact"><strong>Sin dinero comprometido</strong><p>Los aportes reservados en deseos aparecerán aquí.</p></div>'}</div></div><div class="finance-disclaimer">* El compromiso es dinero reservado en deseos. No se suma otra vez al patrimonio.</div>`;
}
function financeRenderDebts(currentMonth,prevMonth){
    const dc=financeCurrentDebts(),max=Math.max(1,dc.debt,dc.credit); const debtPrev=financeDebtAtMonthEnd(financeShiftMonth(currentMonth,-1));
    return `<div class="finance-debt-bars"><div class="finance-debt-row debt"><span>Debo</span><div class="finance-debt-track"><i style="width:${dc.debt/max*100}%"></i></div><strong>${financeEsc(financeMoney(dc.debt))}</strong></div><div class="finance-debt-row credit"><span>Me deben</span><div class="finance-debt-track"><i style="width:${dc.credit/max*100}%"></i></div><strong>${financeEsc(financeMoney(dc.credit))}</strong></div></div><div class="finance-insights"><span class="finance-insight"><strong>Deuda:</strong> ${financeEsc(financeTrend(dc.debt,debtPrev.debt,{inverse:true}).text)}</span><span class="finance-insight"><strong>Por cobrar:</strong> ${financeEsc(financeTrend(dc.credit,debtPrev.credit).text)}</span></div>`;
}
function financeInsights(month,prev,pos){
    const items=[];
    const net=financeTrend(month.netWorth,prev.netWorth);items.push(`${net.icon} Patrimonio ${net.delta>=0?'aumentó':'disminuyó'} <strong>${financeEsc(financeMoney(Math.abs(net.delta)))}</strong> frente al mes anterior.`);
    if(month.income>0){const rate=month.saving/month.income*100;items.push(`🐷 Destinaste <strong>${rate.toFixed(1)}%</strong> de los ingresos del mes a ahorro generado.`);}
    if(month.expenses>month.income&&month.expenses>0)items.push(`⚠️ Los gastos/salidas registradas superaron los ingresos del mes por <strong>${financeEsc(financeMoney(month.expenses-month.income))}</strong>.`);
    if(pos.debts>0){const dprev=financeDebtAtMonthEnd(financeShiftMonth(month.key,-1)).debt;if(pos.debts<dprev)items.push(`↓ Tus deudas pendientes bajaron <strong>${financeEsc(financeMoney(dprev-pos.debts))}</strong> frente al cierre anterior.`);else if(pos.debts>dprev)items.push(`↑ Tus deudas pendientes aumentaron <strong>${financeEsc(financeMoney(pos.debts-dprev))}</strong> frente al cierre anterior.`);}
    if(pos.commitments>0)items.push(`🎯 Tienes <strong>${financeEsc(financeMoney(pos.commitments))}</strong> reservados actualmente en metas y deseos.`);
    return items.slice(0,5).map(x=>`<span class="finance-insight">${x}</span>`).join('');
}

function renderFinancialDashboard(){
    const root=document.getElementById('financial-dashboard'); if(!root)return;
    financeCaptureSnapshot();
    const selected=financeUI.month||new Date().toISOString().slice(0,7),prevKey=financeShiftMonth(selected,-1);
    const range=Math.max(3,Math.min(12,financeNum(financeUI.range)||6)); const keys=financeMonthKeys(selected,range); const firstKnown=financeFirstKnownMonth();
    const visibleKeys=keys.filter(k=>k>=firstKnown||financeSnapshotForMonth(k)); const rows=(visibleKeys.length?visibleKeys:[selected]).map(financeMonthlyRow);
    const month=financeMonthlyRow(selected),prev=financeMonthlyRow(prevKey),pos=financeCurrentPosition(),goals=financeDesireStats();
    const monthName=financeMonthLabel(selected); const savingRate=month.income>0?month.saving/month.income*100:0; const expenseRate=month.income>0?month.expenses/month.income*100:0;
    const stateBadge=month.netWorth>=prev.netWorth?'Tendencia patrimonial positiva':month.netWorth<prev.netWorth?'Patrimonio por debajo del mes anterior':'Sin cambio patrimonial';

    const monthInput=root.querySelector('#finance-month'); if(monthInput&&monthInput.value!==selected)monthInput.value=selected;
    const rangeInput=root.querySelector('#finance-range'); if(rangeInput&&String(rangeInput.value)!==String(range))rangeInput.value=String(range);

    root.querySelector('#financial-state').innerHTML=`<div class="financial-state-head"><div><small>ESTADO FINANCIERO MENSUAL</small><h5>${financeEsc(monthName)}</h5></div><span class="financial-state-badge">${financeEsc(stateBadge)}</span></div><div class="finance-kpi-grid">
        ${financeKpi('Patrimonio estimado',month.netWorth,month.netWorth,prev.netWorth,{percent:true})}
        ${financeKpi('Ingresos',month.income,month.income,prev.income,{percent:true})}
        ${financeKpi('Ahorro generado',month.saving,month.saving,prev.saving,{percent:true})}
        ${financeKpi('Gastos / salidas',month.expenses,month.expenses,prev.expenses,{inverse:true,percent:true})}
        ${financeKpi('Deudas pendientes',pos.debts,pos.debts,financeDebtAtMonthEnd(prevKey).debt,{inverse:true,percent:true})}
        ${financeKpi('Dinero comprometido',pos.commitments,pos.commitments,financeSnapshotForMonth(prevKey)?.commitments??pos.commitments,{inverse:true,percent:true})}
    </div><div class="finance-insights">${financeInsights(month,prev,pos)}</div>`;

    root.querySelector('#chart-patrimony').innerHTML=financeSvgLine(rows,'netWorth');
    root.querySelector('#chart-cashflow').innerHTML=financeSvgBars(rows,'income','expenses');
    root.querySelector('#chart-saving').innerHTML=financeSvgSaving(rows);
    root.querySelector('#chart-commitments').innerHTML=financeRenderCommitments();
    root.querySelector('#chart-goals').innerHTML=financeRenderGoals();
    root.querySelector('#chart-debts').innerHTML=financeRenderDebts(selected,prevKey);

    const pVal=root.querySelector('#patrimony-current');if(pVal)pVal.innerHTML=`<strong>${financeEsc(financeMoney(month.netWorth))}</strong><small>${rows.some(r=>!r.snapshot)?'reconstruido con movimientos disponibles':'con snapshots guardados'}</small>`;
    const cVal=root.querySelector('#cashflow-current');if(cVal)cVal.innerHTML=`<strong>${financeEsc(financeMoney(month.income-month.expenses))}</strong><small>balance ingreso − gasto</small>`;
    const sVal=root.querySelector('#saving-current');if(sVal)sVal.innerHTML=`<strong>${savingRate.toFixed(1)}%</strong><small>${expenseRate.toFixed(1)}% gastos / ingresos</small>`;
    const gVal=root.querySelector('#goals-current');if(gVal)gVal.innerHTML=`<strong>${goals.known?Math.min(100,goals.targetReserved/Math.max(1,goals.target)*100).toFixed(0):'0'}%</strong><small>${goals.known} meta${goals.known===1?'':'s'} con objetivo</small>`;
}

function financeBindDashboard(){
    const root=document.getElementById('financial-dashboard'); if(!root||root.dataset.bound==='1')return;root.dataset.bound='1';
    const month=root.querySelector('#finance-month'),range=root.querySelector('#finance-range');
    if(month)month.addEventListener('change',()=>{if(/^\d{4}-\d{2}$/.test(month.value)){financeUI.month=month.value;renderFinancialDashboard();}});
    if(range)range.addEventListener('change',()=>{financeUI.range=Number(range.value)||6;renderFinancialDashboard();});
}

document.addEventListener('DOMContentLoaded',()=>{financeBindDashboard();renderFinancialDashboard();});
window.renderFinancialDashboard=renderFinancialDashboard;
window.financeCurrentPosition=financeCurrentPosition;
