/* =====================================================
   FELIOS ECONOMY — ANALÍTICA v2
   Periodos reales + actualización inmediata + metas completadas
===================================================== */

financeUI.preset = financeUI.preset || 'month';
financeUI.customFrom = financeUI.customFrom || '';
financeUI.customTo = financeUI.customTo || '';

function financeToday(){ return new Date().toISOString().slice(0,10); }
function financeDateShift(date,days){
    const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function financeMonthStart(key){ return `${key}-01`; }
function financeDateMin(a,b){return !a?b:!b?a:(a<b?a:b);}
function financeDateMax(a,b){return !a?b:!b?a:(a>b?a:b);}
function financeDaysBetween(a,b){
    const x=new Date(`${a}T12:00:00`),y=new Date(`${b}T12:00:00`);
    return Math.max(1,Math.round((y-x)/86400000)+1);
}
function financeAllKnownDates(){
    return [...financeIncomeRecords().map(i=>i.date),...financeHistoryRaw().map(financeEventDate).filter(Boolean),(financeEnsureAnalytics().snapshots||[]).map(s=>financeDateOnly(s.date)).filter(Boolean)].filter(Boolean).sort();
}
function financePeriodBounds(){
    const today=financeToday();
    const anchorMonth=/^\d{4}-\d{2}$/.test(financeUI.month)?financeUI.month:today.slice(0,7);
    const monthEnd=financeMonthEnd(anchorMonth);
    const end=anchorMonth===today.slice(0,7)?today:monthEnd;
    const p=financeUI.preset||'month';
    if(p==='today') return {from:today,to:today};
    if(p==='month') return {from:financeMonthStart(anchorMonth),to:end};
    const n=/^(2|3|6|12)m$/.test(p)?Number(p.slice(0,-1)):0;
    if(n) return {from:financeMonthStart(financeShiftMonth(anchorMonth,-n+1)),to:end};
    if(p==='year') return {from:`${anchorMonth.slice(0,4)}-01-01`,to:end};
    const years=/^(2|3)y$/.test(p)?Number(p.slice(0,-1)):0;
    if(years){const y=Number(anchorMonth.slice(0,4));return {from:`${y-years+1}-01-01`,to:end};}
    if(p==='all'){
        const dates=financeAllKnownDates();
        return {from:dates[0]||financeMonthStart(anchorMonth),to:today};
    }
    if(p==='custom'){
        let from=financeDateOnly(financeUI.customFrom),to=financeDateOnly(financeUI.customTo);
        if(from&&to&&from>to)[from,to]=[to,from];
        return {from:from||financeMonthStart(anchorMonth),to:to||end};
    }
    return {from:financeMonthStart(anchorMonth),to:end};
}
function financePreviousBounds(bounds){
    const days=financeDaysBetween(bounds.from,bounds.to);
    const to=financeDateShift(bounds.from,-1);
    return {from:financeDateShift(to,-days+1),to};
}
function financeDateInBounds(date,bounds){ const d=financeDateOnly(date); return !!d && d>=bounds.from && d<=bounds.to; }
function financeIncomeForBounds(bounds){return financeIncomeRecords().filter(i=>financeDateInBounds(i.date,bounds)).reduce((s,i)=>s+i.amount,0);}
function financeSavingForBounds(bounds){return financeIncomeRecords().filter(i=>financeDateInBounds(i.date,bounds)).reduce((s,i)=>s+i.savingContribution,0);}
function financeExpensesForBounds(bounds){return financeHistoryRaw().filter(h=>financeDateInBounds(financeEventDate(h),bounds)).reduce((s,h)=>s+financeExplicitExpense(h),0);}
function financeGoalCompletions(bounds){
    const rows=financeHistoryRaw().filter(h=>{
        if(!financeDateInBounds(financeEventDate(h),bounds))return false;
        const d=String(h?.detail||'').toLowerCase();
        return d.includes('objetivo completado') || d.includes('meta completada');
    });
    let amount=0;
    rows.forEach(h=>{amount+=Math.max(0,financeNum(h.amount)||financeParseMoneyValues(h.detail).find(v=>v>0)||0);});
    return {count:rows.length,amount,rows};
}
function financeSnapshotAtOrBefore(date){
    const snaps=(financeEnsureAnalytics().snapshots||[]).filter(s=>financeDateOnly(s.date)<=date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    return snaps.at(-1)||null;
}
function financeReconstructedAtDate(date){
    const current=financeCurrentPosition();
    let assets=current.assets,debt=current.debts,credit=current.credits;
    financeHistoryRaw().forEach(raw=>{
        const d=financeEventDate(raw);if(!d||d<=date)return;
        assets-=financeAssetDeltaFromHistory(raw);
        debt-=financeDebtDelta(raw,'debt');
        credit-=financeDebtDelta(raw,'credit');
    });
    financeIncomeRecords().forEach(i=>{if(i.date>date)assets-=i.amount;});
    assets=Math.max(0,assets);debt=Math.max(0,debt);credit=Math.max(0,credit);
    return {assets,debt,credit,netWorth:assets+credit-debt};
}
function financePositionAtDate(date){
    const snap=financeSnapshotAtOrBefore(date);
    if(snap && financeDateOnly(snap.date)===date){
        return {assets:financeNum(snap.assets),netWorth:financeNum(snap.netWorth),debt:financeNum(snap.debts),credit:financeNum(snap.credits),commitments:financeNum(snap.commitments),snapshot:true};
    }
    const r=financeReconstructedAtDate(date);
    const commitmentSnap=snap?financeNum(snap.commitments):0;
    return {...r,commitments:commitmentSnap,snapshot:false};
}
function financePeriodLabel(bounds){
    const p=financeUI.preset||'month';
    if(p==='today')return 'Hoy';
    if(p==='month')return financeMonthLabel(bounds.from.slice(0,7));
    if(p==='year')return `Año ${bounds.from.slice(0,4)}`;
    if(/^(2|3)y$/.test(p))return `Últimos ${p.slice(0,-1)} años`;
    if(p==='all')return 'Todo el historial';
    if(p==='custom')return `${new Date(`${bounds.from}T12:00:00`).toLocaleDateString('es-CO')} – ${new Date(`${bounds.to}T12:00:00`).toLocaleDateString('es-CO')}`;
    const n=p.replace('m','');return `Últimos ${n} meses`;
}
function financePeriodRows(bounds){
    const days=financeDaysBetween(bounds.from,bounds.to);
    if(days<=45){
        const out=[];let d=bounds.from;
        while(d<=bounds.to){
            const pos=financePositionAtDate(d);
            out.push({key:d,label:new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short'}).format(new Date(`${d}T12:00:00`)),income:financeIncomeForBounds({from:d,to:d}),expenses:financeExpensesForBounds({from:d,to:d}),saving:financeSavingForBounds({from:d,to:d}),netWorth:pos.netWorth,snapshot:pos.snapshot});
            d=financeDateShift(d,1);
        }
        return out;
    }
    const rows=[];let key=bounds.from.slice(0,7),endKey=bounds.to.slice(0,7),guard=0;
    while(key<=endKey&&guard++<240){rows.push(financeMonthlyRow(key));key=financeShiftMonth(key,1);}
    return rows;
}
function financeSeriesLabel(row){
    if(/^\d{4}-\d{2}-\d{2}$/.test(row.key))return row.label;
    return String(row.label||'').replace('.','');
}
function financeSvgLineV2(rows,key){
    if(!rows.length)return '<div class="finance-chart-empty"><span>⌁</span><strong>Sin datos suficientes</strong><p>Los datos aparecerán cuando existan movimientos financieros.</p></div>';
    const W=720,H=220,pad={l:48,r:18,t:18,b:34};const vals=rows.map(r=>financeNum(r[key]));let min=Math.min(...vals),max=Math.max(...vals);if(Math.abs(max-min)<1)max=min+1;const margin=(max-min)*.12;min=Math.max(0,min-margin);max+=margin;
    const x=i=>pad.l+(W-pad.l-pad.r)*(rows.length===1?.5:i/(rows.length-1));const y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-min)/(max-min));const points=rows.map((r,i)=>`${x(i)},${y(financeNum(r[key]))}`).join(' ');const area=`${pad.l},${H-pad.b} ${points} ${x(rows.length-1)},${H-pad.b}`;
    const grid=Array.from({length:4},(_,i)=>{const yy=pad.t+(H-pad.t-pad.b)*(i/3),val=max-(max-min)*(i/3);return `<line class="grid" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"/><text x="4" y="${yy+4}">${financeEsc(financeCompact(val))}</text>`}).join('');
    const step=Math.max(1,Math.ceil(rows.length/8));const labels=rows.map((r,i)=>(i%step===0||i===rows.length-1)?`<text x="${x(i)}" y="${H-8}" text-anchor="middle">${financeEsc(financeSeriesLabel(r))}</text>`:'').join('');
    const dots=rows.map((r,i)=>`<circle class="point" cx="${x(i)}" cy="${y(financeNum(r[key]))}" r="4"><title>${financeEsc(financeSeriesLabel(r))}: ${financeEsc(financeMoney(r[key]))}</title></circle>`).join('');
    return `<svg class="finance-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución financiera">${grid}<polygon class="area" points="${area}"/><polyline class="line" points="${points}"/>${dots}${labels}</svg>`;
}
function financeSvgBarsV2(rows,keyA,keyB){
    if(!rows.length)return '<div class="finance-chart-empty"><span>▥</span><strong>Sin movimientos en el periodo</strong></div>';
    const W=720,H=220,pad={l:48,r:18,t:18,b:34};const max=Math.max(1,...rows.flatMap(r=>[financeNum(r[keyA]),financeNum(r[keyB])]));const groupW=(W-pad.l-pad.r)/rows.length,bw=Math.min(24,Math.max(3,groupW*.28));const y=v=>pad.t+(H-pad.t-pad.b)*(1-v/max);const grid=Array.from({length:4},(_,i)=>{const yy=pad.t+(H-pad.t-pad.b)*(i/3),val=max*(1-i/3);return `<line class="grid" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"/><text x="4" y="${yy+4}">${financeEsc(financeCompact(val))}</text>`}).join('');const step=Math.max(1,Math.ceil(rows.length/8));
    const bars=rows.map((r,i)=>{const cx=pad.l+groupW*i+groupW/2,a=financeNum(r[keyA]),b=financeNum(r[keyB]),ya=y(a),yb=y(b),label=(i%step===0||i===rows.length-1)?`<text x="${cx}" y="${H-8}" text-anchor="middle">${financeEsc(financeSeriesLabel(r))}</text>`:'';return `<rect class="income" x="${cx-bw-2}" y="${ya}" width="${bw}" height="${H-pad.b-ya}" rx="5"><title>${financeEsc(financeSeriesLabel(r))} · Ingresos ${financeEsc(financeMoney(a))}</title></rect><rect class="expense" x="${cx+2}" y="${yb}" width="${bw}" height="${H-pad.b-yb}" rx="5"><title>${financeEsc(financeSeriesLabel(r))} · Gastos ${financeEsc(financeMoney(b))}</title></rect>${label}`}).join('');
    return `<svg class="finance-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos y gastos">${grid}${bars}</svg>`;
}
function financeSvgSavingV2(rows){
    if(!rows.some(r=>r.saving>0))return '<div class="finance-chart-empty"><span>🐷</span><strong>Aún no hay ahorro en este periodo</strong></div>';
    return financeSvgBarsV2(rows,'saving','__zero').replaceAll('class="income"','class="saving"').replaceAll('class="expense"','class="expense hidden-bar"').replaceAll('Ingresos','Ahorro');
}
function financeCountKpi(label,count,sub,current,previous,{inverse=false}={}){
    const t=financeTrend(current,previous,{inverse});
    return `<div class="finance-kpi"><span>${financeEsc(label)}</span><strong>${financeEsc(String(count))}</strong><small class="${t.cls}">${t.icon} ${financeEsc(sub)}</small></div>`;
}
function financeCompletionSummary(bounds,previousBounds){
    const now=financeGoalCompletions(bounds),prev=financeGoalCompletions(previousBounds);
    if(!now.count&&!prev.count)return '<span class="finance-insight">✨ No hay metas completadas en el periodo seleccionado.</span>';
    const diff=now.count-prev.count;
    return `<span class="finance-insight"><strong>🎉 ${now.count} meta${now.count===1?'':'s'} completada${now.count===1?'':'s'}</strong> · ${financeEsc(financeMoney(now.amount))} registrados${diff?` · ${diff>0?'+':''}${diff} vs periodo anterior`:''}</span>`;
}
function financeRenderGoalsV2(bounds){
    const current=financeRenderGoals();
    const completed=financeGoalCompletions(bounds);
    return `<div class="finance-period-completed"><span>🎉 Completadas en el periodo</span><strong>${completed.count}</strong><small>${financeEsc(financeMoney(completed.amount))}</small></div>${current}`;
}

function renderFinancialDashboard(){
    const root=document.getElementById('financial-dashboard');if(!root)return;
    financeCaptureSnapshot();
    const bounds=financePeriodBounds(),previousBounds=financePreviousBounds(bounds),rows=financePeriodRows(bounds);
    const endPos=financePositionAtDate(bounds.to),prevPos=financePositionAtDate(previousBounds.to);
    const income=financeIncomeForBounds(bounds),prevIncome=financeIncomeForBounds(previousBounds);
    const saving=financeSavingForBounds(bounds),prevSaving=financeSavingForBounds(previousBounds);
    const expenses=financeExpensesForBounds(bounds),prevExpenses=financeExpensesForBounds(previousBounds);
    const completed=financeGoalCompletions(bounds),prevCompleted=financeGoalCompletions(previousBounds);
    const current=financeCurrentPosition(),goals=financeDesireStats();
    const savingRate=income>0?saving/income*100:0,expenseRate=income>0?expenses/income*100:0;
    const label=financePeriodLabel(bounds);const stateBadge=endPos.netWorth>=prevPos.netWorth?'Tendencia patrimonial positiva':endPos.netWorth<prevPos.netWorth?'Patrimonio por debajo del periodo anterior':'Sin cambio patrimonial';

    const monthInput=root.querySelector('#finance-month');if(monthInput&&monthInput.value!==financeUI.month)monthInput.value=financeUI.month;
    const periodInput=root.querySelector('#finance-period');if(periodInput&&periodInput.value!==financeUI.preset)periodInput.value=financeUI.preset;
    const custom=root.querySelector('#finance-custom-range');if(custom)custom.hidden=financeUI.preset!=='custom';
    const from=root.querySelector('#finance-from'),to=root.querySelector('#finance-to');if(from&&financeUI.customFrom)from.value=financeUI.customFrom;if(to&&financeUI.customTo)to.value=financeUI.customTo;

    root.querySelector('#financial-state').innerHTML=`<div class="financial-state-head"><div><small>ESTADO FINANCIERO DEL PERIODO</small><h5>${financeEsc(label)}</h5></div><span class="financial-state-badge">${financeEsc(stateBadge)}</span></div><div class="finance-kpi-grid finance-kpi-grid-v2">
        ${financeKpi('Patrimonio estimado',endPos.netWorth,endPos.netWorth,prevPos.netWorth,{percent:true})}
        ${financeKpi('Ingresos',income,income,prevIncome,{percent:true})}
        ${financeKpi('Ahorro generado',saving,saving,prevSaving,{percent:true})}
        ${financeKpi('Gastos / salidas',expenses,expenses,prevExpenses,{inverse:true,percent:true})}
        ${financeKpi('Deudas pendientes',endPos.debt,endPos.debt,prevPos.debt,{inverse:true,percent:true})}
        ${financeKpi('Por cobrar',endPos.credit,endPos.credit,prevPos.credit,{percent:true})}
        ${financeKpi('Dinero comprometido',bounds.to===financeToday()?current.commitments:endPos.commitments,bounds.to===financeToday()?current.commitments:endPos.commitments,prevPos.commitments,{inverse:true,percent:true})}
        ${financeCountKpi('Metas completadas',completed.count,`${financeMoney(completed.amount)} en el periodo`,completed.count,prevCompleted.count)}
    </div><div class="finance-insights">${financeCompletionSummary(bounds,previousBounds)}${income>0?`<span class="finance-insight">🐷 Ahorro: <strong>${savingRate.toFixed(1)}%</strong> de los ingresos · gastos: <strong>${expenseRate.toFixed(1)}%</strong>.</span>`:''}</div>`;

    root.querySelector('#chart-patrimony').innerHTML=financeSvgLineV2(rows,'netWorth');
    root.querySelector('#chart-cashflow').innerHTML=financeSvgBarsV2(rows,'income','expenses');
    root.querySelector('#chart-saving').innerHTML=financeSvgSavingV2(rows);
    root.querySelector('#chart-commitments').innerHTML=financeRenderCommitments();
    root.querySelector('#chart-goals').innerHTML=financeRenderGoalsV2(bounds);
    root.querySelector('#chart-debts').innerHTML=financeRenderDebts(bounds.to.slice(0,7),previousBounds.to.slice(0,7));

    const pVal=root.querySelector('#patrimony-current');if(pVal)pVal.innerHTML=`<strong>${financeEsc(financeMoney(endPos.netWorth))}</strong><small>${endPos.snapshot?'snapshot guardado':'reconstruido con movimientos'}</small>`;
    const cVal=root.querySelector('#cashflow-current');if(cVal)cVal.innerHTML=`<strong>${financeEsc(financeMoney(income-expenses))}</strong><small>balance del periodo</small>`;
    const sVal=root.querySelector('#saving-current');if(sVal)sVal.innerHTML=`<strong>${savingRate.toFixed(1)}%</strong><small>${financeEsc(financeMoney(saving))} ahorrados</small>`;
    const gVal=root.querySelector('#goals-current');if(gVal)gVal.innerHTML=`<strong>${completed.count} ✓</strong><small>${goals.known} meta${goals.known===1?'':'s'} activa${goals.known===1?'':'s'}</small>`;
}

function financeBindDashboardV2(){
    const root=document.getElementById('financial-dashboard');if(!root||root.dataset.boundV2==='1')return;root.dataset.boundV2='1';
    const period=root.querySelector('#finance-period'),month=root.querySelector('#finance-month'),from=root.querySelector('#finance-from'),to=root.querySelector('#finance-to');
    if(period)period.addEventListener('change',()=>{financeUI.preset=period.value;renderFinancialDashboard();});
    if(month)month.addEventListener('change',()=>{if(/^\d{4}-\d{2}$/.test(month.value)){financeUI.month=month.value;renderFinancialDashboard();}});
    const customChange=()=>{financeUI.customFrom=from?.value||'';financeUI.customTo=to?.value||'';if(financeUI.preset==='custom')renderFinancialDashboard();};
    if(from)from.addEventListener('change',customChange);if(to)to.addEventListener('change',customChange);
}

document.addEventListener('DOMContentLoaded',()=>{financeBindDashboardV2();renderFinancialDashboard();});
window.renderFinancialDashboard=renderFinancialDashboard;
window.financePeriodBounds=financePeriodBounds;
