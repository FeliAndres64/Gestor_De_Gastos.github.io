/* =====================================================
   FELIOS ECONOMY — BOLSILLOS v2
   Planificación económica personalizable.
===================================================== */

const POCKET_DEFAULT_COLOR = '#C8A951';
const POCKET_MAX_PREVIEW_DESIRES = 2;
const DESIRE_NOTE_MAX = 90;

function pocketEscape(v){
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function pocketMoney(v){ return fmt.format(Number(v || 0)); }
function pocketId(){ return Date.now()+Math.floor(Math.random()*100000); }
function pocketColor(value){ const c=String(value||'').trim(); return /^#[0-9a-fA-F]{6}$/.test(c)?c.toUpperCase():POCKET_DEFAULT_COLOR; }
function pocketById(id){ return pockets.find(p=>String(p.id)===String(id)) || null; }
function desireById(p,id){ return p?.desires?.find(d=>String(d.id)===String(id)) || null; }
function visiblePockets(){ return [...pockets].filter(p=>!p.hidden).sort((a,b)=>Number(a.order)-Number(b.order)); }
function percentPocketTotal(exceptId=null){
    return pockets.filter(p=>p.type==='percent' && String(p.id)!==String(exceptId)).reduce((s,p)=>s+Number(p.percent||0),0);
}
function normalizePocketOrders(){
    pockets.sort((a,b)=>Number(a.order)-Number(b.order));pockets.forEach((p,i)=>p.order=i);
}
function pocketHistoryAction(detail=''){
    const text=String(detail||'').toLowerCase();
    if(text.includes('transfer')) return 'transfer';
    if(text.includes('deseo')||text.includes('cubrir')||text.includes('complet')) return 'desire';
    if(text.includes('aporte')||text.includes('aportado')) return 'contribution';
    if(text.includes('elimin')) return 'delete';
    if(text.includes('actualiz')||text.includes('edit')) return 'edit';
    return 'movement';
}
function pocketHistory(p,type,detail,amount=0){
    const evt={id:pocketId(),date:new Date().toISOString(),type,detail,amount:Number(amount||0)};
    p.history = Array.isArray(p.history)?p.history:[];p.history.unshift(evt);
    history.unshift({
        id:pocketId(),date:evt.date.slice(0,10),createdAt:evt.date,type,module:'pockets',section:'bolsillos',
        action:pocketHistoryAction(detail),objectType:'pocket',objectId:p.id,objectName:p.name,amount:Number(amount||0),
        detail:`${p.icon||'🐷'} ${p.name}: ${detail}`
    });
    if(p?.link && typeof annotateLatestHistoryWithPocketLink==='function'){
        const state=typeof getPocketCapitalPair==='function'?getPocketCapitalPair(p):null;
        annotateLatestHistoryWithPocketLink(p,{initiator:'pocket',synced:p.link.status!=='pending',pendingDelta:Number(p.link.pendingDelta||0)});
    }
}
function savingHistory(type,detail,amount=0){
    const evt={id:pocketId(),date:new Date().toISOString(),type,detail,amount:Number(amount||0)};
    pocketSystem.saving.history.unshift(evt);
    history.unshift({
        id:pocketId(),date:evt.date.slice(0,10),createdAt:evt.date,type,module:'pockets',section:'bolsillos',
        action:pocketHistoryAction(detail),objectType:'saving',objectId:'saving',objectName:'Ahorro',amount:Number(amount||0),
        detail:`💰 Ahorro: ${detail}`
    });
}
function syncPocketState(){ if(typeof syncPocketAliases==='function')syncPocketAliases(); }

function getSavingBaseReference(){
    const base=Math.max(0,Number(pocketSystem?.baseIncome||0));
    const pct=Math.max(0,Number(pocketSystem?.general?.savingPercent||0));
    return Math.round(base*pct/100);
}

function capitalAvailableForPocketTransfer(acc){
    if(!acc)return 0;
    if(typeof getCapitalAvailable==='function')return Math.max(0,Number(getCapitalAvailable(acc)||0));
    const separated=Array.isArray(acc.subPockets)?acc.subPockets.reduce((sum,x)=>sum+Math.max(0,Number(x.amount||0)),0):0;
    return Math.max(0,Number(acc.balance||0)-separated);
}

function refreshPocketSurface(p=null,{detail=false}={}){
    syncPocketState();
    if(typeof renderPockets==='function')renderPockets();
    if(typeof renderAccounts==='function')renderAccounts();
    if(typeof calcAndRenderTotals==='function')calcAndRenderTotals();
    if(typeof renderHistory==='function')renderHistory();
    if(typeof renderFinancialDashboard==='function')renderFinancialDashboard();
    if(detail&&p)openPocketDetail(p);
}


/* =====================================================
   MODAL BASE
===================================================== */
function closePocketModal(){
    document.querySelectorAll('.pocket-modal-overlay').forEach(el=>{el.classList.remove('show');setTimeout(()=>el.remove(),150);});
    document.body.classList.remove('pocket-modal-open');
}
function openPocketModal({title='',kicker='BOLSILLOS',body='',wide=false,onReady=null}){
    closePocketModal();
    const overlay=document.createElement('div');overlay.className='pocket-modal-overlay';
    overlay.innerHTML=`<div class="pocket-modal-card ${wide?'wide':''}" role="dialog" aria-modal="true"><div class="pocket-modal-head"><div><small>${pocketEscape(kicker)}</small><h3>${title}</h3></div><button type="button" class="pocket-modal-close">×</button></div><div class="pocket-modal-body">${body}</div></div>`;
    document.body.append(overlay);document.body.classList.add('pocket-modal-open');
    overlay.querySelector('.pocket-modal-close').onclick=closePocketModal;
    overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)closePocketModal();});
    requestAnimationFrame(()=>overlay.classList.add('show'));
    if(onReady)onReady(overlay);
    return overlay;
}

function pocketConfirm({title='Confirmar',message='',confirmText='Confirmar',danger=false}={}){
    if(typeof feliosConfirm==='function')return feliosConfirm({title,message,confirmText,danger});
    return new Promise(resolve=>{
        openPocketModal({title,kicker:'CONFIRMACIÓN',body:`<p class="modal-help">${pocketEscape(message)}</p><div class="pocket-modal-actions"><button class="pocket-cancel">Cancelar</button><button class="pocket-primary ${danger?'danger':''}" id="pocket-confirm-fallback">${pocketEscape(confirmText)}</button></div>`,onReady:o=>{o.querySelector('.pocket-cancel').onclick=()=>{closePocketModal();resolve(false)};o.querySelector('#pocket-confirm-fallback').onclick=()=>{closePocketModal();resolve(true)};}});
    });
}

/* =====================================================
   RENDER GENERAL
===================================================== */
function renderPockets(){
    const c=document.getElementById('pockets');if(!c)return;
    const accordionToRestore=activePocketDesireAccordionId;
    closePocketDesireAccordion();
    c.innerHTML='';
    if(!pocketSystem.initialized){
        c.innerHTML=`<div class="col-12"><div class="pocket-welcome"><div class="pocket-welcome-icon">🐷</div><div><small>PLANIFICACIÓN PERSONAL</small><h3>Configura tus Bolsillos</h3><p>Empieza desde cero: decide cuánto de tus ingresos irá a Bolsillos y cuánto a Ahorro. Después crea tus propias categorías.</p></div><button type="button" class="pocket-primary" id="pocket-start-setup">Configurar Bolsillos</button></div></div>`;
        return;
    }

    c.insertAdjacentHTML('beforeend',renderIncomePanel());
    c.insertAdjacentHTML('beforeend',renderDistributionPanel());

    const cats=visiblePockets();
    // "Tus categorías" aparece solo cuando el usuario ya creó al menos un bolsillo,
    // incluso si temporalmente todos están ocultos (así siempre puede recuperarlos).
    if(pockets.length){
        const heading=document.createElement('div');heading.className='col-12';heading.innerHTML=`<div class="pocket-section-heading"><div><small>BOLSILLOS ECONÓMICOS</small><h5>Tus categorías</h5><p>Personaliza porcentajes, montos fijos, colores y deseos.</p></div><div class="pocket-section-actions"><button type="button" class="pocket-soft" id="pocket-organize">↕ Organizar</button><button type="button" class="pocket-primary" id="pocket-add-category">＋ Nuevo bolsillo</button></div></div>`;c.append(heading);
    }

    c.insertAdjacentHTML('beforeend', renderSavingCard());

    if(!cats.length){
        const empty=document.createElement('div');empty.className='col-12';
        if(pockets.length){
            empty.innerHTML=`<div class="pocket-empty-state"><span>👁️</span><strong>Todos tus bolsillos están ocultos</strong><p>No se eliminaron. Puedes volver a mostrarlos desde Organizar bolsillos.</p><button type="button" class="pocket-primary" id="pocket-organize-empty">Organizar bolsillos</button></div>`;
        }else{
            empty.innerHTML=`<div class="pocket-empty-state"><span>✨</span><strong>Aún no tienes bolsillos económicos</strong><p>Crea categorías como Universidad, Mascotas, Viajes, Tecnología o cualquier otra que tenga sentido para ti.</p><button type="button" class="pocket-primary" id="pocket-add-category-empty">Crear mi primer bolsillo</button></div>`;
        }
        c.append(empty);
    }else cats.forEach(p=>c.append(renderPocketCard(p)));

    syncPocketState();

    // Si el acordeón rápido estaba abierto, lo reconstruimos con los datos nuevos
    // para que barras, montos y notas se actualicen inmediatamente.
    if(accordionToRestore){
        requestAnimationFrame(()=>{
            const pocket=pocketById(accordionToRestore);
            const button=document.querySelector(`.pocket-desires-trigger[data-id="${CSS.escape(String(accordionToRestore))}"]`);
            const card=button?.closest('.economic-pocket-card');
            if(pocket&&button&&card)openPocketDesireAccordion(pocket,card,button);
        });
    }
}

function renderIncomePanel(){
    return `<div class="col-12"><div class="income-panel"><div class="income-main"><div class="income-title"><span>💰</span><div><small>INGRESO MENSUAL</small><h4>Planifica cada pago antes de repartirlo</h4></div></div><div class="income-stats"><div><span>Sueldo base</span><strong>${pocketMoney(pocketSystem.baseIncome)}</strong><button type="button" id="pocket-edit-base" title="Editar sueldo base">✏️</button></div><div><span>Último ingreso</span><strong>${pocketMoney(pocketSystem.lastIncome)}</strong></div><div><span>Total registrado</span><strong>${pocketMoney(pocketSystem.totalIncome)}</strong></div></div></div><div class="income-actions"><button type="button" class="pocket-soft" id="pocket-income-history">◷ Historial</button><button type="button" class="pocket-primary" id="pocket-add-income">＋ Registrar ingreso</button></div></div></div>`;
}

function renderDistributionPanel(){
    const g=pocketSystem.general;
    const percentCats=[...pockets]
        .filter(p=>p.type==='percent')
        .sort((a,b)=>Number(a.order)-Number(b.order));
    const fixedCats=[...pockets]
        .filter(p=>p.type==='fixed')
        .sort((a,b)=>Number(a.order)-Number(b.order));

    const used=percentCats.reduce((sum,p)=>sum+Math.max(0,Number(p.percent||0)),0);
    const pocketLimit=Math.max(0,Math.min(100,Number(g.pocketsPercent||0)));
    const baseSaving=Math.max(0,Math.min(100,Number(g.savingPercent||0)));
    const effectiveSaving=Math.max(0,100-used);
    const overflow=Math.max(0,used-pocketLimit);
    const unassigned=Math.max(0,pocketLimit-used);

    const segments=percentCats.map(p=>{
        const pct=Math.max(0,Number(p.percent||0));
        if(!(pct>0))return '';
        const color=pocketColor(p.color);
        const hidden=p.hidden?' · oculto':'';
        return `<div class="distribution-category-segment${p.hidden?' is-hidden':''}" style="--segment-color:${color};flex-basis:${pct}%" title="${pocketEscape(p.icon||'🐷')} ${pocketEscape(p.name)} · ${pct}% del ingreso${hidden}"><span>${pocketEscape(p.icon||'🐷')}</span><b>${pct}%</b></div>`;
    }).join('');

    const savingSegment=`<div class="distribution-saving-segment" style="flex-basis:${effectiveSaving}%" title="Ahorro efectivo con la distribución actual: ${effectiveSaving.toFixed(1).replace('.0','')}%"><span>💰</span><b>${effectiveSaving.toFixed(1).replace('.0','')}%</b></div>`;

    const legend=percentCats.length
        ? percentCats.map(p=>{const pct=Math.max(0,Number(p.percent||0));return `<span class="distribution-legend-item${p.hidden?' is-hidden':''}" title="${p.hidden?'Este bolsillo está oculto, pero sigue participando en la distribución.':''}"><i style="--legend-color:${pocketColor(p.color)}"></i><span>${pocketEscape(p.icon||'🐷')} ${pocketEscape(p.name)}</span><b>${pct}%</b></span>`;}).join('')
        : `<span class="distribution-legend-empty">Aún no hay bolsillos porcentuales.</span>`;

    const fixedSummary=fixedCats.length
        ? `<div class="distribution-fixed-note"><div><strong>Fijos</strong><span>No ocupan porcentaje; se financian desde Ahorro.</span></div><div class="distribution-fixed-chips">${fixedCats.map(p=>`<span title="${p.fixedMode==='auto'?'Automático al registrar ingreso':'Manual'}">${pocketEscape(p.icon||'🐷')} ${pocketEscape(p.name)} · ${pocketMoney(p.fixedAmount)}</span>`).join('')}</div></div>`
        : '';

    const overflowNote=overflow>0
        ? `<div class="distribution-overflow-warning">⚠️ Tus bolsillos porcentuales superan el límite de Bolsillos en <strong>${overflow.toFixed(1).replace('.0','')}%</strong>. Ajusta los porcentajes para volver a la distribución ${pocketLimit}% / ${baseSaving}%.</div>`
        : unassigned>0
            ? `<div class="distribution-unassigned-note">${unassigned.toFixed(1).replace('.0','')}% del bloque Bolsillos aún no está asignado y, al registrar un ingreso, permanecerá en Ahorro.</div>`
            : `<div class="distribution-unassigned-note complete">✓ Todo el ${pocketLimit}% de Bolsillos está distribuido.</div>`;

    return `<div class="col-12"><div class="distribution-panel${overflow>0?' has-overflow':''}"><div class="distribution-top"><div><small>DISTRIBUCIÓN GENERAL</small><h5>Cómo se reparte tu ingreso</h5></div><div class="distribution-actions"><button type="button" class="pocket-soft" id="pocket-transfer">⇄ Transferir</button><button type="button" class="pocket-soft" id="pocket-edit-distribution">⚙️ Ajustar</button></div></div>
        <div class="distribution-visual-wrap">
            <div class="distribution-bar distribution-bar-categories" style="--pocket-limit:${pocketLimit}%">
                ${segments}${savingSegment}
                <span class="distribution-limit-marker" style="left:${pocketLimit}%" title="Límite configurado de Bolsillos: ${pocketLimit}%"></span>
                ${overflow>0?`<span class="distribution-overflow-zone" style="left:${pocketLimit}%;width:${Math.min(100-pocketLimit,overflow)}%" title="Exceso de ${overflow.toFixed(1).replace('.0','')}%"></span>`:''}
            </div>
            <div class="distribution-scale"><span>Bolsillos: máximo ${pocketLimit}%</span><span>Ahorro base ${baseSaving}% · efectivo ahora ${effectiveSaving.toFixed(1).replace('.0','')}%</span></div>
        </div>
        <div class="distribution-legend">${legend}<span class="distribution-legend-item saving"><i></i><span>💰 Ahorro</span><b>${effectiveSaving.toFixed(1).replace('.0','')}%</b></span></div>
        ${overflowNote}${fixedSummary}
        <div class="distribution-summary"><div><span>Porcentaje asignado a categorías</span><strong class="${overflow>0?'distribution-invalid':''}">${used.toFixed(1).replace('.0','')}% / ${pocketLimit}%</strong></div><div><span>Ahorro actual</span><strong>${pocketMoney(pocketSystem.saving.balance)}</strong></div></div></div></div>`;
}

function renderSavingCard(){
    const s=pocketSystem.saving;const baseRef=getSavingBaseReference();
    return `<div class="col-md-6 col-lg-4 pocket-col"><article class="economic-pocket-card saving-pocket-card" style="--pocket-color:var(--success)"><div class="economic-pocket-accent"></div><header><div class="economic-pocket-title"><span>💰</span><div><h5>Ahorro</h5><small>Reserva general · ${pocketSystem.general.savingPercent}% base</small></div></div></header><div class="economic-pocket-values"><div><span>Saldo actual</span><strong>${pocketMoney(s.balance)}</strong></div><div><span>Último aporte</span><strong>${pocketMoney(s.lastContribution)}</strong></div></div><div class="economic-pocket-history-row three"><span>Base ref. ${pocketMoney(baseRef)}</span><span>Anterior ${pocketMoney(s.previousContribution)}</span><span>Total recibido ${pocketMoney(s.totalReceived)}</span></div><div class="saving-explanation">Aquí llega el porcentaje de Ahorro, la parte no asignada de Bolsillos y desde aquí se financian los bolsillos fijos.</div><footer><span>${(s.history||[]).length} movimientos</span><button type="button" class="open-saving-history">Ver historial →</button></footer></article></div>`;
}

function renderPocketCard(p){
    const col=document.createElement('div');col.className='col-md-6 col-lg-4 pocket-col';col.dataset.pocketId=p.id;
    const isFixed=p.type==='fixed';const desires=[...(p.desires||[])].sort((a,b)=>Number(a.order)-Number(b.order));const preview=desires.slice(0,POCKET_MAX_PREVIEW_DESIRES);
    const linkBadge=typeof renderPocketLinkBadge==='function'?renderPocketLinkBadge(p):'';
    const desireFooter=desires.length>POCKET_MAX_PREVIEW_DESIRES
        ? `<button type="button" class="pocket-desires-trigger" data-id="${p.id}" aria-expanded="false"><span>✨ ${desires.length} deseos</span><span class="pocket-desires-chevron">›</span></button>`
        : `<span>${desires.length} ${desires.length===1?'deseo':'deseos'}</span>`;
    col.innerHTML=`<article class="economic-pocket-card" style="--pocket-color:${p.color||POCKET_DEFAULT_COLOR}" data-id="${p.id}"><div class="economic-pocket-accent"></div><header><div class="economic-pocket-title"><span>${pocketEscape(p.icon||'🐷')}</span><div><h5>${pocketEscape(p.name)}</h5><small>${isFixed?(p.fixedMode==='auto'?'Fijo · automático':'Fijo · manual'):`Porcentaje · ${Number(p.percent||0)}%`}</small></div></div><button type="button" class="economic-pocket-menu" data-id="${p.id}">⋮</button></header><div class="economic-pocket-values"><div><span>Saldo actual</span><strong>${pocketMoney(p.balance)}</strong></div><div><span>Último aporte</span><strong>${pocketMoney(p.lastContribution)}</strong></div></div><div class="economic-pocket-history-row three"><span>${isFixed?`Base fija ${pocketMoney(p.fixedAmount)}`:`Base ref. ${pocketMoney(pocketSystem.baseIncome*Number(p.percent||0)/100)}`}</span><span>Anterior ${pocketMoney(p.previousContribution)}</span><span>Total recibido ${pocketMoney(p.totalReceived)}</span></div>${linkBadge}${isFixed&&p.fixedMode==='manual'?`<button type="button" class="fixed-pocket-add" data-id="${p.id}">＋ ${pocketMoney(p.fixedAmount)}</button>`:''}<div class="pocket-desire-preview">${preview.length?preview.map(d=>renderDesireMini(d)).join(''):`<div class="pocket-no-desires">Sin deseos todavía</div>`}</div><footer>${desireFooter}<button type="button" class="open-pocket-detail" data-id="${p.id}">Ver bolsillo →</button></footer></article>`;
    return col;
}
function renderDesireMini(d){
    const target=Number(d.target||0),reserved=Number(d.reserved||0);const pct=target>0?Math.min(100,reserved/target*100):0;
    const note=String(d.note||'').trim();
    return `<div class="desire-mini" style="--desire-color:${pocketColor(d.color)}"><span class="desire-mini-icon">${d.image?`<img src="${d.image}" alt="">`:pocketEscape(d.icon||'✨')}</span><div class="desire-mini-main"><strong>${pocketEscape(d.name)}</strong>${note?`<p class="desire-mini-note">${pocketEscape(note)}</p>`:''}${target>0?`<div class="desire-mini-progress"><i style="width:${pct}%"></i></div><small>${pocketMoney(reserved)} / ${pocketMoney(target)}</small>`:`<small>${pocketMoney(reserved)} reservado · precio indefinido</small>`}</div>${d.url?`<a class="desire-external" href="${pocketEscape(d.url)}" target="_blank" rel="noopener noreferrer" title="Abrir enlace">↗</a>`:''}</div>`;
}

/* =====================================================
   CONFIGURACIÓN INICIAL / GENERAL
===================================================== */
function openPocketSetup(){
    const body=`<div class="setup-intro"><span>🐷</span><p>Define el marco general. Puedes cambiarlo después.</p></div><div class="field-grid two"><label>Bolsillos %<input id="setup-pockets" type="number" min="0" max="100" step="1" value="70"></label><label>Ahorro %<input id="setup-saving" type="number" min="0" max="100" step="1" value="30"></label></div><div class="distribution-preview"><div id="setup-bar-pockets" style="width:70%"></div><div id="setup-bar-saving" style="width:30%"></div></div><div id="setup-feedback" class="pocket-feedback valid">Total: 100%</div><label>Sueldo base de referencia (opcional)<input id="setup-base" type="number" min="0" step="1000" value="0" placeholder="0"></label><div class="pocket-modal-actions"><button class="pocket-cancel">Cancelar</button><button class="pocket-primary" id="setup-save">Guardar configuración</button></div>`;
    openPocketModal({title:'Configurar Bolsillos',kicker:'PRIMERA CONFIGURACIÓN',body,onReady:overlay=>{
        const pp=overlay.querySelector('#setup-pockets'),sp=overlay.querySelector('#setup-saving'),fb=overlay.querySelector('#setup-feedback'),save=overlay.querySelector('#setup-save');
        const update=(source)=>{let p=Number(pp.value||0),s=Number(sp.value||0);if(source==='p'){s=Math.max(0,100-p);sp.value=s;}else{p=Math.max(0,100-s);pp.value=p;}const valid=p>=0&&s>=0&&p<=100&&s<=100&&Math.abs(p+s-100)<.001;overlay.querySelector('#setup-bar-pockets').style.width=`${p}%`;overlay.querySelector('#setup-bar-saving').style.width=`${s}%`;fb.className=`pocket-feedback ${valid?'valid':'error'}`;fb.textContent=valid?'Total: 100%':'Bolsillos + Ahorro deben sumar 100%';save.disabled=!valid;};
        pp.oninput=()=>update('p');sp.oninput=()=>update('s');overlay.querySelector('.pocket-cancel').onclick=closePocketModal;
        save.onclick=()=>{pocketSystem.general.pocketsPercent=Number(pp.value);pocketSystem.general.savingPercent=Number(sp.value);pocketSystem.baseIncome=Math.max(0,Number(overlay.querySelector('#setup-base').value||0));pocketSystem.initialized=true;syncPocketState();closePocketModal();renderPockets();showToast('Bolsillos configurados');};
    }});
}

function openDistributionEditor(){
    const g=pocketSystem.general;const body=`<p class="modal-help">El porcentaje de Bolsillos es el máximo que pueden utilizar las categorías porcentuales. La parte no asignada permanece en Ahorro.</p><div class="field-grid two"><label>Bolsillos %<input id="dist-p" type="number" min="0" max="100" value="${g.pocketsPercent}"></label><label>Ahorro %<input id="dist-s" type="number" min="0" max="100" value="${g.savingPercent}"></label></div><div class="distribution-preview"><div id="dist-barp" style="width:${g.pocketsPercent}%"></div><div id="dist-bars" style="width:${g.savingPercent}%"></div></div><div id="dist-feedback" class="pocket-feedback"></div><div class="pocket-modal-actions"><button class="pocket-cancel">Cancelar</button><button class="pocket-primary" id="dist-save">Guardar</button></div>`;
    openPocketModal({title:'Distribución general',body,onReady:o=>{const p=o.querySelector('#dist-p'),s=o.querySelector('#dist-s'),fb=o.querySelector('#dist-feedback'),save=o.querySelector('#dist-save');const update=src=>{let pv=Number(p.value||0),sv=Number(s.value||0);if(src==='p'){sv=100-pv;s.value=sv;}else{pv=100-sv;p.value=pv;}const used=percentPocketTotal();const valid=pv>=0&&pv<=100&&sv>=0&&sv<=100&&Math.abs(pv+sv-100)<.001&&used<=pv+.001;o.querySelector('#dist-barp').style.width=`${Math.max(0,pv)}%`;o.querySelector('#dist-bars').style.width=`${Math.max(0,sv)}%`;fb.className=`pocket-feedback ${valid?'valid':'error'}`;fb.textContent=used>pv?`Tus categorías porcentuales ya usan ${used}%. Bolsillos no puede bajar de ese valor.`:`Categorías porcentuales: ${used}% de ${pv}% disponibles.`;save.disabled=!valid;};p.oninput=()=>update('p');s.oninput=()=>update('s');update('p');o.querySelector('.pocket-cancel').onclick=closePocketModal;save.onclick=()=>{pocketSystem.general.pocketsPercent=Number(p.value);pocketSystem.general.savingPercent=Number(s.value);syncPocketState();closePocketModal();renderPockets();};}});
}

function openBaseIncomeEditor(){
    const body=`<label>Sueldo base de referencia<input id="base-income-value" type="number" min="0" step="1000" value="${pocketSystem.baseIncome}"></label><p class="modal-help">Es solo una referencia para comparar. Los aportes se calculan usando el ingreso real que registres.</p><div class="pocket-modal-actions"><button class="pocket-cancel">Cancelar</button><button class="pocket-primary" id="base-income-save">Guardar</button></div>`;
    openPocketModal({title:'Editar sueldo base',kicker:'INGRESO MENSUAL',body,onReady:o=>{o.querySelector('.pocket-cancel').onclick=closePocketModal;o.querySelector('#base-income-save').onclick=()=>{pocketSystem.baseIncome=Math.max(0,Number(o.querySelector('#base-income-value').value||0));syncPocketState();closePocketModal();renderPockets();};}});
}

/* =====================================================
   CATEGORÍAS ECONÓMICAS
===================================================== */
function openPocketEditor(p=null){
    const editing=Boolean(p);const maxPercent=Math.max(0,pocketSystem.general.pocketsPercent-percentPocketTotal(p?.id));const type=p?.type||'percent';
    const body=`<div class="field-grid pocket-meta"><label>Emoji<input id="cat-icon" value="${pocketEscape(p?.icon||'🐷')}" maxlength="8"></label><label>Nombre<input id="cat-name" value="${pocketEscape(p?.name||'')}" maxlength="40" placeholder="Ej. Universidad"></label><label>Color<div class="color-field"><input id="cat-color" type="color" value="${p?.color||POCKET_DEFAULT_COLOR}"><input id="cat-hex" value="${p?.color||POCKET_DEFAULT_COLOR}" maxlength="7"></div></label></div><label>Tipo<select id="cat-type"><option value="percent" ${type==='percent'?'selected':''}>Porcentaje del ingreso</option><option value="fixed" ${type==='fixed'?'selected':''}>Monto fijo</option></select></label><div id="cat-percent-box"><label>Porcentaje del ingreso<input id="cat-percent" type="number" min="0" max="${maxPercent}" step="0.5" value="${p?.percent||0}"></label><div class="pocket-feedback" id="cat-percent-feedback"></div></div><div id="cat-fixed-box"><label>Monto fijo<input id="cat-fixed" type="number" min="0" step="1000" value="${p?.fixedAmount||0}"></label><label>Cómo se aporta<select id="cat-fixed-mode"><option value="auto" ${p?.fixedMode!=='manual'?'selected':''}>Automático al registrar un ingreso</option><option value="manual" ${p?.fixedMode==='manual'?'selected':''}>Manual con botón + monto</option></select></label><p class="modal-help">Los montos fijos se descuentan de Ahorro. Si es manual, no se mueve dinero hasta que pulses el botón del bolsillo.</p></div><div class="pocket-modal-actions"><button class="pocket-cancel">Cancelar</button><button class="pocket-primary" id="cat-save">${editing?'Guardar cambios':'Crear bolsillo'}</button></div>`;
    openPocketModal({title:editing?'Editar bolsillo':'Nuevo bolsillo económico',kicker:'PERSONALIZACIÓN',body,onReady:o=>{
        const typeEl=o.querySelector('#cat-type'),percentBox=o.querySelector('#cat-percent-box'),fixedBox=o.querySelector('#cat-fixed-box'),percent=o.querySelector('#cat-percent'),fb=o.querySelector('#cat-percent-feedback'),save=o.querySelector('#cat-save'),color=o.querySelector('#cat-color'),hex=o.querySelector('#cat-hex');
        const update=()=>{const isPercent=typeEl.value==='percent';percentBox.hidden=!isPercent;fixedBox.hidden=isPercent;let valid=true;if(isPercent){const v=Number(percent.value||0);valid=v>=0&&v<=maxPercent+.001;fb.className=`pocket-feedback ${valid?'valid':'error'}`;fb.textContent=`Disponible para porcentajes: ${maxPercent}%${valid?'':` · máximo excedido`}`;}save.disabled=!valid||!o.querySelector('#cat-name').value.trim();};
        typeEl.onchange=update;percent.oninput=update;o.querySelector('#cat-name').oninput=update;color.oninput=()=>hex.value=color.value.toUpperCase();hex.oninput=()=>{let v=hex.value.trim();if(!v.startsWith('#'))v='#'+v;if(/^#[0-9a-fA-F]{6}$/.test(v))color.value=v;};update();o.querySelector('.pocket-cancel').onclick=closePocketModal;
        save.onclick=()=>{const name=o.querySelector('#cat-name').value.trim();if(!name)return;const obj=p||{};obj.id=obj.id||pocketId();obj.name=name;obj.icon=o.querySelector('#cat-icon').value.trim()||'🐷';obj.color=/^#[0-9a-fA-F]{6}$/.test(hex.value.trim())?hex.value.trim().toUpperCase():color.value.toUpperCase();obj.type=typeEl.value;obj.percent=obj.type==='percent'?Number(percent.value||0):0;obj.fixedAmount=obj.type==='fixed'?Math.max(0,Number(o.querySelector('#cat-fixed').value||0)):0;obj.fixedMode=obj.type==='fixed'?o.querySelector('#cat-fixed-mode').value:'auto';obj.balance=Math.max(0,Number(obj.balance||0));obj.totalReceived=Math.max(0,Number(obj.totalReceived||0));obj.lastContribution=Math.max(0,Number(obj.lastContribution||0));obj.previousContribution=Math.max(0,Number(obj.previousContribution||0));obj.history=Array.isArray(obj.history)?obj.history:[];obj.desires=Array.isArray(obj.desires)?obj.desires:[];obj.hidden=Boolean(obj.hidden);obj.order=Number.isFinite(Number(obj.order))?obj.order:pockets.length;if(!p)pockets.push(obj);normalizePocketOrders();syncPocketState();history.unshift({date:new Date().toISOString().slice(0,10),type:editing?'edicion':'suma',detail:`${editing?'Bolsillo actualizado':'Nuevo bolsillo'}: ${obj.name}`});closePocketModal();renderPockets();};
    }});
}

/* =====================================================
   INGRESOS / SIMULACIÓN
===================================================== */
function calculateIncomePlan(amount){
    const income=Math.max(0,Number(amount||0));
    // Ocultar una tarjeta es solo una preferencia visual: no cambia su planificación.
    const percentCats=pockets.filter(p=>p.type==='percent');
    const autoFixed=pockets.filter(p=>p.type==='fixed'&&p.fixedMode==='auto');
    const percentRows=percentCats.map(p=>({p,amount:Math.round(income*Number(p.percent||0)/100)}));
    const percentTotal=percentRows.reduce((s,r)=>s+r.amount,0);
    const fixedRows=autoFixed.map(p=>({p,amount:Number(p.fixedAmount||0)}));
    const fixedTotal=fixedRows.reduce((s,r)=>s+r.amount,0);
    const grossSaving=Math.max(0,income-percentTotal);
    const savingBefore=Math.max(0,Number(pocketSystem.saving.balance||0));
    const savingAvailableForFixed=savingBefore+grossSaving;
    const savingBalanceAfter=savingAvailableForFixed-fixedTotal;
    const savingNetChange=savingBalanceAfter-savingBefore;
    return {income,percentRows,fixedRows,percentTotal,fixedTotal,grossSaving,savingBefore,savingAvailableForFixed,savingBalanceAfter,savingNetChange,valid:savingBalanceAfter>=0};
}
function openIncomeModal(){
    const body=`<div class="field-grid two"><label>Tipo de ingreso<input id="income-label" value="Salario" placeholder="Salario, bono, freelance..."></label><label>Monto recibido<input id="income-amount" type="number" min="0" step="1000" placeholder="0"></label></div><div id="income-simulation" class="income-simulation"></div><div class="pocket-modal-actions"><button class="pocket-cancel">Cancelar</button><button class="pocket-primary" id="income-confirm" disabled>Confirmar distribución</button></div>`;
    openPocketModal({title:'Registrar ingreso',kicker:'SIMULACIÓN ANTES DE GUARDAR',body,wide:true,onReady:o=>{const amount=o.querySelector('#income-amount'),sim=o.querySelector('#income-simulation'),confirmBtn=o.querySelector('#income-confirm');const update=()=>{const plan=calculateIncomePlan(Number(amount.value||0));if(!plan.income){sim.innerHTML='<div class="simulation-empty">Escribe el monto para ver cómo se distribuirá.</div>';confirmBtn.disabled=true;return;}sim.innerHTML=renderIncomeSimulation(plan);confirmBtn.disabled=!plan.valid;};amount.oninput=update;update();o.querySelector('.pocket-cancel').onclick=closePocketModal;confirmBtn.onclick=async()=>{const plan=calculateIncomePlan(Number(amount.value||0));if(!plan.valid)return;const ok=await pocketConfirm({title:'Confirmar ingreso',message:`Se distribuirán ${pocketMoney(plan.income)} según la simulación mostrada.`,confirmText:'Registrar ingreso'});if(!ok)return;applyIncomePlan(plan,o.querySelector('#income-label').value.trim()||'Ingreso');closePocketModal();refreshAll();showToast('Ingreso distribuido');};}});
}
function renderIncomeSimulation(plan){
    const rows=[...plan.percentRows.map(r=>`<div><span>${pocketEscape(r.p.icon)} ${pocketEscape(r.p.name)} <small>${r.p.percent}%</small></span><strong>+${pocketMoney(r.amount)}</strong></div>`),...plan.fixedRows.map(r=>`<div><span>${pocketEscape(r.p.icon)} ${pocketEscape(r.p.name)} <small>fijo automático · desde Ahorro</small></span><strong>+${pocketMoney(r.amount)}</strong></div>`)];
    const status=plan.valid
        ? `<div class="pocket-feedback valid">✓ Los fijos pueden cubrirse con Ahorro previo + el aporte de este ingreso.</div>`
        : `<div class="pocket-feedback error">⚠️ Ahorro disponible: ${pocketMoney(plan.savingAvailableForFixed)}. Los fijos automáticos requieren ${pocketMoney(plan.fixedTotal)}. Falta ${pocketMoney(Math.max(0,plan.fixedTotal-plan.savingAvailableForFixed))}.</div>`;
    return `<div class="simulation-card"><div class="simulation-head"><span>Ingreso</span><strong>${pocketMoney(plan.income)}</strong></div><div class="simulation-rows">${rows.join('')||'<div><span>Sin bolsillos configurados</span><strong>—</strong></div>'}<div class="saving-row"><span>💰 Ahorro generado por este ingreso</span><strong>+${pocketMoney(plan.grossSaving)}</strong></div><div class="saving-final-row"><span>Saldo de Ahorro después de fijos</span><strong>${pocketMoney(Math.max(0,plan.savingBalanceAfter))}</strong></div></div>${status}</div>`;
}
function applyIncomePlan(plan,label){
    plan.percentRows.forEach(({p,amount})=>applyPocketContribution(p,amount,`${label} · aporte porcentual`));
    const s=pocketSystem.saving;
    s.previousContribution=Number(s.lastContribution||0);
    s.lastContribution=Math.max(0,Number(plan.grossSaving||0));
    s.balance+=s.lastContribution;
    s.totalReceived+=s.lastContribution;
    if(s.lastContribution>0)savingHistory('suma',`${label}: +${pocketMoney(s.lastContribution)}`,s.lastContribution);
    plan.fixedRows.forEach(({p,amount})=>{
        s.balance=Math.max(0,s.balance-amount);
        savingHistory('resta',`Transferido a ${p.name}: -${pocketMoney(amount)}`,amount);
        applyPocketContribution(p,amount,`${label} · aporte fijo automático`);
    });
    pocketSystem.lastIncome=plan.income;pocketSystem.totalIncome+=plan.income;
    pocketSystem.incomes.unshift({id:pocketId(),date:new Date().toISOString(),label,amount:plan.income,general:{...pocketSystem.general},savingContribution:s.lastContribution,savingNetChange:plan.savingNetChange,savingBalanceBefore:plan.savingBefore,savingBalanceAfter:s.balance,distribution:[...plan.percentRows,...plan.fixedRows].map(r=>({pocketId:r.p.id,name:r.p.name,type:r.p.type,percent:r.p.type==='percent'?r.p.percent:null,fixedAmount:r.p.type==='fixed'?r.p.fixedAmount:null,amount:r.amount}))});
    history.unshift({date:new Date().toISOString().slice(0,10),type:'suma',detail:`Ingreso registrado ${label}: ${pocketMoney(plan.income)}`});syncPocketState();
    if(typeof notifyPendingPocketLinks==='function')setTimeout(()=>notifyPendingPocketLinks(),80);
}

function applyPocketContribution(p,amount,detail){
    amount=Math.max(0,Number(amount||0));p.previousContribution=Number(p.lastContribution||0);p.lastContribution=amount;
    if(typeof changePocketBalanceWithLink==='function')changePocketBalanceWithLink(p,amount,{notify:false,reason:detail});else p.balance+=amount;
    p.totalReceived+=amount;pocketHistory(p,'suma',`${detail}: +${pocketMoney(amount)}`,amount);
}
function manualFixedContribution(p){
    const amount=Number(p.fixedAmount||0);if(amount<=0)return showToast('Configura primero un monto fijo.','var(--danger)');if(pocketSystem.saving.balance<amount)return showToast('Ahorro insuficiente para este aporte fijo.','var(--danger)');pocketSystem.saving.balance-=amount;savingHistory('resta',`Transferido a ${p.name}: -${pocketMoney(amount)}`,amount);applyPocketContribution(p,amount,'Aporte fijo manual');syncPocketState();refreshAll();
}

/* =====================================================
   DETALLE DE BOLSILLO / HISTORIAL
===================================================== */
function openPocketDetail(p){
    const desires=[...(p.desires||[])].sort((a,b)=>Number(a.order)-Number(b.order));
    const body=`<div class="pocket-detail-summary" style="--pocket-color:${p.color||POCKET_DEFAULT_COLOR}"><div><span class="big-icon">${pocketEscape(p.icon)}</span><div><small>${p.type==='percent'?`${p.percent}% del ingreso`:`Fijo · ${pocketMoney(p.fixedAmount)} ${p.fixedMode==='auto'?'automático':'manual'}`}</small><strong>${pocketMoney(p.balance)}</strong><span>saldo del bolsillo</span></div></div><div class="detail-metrics"><div><span>Anterior</span><strong>${pocketMoney(p.previousContribution)}</strong></div><div><span>Último</span><strong>${pocketMoney(p.lastContribution)}</strong></div><div><span>Total recibido</span><strong>${pocketMoney(p.totalReceived)}</strong></div></div></div>${typeof renderPocketLinkBadge==='function'?renderPocketLinkBadge(p):''}<div class="detail-toolbar"><button class="pocket-soft detail-history" data-id="${p.id}">◷ Historial</button><button class="pocket-primary detail-add-desire" data-id="${p.id}">＋ Nuevo deseo</button></div><div class="desire-grid-full">${desires.length?desires.map(d=>renderDesireCard(p,d)).join(''):`<div class="pocket-empty-state compact"><span>✨</span><strong>No hay deseos</strong><p>Agrega algo que quieras comprar, lograr o reservar.</p></div>`}</div>`;
    openPocketModal({title:`${pocketEscape(p.icon)} ${pocketEscape(p.name)}`,kicker:'BOLSILLO ECONÓMICO',body,wide:true});
}
function openPocketHistory(p){
    const rows=(p.history||[]).slice(0,80).map(h=>`<div class="mini-history-row ${h.type}"><span>${new Date(h.date).toLocaleDateString('es-CO')}</span><div>${pocketEscape(h.detail)}</div>${h.amount?`<strong>${h.type==='resta'?'-':'+'}${pocketMoney(Math.abs(h.amount))}</strong>`:''}</div>`).join('');
    openPocketModal({title:`Historial · ${pocketEscape(p.name)}`,kicker:'MOVIMIENTOS DEL BOLSILLO',body:`<div class="mini-history-list">${rows||'<div class="simulation-empty">Aún no hay movimientos.</div>'}</div>`});
}
function openSavingHistory(){
    const rows=(pocketSystem.saving.history||[]).slice(0,100).map(h=>`<div class="mini-history-row ${h.type}"><span>${new Date(h.date).toLocaleDateString('es-CO')}</span><div>${pocketEscape(h.detail)}</div>${h.amount?`<strong>${h.type==='resta'?'-':'+'}${pocketMoney(Math.abs(h.amount))}</strong>`:''}</div>`).join('');
    openPocketModal({title:'Historial · Ahorro',kicker:'RESERVA GENERAL',body:`<div class="mini-history-list">${rows||'<div class="simulation-empty">Aún no hay movimientos en Ahorro.</div>'}</div>`});
}

function openIncomeHistory(){
    const rows=(pocketSystem.incomes||[]).map(i=>`<div class="income-history-row"><div><strong>${pocketEscape(i.label||'Ingreso')}</strong><small>${new Date(i.date).toLocaleDateString('es-CO')}</small></div><strong>${pocketMoney(i.amount)}</strong><button class="pocket-soft income-history-detail" data-id="${i.id}">Ver</button></div>`).join('');
    openPocketModal({title:'Historial de ingresos',kicker:'INGRESO MENSUAL',body:`<div class="income-history-list">${rows||'<div class="simulation-empty">Aún no has registrado ingresos.</div>'}</div>`});
}

/* =====================================================
   DESEOS
===================================================== */
function desireStatus(d){
    if(d.status==='purchased')return 'purchased';const target=Number(d.target||0),reserved=Number(d.reserved||0);if(target>0&&reserved>=target)return 'completed';if(reserved>0)return 'saving';return 'thinking';
}
function renderDesireCard(p,d){
    d.status=desireStatus(d);const target=Number(d.target||0),reserved=Number(d.reserved||0),pct=target>0?Math.min(100,reserved/target*100):0;const statusLabel={thinking:'Pensando',saving:'Ahorrando',completed:'Meta completada',purchased:'Completado'}[d.status]||'Pensando';
    const note=String(d.note||'').trim();
    return `<article class="desire-card-full" data-pocket-id="${p.id}" data-desire-id="${d.id}" style="--desire-color:${d.color||POCKET_DEFAULT_COLOR}"><div class="desire-cover ${d.image?'has-image':''}" style="${d.image?`background-image:url('${d.image}')`:''}">${d.image?'':`<span>${pocketEscape(d.icon||'✨')}</span>`}</div><div class="desire-card-body"><header><div><small>${statusLabel}</small><h5>${pocketEscape(d.icon||'✨')} ${pocketEscape(d.name)}</h5></div><button class="desire-options">⋮</button></header>${note?`<p class="desire-note">${pocketEscape(note)}</p>`:''}${target>0?`<div class="desire-progress-label"><span>${pocketMoney(reserved)}</span><span>${pocketMoney(target)}</span></div><div class="desire-progress"><i style="width:${pct}%"></i></div><small class="desire-remaining">${pct>=100?'🎉 Objetivo alcanzado':`Faltan ${pocketMoney(Math.max(0,target-reserved))}`}</small>`:`<div class="desire-undefined"><strong>${pocketMoney(reserved)}</strong><span>reservado · precio indefinido</span></div>`}<div class="desire-actions"><button class="desire-contribute">＋ Aportar</button><button class="desire-withdraw">− Retirar</button>${target>0&&reserved<target?`<button class="desire-cover-now">⚡ Cubrir ahora</button>`:''}${d.status==='completed'?`<button class="desire-complete">✓ Completar</button>`:''}${d.url?`<a class="desire-link" href="${pocketEscape(d.url)}" target="_blank" rel="noopener noreferrer" title="Abrir enlace">↗</a>`:''}</div></div></article>`;
}

function openDesireEditor(p,d=null){
    const editing=Boolean(d);const body=`<div class="field-grid desire-meta"><label>Emoji<input id="desire-icon" value="${pocketEscape(d?.icon||'✨')}" maxlength="8"></label><label>Nombre<input id="desire-name" value="${pocketEscape(d?.name||'')}" maxlength="60" placeholder="Ej. Bicicleta nueva"></label></div><label>Nota corta <small>(opcional · máx. ${DESIRE_NOTE_MAX} caracteres)</small><input id="desire-note" value="${pocketEscape(d?.note||'')}" maxlength="${DESIRE_NOTE_MAX}" placeholder="Ej. Ojalá mi padre me ayude"></label><label>Precio objetivo <small>(opcional)</small><input id="desire-target" type="number" min="0" step="1000" value="${d?.target||''}" placeholder="Déjalo vacío si aún no lo sabes"></label><label>Enlace <small>(opcional)</small><input id="desire-url" type="url" value="${pocketEscape(d?.url||'')}" placeholder="https://..."></label><div class="field-grid two"><label>Color<input id="desire-color" type="color" value="${d?.color||p.color||POCKET_DEFAULT_COLOR}"></label><label>Imagen <small>(opcional)</small><input id="desire-image-file" type="file" accept="image/*"></label></div><div class="image-crop-editor ${d?.image?'has-image':''}"><div class="crop-stage"><img id="crop-image" src="${d?.image||''}" alt=""></div><div class="crop-controls"><label>Zoom<input id="crop-zoom" type="range" min="1" max="3" step="0.05" value="1"></label><label>Horizontal<input id="crop-x" type="range" min="0" max="100" value="50"></label><label>Vertical<input id="crop-y" type="range" min="0" max="100" value="50"></label></div><button type="button" class="pocket-soft" id="crop-remove">Quitar imagen</button></div><div class="pocket-modal-actions"><button class="pocket-cancel">Cancelar</button><button class="pocket-primary" id="desire-save">${editing?'Guardar cambios':'Crear deseo'}</button></div>`;
    openPocketModal({title:editing?'Editar deseo':'Nuevo deseo',kicker:`${p.icon} ${p.name}`,body,wide:true,onReady:o=>{
        let sourceData=d?.image||'';const file=o.querySelector('#desire-image-file'),img=o.querySelector('#crop-image'),stage=o.querySelector('.image-crop-editor'),zoom=o.querySelector('#crop-zoom'),x=o.querySelector('#crop-x'),y=o.querySelector('#crop-y');const updateCrop=()=>{const z=Math.max(1,Number(zoom.value||1)),px=Number(x.value||50),py=Number(y.value||50);img.style.objectPosition=`${px}% ${py}%`;img.style.transformOrigin=`${px}% ${py}%`;img.style.transform=`scale(${z})`;};zoom.oninput=x.oninput=y.oninput=updateCrop;updateCrop();
        file.onchange=()=>{const f=file.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{sourceData=r.result;img.src=sourceData;stage.classList.add('has-image');updateCrop();};r.readAsDataURL(f);};o.querySelector('#crop-remove').onclick=()=>{sourceData='';img.src='';stage.classList.remove('has-image');};o.querySelector('.pocket-cancel').onclick=closePocketModal;
        o.querySelector('#desire-save').onclick=async()=>{const name=o.querySelector('#desire-name').value.trim();if(!name)return showToast('Escribe un nombre para el deseo.','var(--danger)');const targetRaw=o.querySelector('#desire-target').value.trim(),target=targetRaw?Math.max(0,Number(targetRaw)):null;let image=d?.image||'';if(sourceData){try{image=await cropImageData(sourceData,Number(zoom.value),Number(x.value),Number(y.value));}catch{image=sourceData;}}else image='';const obj=d||{};obj.id=obj.id||pocketId();obj.name=name;obj.icon=o.querySelector('#desire-icon').value.trim()||'✨';obj.target=target&&target>0?target:null;obj.note=o.querySelector('#desire-note').value.trim().slice(0,DESIRE_NOTE_MAX);obj.url=o.querySelector('#desire-url').value.trim();obj.color=o.querySelector('#desire-color').value.toUpperCase();obj.image=image;obj.reserved=Math.max(0,Number(obj.reserved||0));obj.spent=Math.max(0,Number(obj.spent||0));obj.status=desireStatus(obj);obj.order=Number.isFinite(Number(obj.order))?obj.order:p.desires.length;obj.created=obj.created||new Date().toISOString();if(!d)p.desires.push(obj);pocketHistory(p,editing?'edicion':'suma',`${editing?'Deseo editado':'Deseo creado'}: ${obj.name}`);closePocketModal();refreshPocketSurface(p,{detail:true});};
    }});
}

function cropImageData(src,zoom=1,x=50,y=50){
    return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const W=600,H=340,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');const base=Math.max(W/img.width,H/img.height)*Math.max(1,zoom);const dw=img.width*base,dh=img.height*base;const maxX=Math.max(0,dw-W),maxY=Math.max(0,dh-H);const dx=-(maxX*(x/100)),dy=-(maxY*(y/100));ctx.drawImage(img,dx,dy,dw,dh);resolve(canvas.toDataURL('image/jpeg',.78));};img.onerror=reject;img.src=src;});
}

function openDesireMoneyModal(p,d,mode){
    const title=mode==='contribute'?'Aportar al deseo':'Retirar del deseo';
    const body=`<div class="money-context"><span>${pocketEscape(d.icon)} ${pocketEscape(d.name)}</span><strong>${mode==='contribute'?`Saldo del bolsillo ${pocketMoney(p.balance)}`:`Reservado ${pocketMoney(d.reserved)}`}</strong></div><label>${mode==='contribute'?'Monto a aportar':'Monto a retirar'}<input id="desire-money" type="number" min="0" step="1000" placeholder="0"></label><div id="desire-money-preview" class="pocket-feedback"></div><div class="pocket-modal-actions"><button class="pocket-cancel">Cancelar</button><button class="pocket-primary" id="desire-money-save" disabled>Confirmar</button></div>`;
    openPocketModal({title,kicker:'MOVIMIENTO DEL DESEO',body,onReady:o=>{
        const input=o.querySelector('#desire-money'),preview=o.querySelector('#desire-money-preview'),save=o.querySelector('#desire-money-save');
        const getMax=()=>mode==='withdraw'?Math.max(0,Number(d.reserved||0)):Math.max(0,Math.min(Number(p.balance||0),d.target?Math.max(0,Number(d.target)-Number(d.reserved||0)):Number(p.balance||0)));
        const update=()=>{let v=Number(input.value||0);const max=getMax();if(v>max&&max>=0){v=max;input.value=String(max);}const valid=v>0&&v<=max;preview.className=`pocket-feedback ${valid?'valid':'error'}`;preview.textContent=valid?(mode==='contribute'?`Después: ${pocketMoney(Number(d.reserved||0)+v)} reservado · ${pocketMoney(Number(p.balance||0)-v)} en el bolsillo`:`Después: ${pocketMoney(Number(d.reserved||0)-v)} reservado · ${pocketMoney(Number(p.balance||0)+v)} en el bolsillo`):(max<=0?'No hay dinero disponible para este movimiento.':`Máximo disponible: ${pocketMoney(max)}`);save.disabled=!valid;};
        input.oninput=update;input.onchange=update;update();o.querySelector('.pocket-cancel').onclick=closePocketModal;
        save.onclick=()=>{let v=Number(input.value||0);const max=getMax();v=Math.min(v,max);if(!(v>0))return;if(mode==='contribute'){if(typeof changePocketBalanceWithLink==='function')changePocketBalanceWithLink(p,-v,{notify:true,reason:`Aporte a ${d.name}`});else p.balance-=v;d.reserved=Number(d.reserved||0)+v;pocketHistory(p,'resta',`Aporte a ${d.name}: ${pocketMoney(v)}`,v);}else{d.reserved=Math.max(0,Number(d.reserved||0)-v);if(typeof changePocketBalanceWithLink==='function')changePocketBalanceWithLink(p,v,{notify:true,reason:`Retiro desde ${d.name}`});else p.balance+=v;pocketHistory(p,'suma',`Retiro desde ${d.name}: ${pocketMoney(v)}`,v);}const before=d.status;d.status=desireStatus(d);closePocketModal();refreshPocketSurface();if(before!=='completed'&&d.status==='completed')showDesireCelebration(d);openPocketDetail(p);};
    }});
}

function showDesireCelebration(d){
    document.querySelectorAll('.desire-celebration').forEach(x=>x.remove());
    const pieces=Array.from({length:48},(_,i)=>{const angle=(i/48)*Math.PI*2;const radius=120+(i%7)*16;const x=Math.cos(angle)*radius;const y=Math.sin(angle)*radius-70-(i%5)*14;const rot=240+(i%9)*45;const delay=(i%12)*12;return `<i style="--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px;--r:${rot}deg;--delay:${delay}ms;--c:hsl(${(i*47)%360} 78% 60%)"></i>`;}).join('');
    const overlay=document.createElement('div');overlay.className='desire-celebration';overlay.innerHTML=`<div class="confetti-box">${pieces}<div class="celebration-content"><span>🎉</span><h3>¡Lo lograste!</h3><p>Completaste <strong>${pocketEscape(d.icon)} ${pocketEscape(d.name)}</strong> con mucho esfuerzo y dedicación.</p><button>Continuar</button></div></div>`;document.body.append(overlay);requestAnimationFrame(()=>overlay.classList.add('show'));overlay.querySelector('button').onclick=()=>overlay.remove();setTimeout(()=>{if(overlay.isConnected)overlay.remove();},6500);
}

function openCoverNow(p,d){
    const missing=d.target?Math.max(0,Number(d.target)-Number(d.reserved||0)):0;if(!missing)return;
    const capitalOptions=capital.filter(x=>capitalAvailableForPocketTransfer(x)>0).map(x=>`<option value="capital:${x.id}">${pocketEscape(x.icon||'💰')} ${pocketEscape(x.name)} · ${pocketMoney(capitalAvailableForPocketTransfer(x))}</option>`);
    const sources=[`<option value="saving">💰 Ahorro · ${pocketMoney(pocketSystem.saving.balance)}</option>`,...pockets.filter(x=>x.id!==p.id&&x.balance>0).map(x=>`<option value="pocket:${x.id}">${pocketEscape(x.icon)} ${pocketEscape(x.name)} · ${pocketMoney(x.balance)}</option>`),...capitalOptions,`<option value="debt">🧾 Registrar financiación/deuda</option>`].join('');
    const body=`<div class="money-context"><span>Faltan para completar</span><strong>${pocketMoney(missing)}</strong></div><label>Cómo cubrirlo<select id="cover-source">${sources}</select></label><label>Monto<input id="cover-amount" type="number" min="0" value="${missing}"></label><div id="cover-feedback" class="pocket-feedback"></div><div class="pocket-modal-actions"><button class="pocket-cancel">Cancelar</button><button class="pocket-primary" id="cover-confirm">Cubrir ahora</button></div>`;
    openPocketModal({title:`Cubrir ${d.icon} ${pocketEscape(d.name)}`,kicker:'COMPLETAR MÁS RÁPIDO',body,onReady:o=>{o.querySelector('.pocket-cancel').onclick=closePocketModal;const source=o.querySelector('#cover-source'),amount=o.querySelector('#cover-amount'),fb=o.querySelector('#cover-feedback'),btn=o.querySelector('#cover-confirm');const available=()=>{if(source.value==='saving')return Number(pocketSystem.saving.balance||0);if(source.value.startsWith('pocket:'))return Number(pocketById(source.value.split(':')[1])?.balance||0);if(source.value.startsWith('capital:'))return capitalAvailableForPocketTransfer(capital.find(c=>String(c.id)===source.value.split(':')[1]));return missing;};const update=()=>{const max=Math.max(0,Math.min(missing,available()));let v=Number(amount.value||0);if(v>max){v=max;amount.value=String(max);}const valid=v>0&&v<=max;fb.className=`pocket-feedback ${valid?'valid':'error'}`;fb.textContent=source.value==='debt'?`Esto creará una deuda de ${pocketMoney(v)}.`:(valid?`Se descontará ahora ${pocketMoney(v)} de la fuente seleccionada.`:`Máximo disponible desde esta fuente: ${pocketMoney(max)}`);btn.disabled=!valid;};source.onchange=()=>{amount.value=String(Math.min(missing,available()));update();};amount.oninput=update;update();btn.onclick=()=>{let v=Number(amount.value||0),src=source.value;const max=Math.max(0,Math.min(missing,available()));v=Math.min(v,max);if(!(v>0))return;if(src==='saving'){pocketSystem.saving.balance-=v;savingHistory('resta',`Cubrir ${d.name}: -${pocketMoney(v)}`,v);}else if(src.startsWith('pocket:')){const other=pocketById(src.split(':')[1]);if(typeof changePocketBalanceWithLink==='function')changePocketBalanceWithLink(other,-v,{notify:true,reason:`Transferido a ${d.name}`});else other.balance-=v;pocketHistory(other,'resta',`Transferido a ${d.name}: ${pocketMoney(v)}`,v);}else if(src.startsWith('capital:')){const cap=capital.find(c=>String(c.id)===src.split(':')[1]);cap.balance-=v;history.unshift({date:new Date().toISOString().slice(0,10),type:'resta',detail:`${cap.name}: ${pocketMoney(v)} usados para ${d.name}`});}else{debts.push({id:typeof genId==='function'?genId(debts):pocketId(),person:d.name,entries:[{reason:`Financiación de ${d.name}`,amount:v}],total:v});history.unshift({date:new Date().toISOString().slice(0,10),type:'suma',detail:`Deuda creada para ${d.name}: ${pocketMoney(v)}`});}const before=d.status;d.reserved=Number(d.reserved||0)+v;d.status=desireStatus(d);pocketHistory(p,'suma',`Cubrir ${d.name}: +${pocketMoney(v)}`,v);closePocketModal();refreshPocketSurface();if(before!=='completed'&&d.status==='completed')showDesireCelebration(d);openPocketDetail(p);};}});
}

function completeDesire(p,d){
    const amount=Number(d.reserved||0);if(amount<=0)return;
    const body=`<div class="completion-choice"><p>Has reunido <strong>${pocketMoney(amount)}</strong> para ${pocketEscape(d.name)}.</p><button type="button" id="complete-archive"><span>🎉</span><div><strong>Completar y archivar</strong><small>El deseo desaparece de la vista activa y queda registrado en el historial.</small></div></button><button type="button" id="complete-repeat"><span>🔁</span><div><strong>Completar y volver a empezar</strong><small>Mantiene el deseo para una meta recurrente y reinicia su progreso a $0.</small></div></button><button type="button" class="pocket-cancel full">Cancelar</button></div>`;
    openPocketModal({title:`Completar ${pocketEscape(d.icon)} ${pocketEscape(d.name)}`,kicker:'OBJETIVO ALCANZADO',body,onReady:o=>{
        o.querySelector('.pocket-cancel').onclick=closePocketModal;
        const finish=(repeat)=>{const now=new Date();d.spent=Number(d.spent||0)+amount;const detail=`🎉 Objetivo completado: ${d.name} · ${pocketMoney(amount)} · ${now.toLocaleDateString('es-CO')}`;pocketHistory(p,'edicion',detail,amount);if(repeat){d.reserved=0;d.status='thinking';d.lastCompletedAt=now.toISOString();d.completionCount=Number(d.completionCount||0)+1;}else{p.desires=p.desires.filter(x=>String(x.id)!==String(d.id));}closePocketModal();refreshPocketSurface();if(repeat)openPocketDetail(p);else openPocketDetail(p);};
        o.querySelector('#complete-archive').onclick=()=>finish(false);o.querySelector('#complete-repeat').onclick=()=>finish(true);
    }});
}
async function deleteDesire(p,d){
    if(Number(d.reserved||0)<=0){const ok=await pocketConfirm({title:'Eliminar deseo',message:`¿Eliminar ${d.name}?`,confirmText:'Eliminar',danger:true});if(!ok)return;p.desires=p.desires.filter(x=>x.id!==d.id);pocketHistory(p,'edicion',`Deseo eliminado: ${d.name}`);refreshPocketSurface();return openPocketDetail(p);}
    const body=`<p>Hay <strong>${pocketMoney(d.reserved)}</strong> reservados en este deseo.</p><div class="delete-choice"><button id="return-money">↩ Devolver al bolsillo</button><button id="spend-money">🧾 Registrar como gasto</button></div><button class="pocket-cancel full">Cancelar</button>`;
    openPocketModal({title:`Eliminar ${pocketEscape(d.name)}`,kicker:'¿QUÉ HACEMOS CON EL DINERO?',body,onReady:o=>{o.querySelector('.pocket-cancel').onclick=closePocketModal;o.querySelector('#return-money').onclick=()=>{if(typeof changePocketBalanceWithLink==='function')changePocketBalanceWithLink(p,Number(d.reserved||0),{notify:true,reason:`Dinero devuelto desde ${d.name}`});else p.balance+=d.reserved;pocketHistory(p,'suma',`Dinero devuelto desde ${d.name}: ${pocketMoney(d.reserved)}`,d.reserved);p.desires=p.desires.filter(x=>x.id!==d.id);closePocketModal();refreshPocketSurface();openPocketDetail(p);};o.querySelector('#spend-money').onclick=()=>{pocketHistory(p,'resta',`Dinero de ${d.name} registrado como gasto: ${pocketMoney(d.reserved)}`,d.reserved);p.desires=p.desires.filter(x=>x.id!==d.id);closePocketModal();refreshPocketSurface();openPocketDetail(p);};}});
}

/* =====================================================
   TRANSFERENCIA MANUAL DESDE CAPITAL
===================================================== */
function openPocketTransferModal(){
    const sources=capital.map(c=>({c,available:capitalAvailableForPocketTransfer(c)})).filter(x=>x.available>0);
    const destinations=[{value:'saving',label:`💰 Ahorro · ${pocketMoney(pocketSystem.saving.balance)}`},...pockets.map(p=>({value:`pocket:${p.id}`,label:`${p.icon||'🐷'} ${p.name} · ${pocketMoney(p.balance)}${p.hidden?' · oculto':''}`}))];
    const body=`<p class="modal-help">Mueve dinero voluntariamente desde un Capital hacia Ahorro o un bolsillo, sin registrar un ingreso.</p><label>Origen<select id="transfer-source">${sources.length?sources.map(x=>`<option value="${x.c.id}">${pocketEscape(x.c.icon||'💰')} ${pocketEscape(x.c.name)} · disponible ${pocketMoney(x.available)}</option>`).join(''):'<option value="">No hay capital disponible</option>'}</select></label><label>Destino<select id="transfer-destination">${destinations.map(x=>`<option value="${x.value}">${pocketEscape(x.label)}</option>`).join('')}</select></label><label>Monto<input id="transfer-amount" type="number" min="0" step="1000" placeholder="0"></label><div id="transfer-feedback" class="pocket-feedback"></div><div class="pocket-modal-actions"><button class="pocket-cancel">Cancelar</button><button class="pocket-primary" id="transfer-confirm" disabled>Transferir</button></div>`;
    openPocketModal({title:'Transferir a Bolsillos',kicker:'MOVIMIENTO MANUAL',body,onReady:o=>{const src=o.querySelector('#transfer-source'),dst=o.querySelector('#transfer-destination'),amount=o.querySelector('#transfer-amount'),fb=o.querySelector('#transfer-feedback'),btn=o.querySelector('#transfer-confirm');o.querySelector('.pocket-cancel').onclick=closePocketModal;const update=()=>{const cap=capital.find(c=>String(c.id)===String(src.value));const max=capitalAvailableForPocketTransfer(cap);let v=Number(amount.value||0);if(v>max){v=max;amount.value=String(max);}const valid=Boolean(cap)&&v>0&&v<=max&&dst.value;fb.className=`pocket-feedback ${valid?'valid':'error'}`;fb.textContent=cap?(valid?`Se moverán ${pocketMoney(v)} desde ${cap.name}.`:`Disponible en ${cap.name}: ${pocketMoney(max)}`):'No hay Capital con dinero disponible.';btn.disabled=!valid;};src.onchange=amount.oninput=update;update();btn.onclick=()=>{const cap=capital.find(c=>String(c.id)===String(src.value));const max=capitalAvailableForPocketTransfer(cap);const v=Math.min(Number(amount.value||0),max);if(!cap||!(v>0))return;
        if(dst.value==='saving'){
            cap.balance-=v;history.unshift({date:new Date().toISOString().slice(0,10),type:'resta',module:'capital',section:'capital',action:'transfer',objectId:cap.id,objectName:cap.name,amount:v,detail:`${cap.name}: transferencia manual -${pocketMoney(v)}`});
            const s=pocketSystem.saving;s.previousContribution=Number(s.lastContribution||0);s.lastContribution=v;s.balance+=v;s.totalReceived+=v;savingHistory('suma',`Transferencia desde ${cap.name}: +${pocketMoney(v)}`,v);
        }else{
            const target=pocketById(dst.value.split(':')[1]);if(!target)return;const pair=typeof getPocketCapitalPair==='function'?getPocketCapitalPair(target):null;
            if(pair){
                if(String(pair.acc.id)!==String(cap.id)){cap.balance-=v;pair.acc.balance=Number(pair.acc.balance||0)+v;}
                history.unshift({date:new Date().toISOString().slice(0,10),type:'resta',module:'capital',section:'capital',action:'transfer',objectId:cap.id,objectName:cap.name,amount:v,detail:`${cap.name}: transferencia a ${target.name} -${pocketMoney(v)}`});
            }else{
                cap.balance-=v;history.unshift({date:new Date().toISOString().slice(0,10),type:'resta',module:'capital',section:'capital',action:'transfer',objectId:cap.id,objectName:cap.name,amount:v,detail:`${cap.name}: transferencia manual -${pocketMoney(v)}`});
            }
            applyPocketContribution(target,v,`Transferencia desde ${cap.name}`);
        }
        closePocketModal();refreshAll();showToast('Transferencia realizada');};}});
}


/* =====================================================
   MENÚ DE BOLSILLO / ORGANIZAR
===================================================== */
function pocketTotalFunds(p){
    const reserved=(p?.desires||[]).reduce((sum,d)=>sum+Math.max(0,Number(d.reserved||0)),0);
    return Math.max(0,Number(p?.balance||0))+reserved;
}

function removePocketCompletely(p,{detail=''}={}){
    const idx=pockets.indexOf(p);if(idx<0)return;
    if(p?.link && typeof unlinkPocketCapital==='function')unlinkPocketCapital(p,{record:true,reason:'Bolsillo eliminado'});
    pockets.splice(idx,1);normalizePocketOrders();syncPocketState();
    history.unshift({date:new Date().toISOString().slice(0,10),type:'edicion',detail:detail||`Bolsillo eliminado: ${p.name}`});
    closePocketModal();renderPockets();if(typeof calcAndRenderTotals==='function')calcAndRenderTotals();
}

function openPocketDeleteFlow(p){
    const total=pocketTotalFunds(p);
    const linkedPair=typeof getPocketCapitalPair==='function'?getPocketCapitalPair(p):null;
    const capitalOptions=(Array.isArray(capital)?capital:[]).map(c=>`<option value="capital:${c.id}">${pocketEscape(c.icon||'💰')} ${pocketEscape(c.name)}</option>`).join('');
    const body=`
        <div class="block-delete-warning"><span>⚠️</span><div><strong>Eliminar ${pocketEscape(p.name)}</strong><p>Al eliminar este bloque se perderán su historial, deseos y configuración. Actualmente contiene <b>${pocketMoney(total)}</b> entre saldo y dinero reservado en deseos.${linkedPair?` Está vinculado con <b>${pocketEscape(linkedPair.acc.name)} · ${pocketEscape(linkedPair.sub.name)}</b>; la división conservará su saldo y quedará desvinculada.`:''}</p></div></div>
        <div class="block-delete-transfer">
            <label>Transferir todo antes de eliminar
                <select id="delete-pocket-destination"><option value="saving">💰 Ahorro</option>${capitalOptions}</select>
            </label>
            <button type="button" class="pocket-primary" id="delete-pocket-transfer" ${total<=0?'disabled':''}>⇄ Transferir ${pocketMoney(total)} y eliminar</button>
        </div>
        <div class="delete-choice-separator"><span>o</span></div>
        <button type="button" class="delete-with-money" id="delete-pocket-force">🗑️ Eliminar bloque con todo y dinero</button>
        <button type="button" class="pocket-cancel full">Cancelar eliminación</button>`;
    openPocketModal({title:'Eliminar bolsillo',kicker:'ACCIÓN IMPORTANTE',body,onReady:o=>{
        o.querySelector('.pocket-cancel').onclick=closePocketModal;
        const transfer=o.querySelector('#delete-pocket-transfer');
        if(transfer)transfer.onclick=async()=>{
            if(!(total>0))return;
            const dest=o.querySelector('#delete-pocket-destination').value;
            const ok=await pocketConfirm({title:'Transferir y eliminar',message:`Se transferirán ${pocketMoney(total)} antes de eliminar ${p.name}.`,confirmText:'Transferir y eliminar'});if(!ok)return;
            if(dest==='saving'){
                const sv=pocketSystem.saving;sv.previousContribution=Number(sv.lastContribution||0);sv.lastContribution=total;sv.balance+=total;sv.totalReceived+=total;savingHistory('suma',`Recuperado al eliminar ${p.name}: +${pocketMoney(total)}`,total);
            }else if(dest.startsWith('capital:')){
                const target=capital.find(c=>String(c.id)===dest.split(':')[1]);if(!target)return;target.balance=Number(target.balance||0)+total;history.unshift({date:new Date().toISOString().slice(0,10),type:'suma',detail:`${target.name}: +${pocketMoney(total)} transferidos al eliminar ${p.name}`});
            }
            removePocketCompletely(p,{detail:`Bolsillo eliminado después de transferir ${pocketMoney(total)}: ${p.name}`});
            if(typeof renderAccounts==='function')renderAccounts();
        };
        o.querySelector('#delete-pocket-force').onclick=async()=>{
            const ok=await pocketConfirm({title:'Eliminar con todo y dinero',message:`Se eliminará ${p.name} y ${pocketMoney(total)} dejarán de formar parte de FeliOS. Esta acción no se puede deshacer.`,confirmText:'Eliminar definitivamente',danger:true});if(!ok)return;
            removePocketCompletely(p,{detail:`Bolsillo eliminado con ${pocketMoney(total)}: ${p.name}`});
        };
    }});
}

function openPocketActions(p,anchor){
    document.querySelectorAll('.economic-pocket-actions').forEach(x=>x.remove());const menu=document.createElement('div');menu.className='economic-pocket-actions';menu.innerHTML=`<button data-action="edit">✏️ Editar bolsillo</button><button data-action="detail">📂 Abrir bolsillo</button><button data-action="link">${p.link?'🔗 Gestionar vínculo':'🔗 Vincular con Capital'}</button><button data-action="hide">👁️ Ocultar</button><button data-action="delete" class="danger">🗑️ Eliminar</button>`;document.body.append(menu);const r=anchor.getBoundingClientRect(),w=190;let left=Math.min(window.innerWidth-w-10,r.right+8);if(left<10)left=10;if(left+w>window.innerWidth-10)left=Math.max(10,r.left-w-8);let top=Math.min(window.innerHeight-menu.offsetHeight-10,r.top);menu.style.left=`${left}px`;menu.style.top=`${Math.max(10,top)}px`;requestAnimationFrame(()=>menu.classList.add('show'));menu.onclick=e=>{const a=e.target.closest('button')?.dataset.action;if(!a)return;if(a==='edit')openPocketEditor(p);if(a==='detail')openPocketDetail(p);if(a==='link'&&typeof openPocketCapitalLinkModal==='function')openPocketCapitalLinkModal(p);if(a==='hide'){p.hidden=true;syncPocketState();renderPockets();}if(a==='delete')openPocketDeleteFlow(p);menu.remove();};setTimeout(()=>document.addEventListener('pointerdown',function out(ev){if(!menu.contains(ev.target)&&!anchor.contains(ev.target)){menu.remove();document.removeEventListener('pointerdown',out);}},0),0);
}
let pocketOrganizerDraft=null;
let pocketOrganizerSortCleanup=null;

function openPocketOrganizer(){
    document.querySelectorAll('#felios-pocket-organizer').forEach(x=>x.remove());
    const ordered=[...pockets].sort((a,b)=>Number(a.order)-Number(b.order));
    pocketOrganizerDraft=ordered.map(p=>({id:String(p.id),hidden:Boolean(p.hidden),order:Number(p.order)}));
    const overlay=document.createElement('div');overlay.id='felios-pocket-organizer';overlay.className='capital-organizer-overlay';overlay.innerHTML=`
        <div class="capital-organizer-panel" role="dialog" aria-modal="true">
            <div class="capital-organizer-head"><div><small>BOLSILLOS</small><h3>Organizar bolsillos</h3><p>Arrastra para cambiar el orden. Los ocultos conservan todos sus datos y puedes recuperarlos cuando quieras.</p></div><button type="button" class="capital-organizer-close">×</button></div>
            <div class="capital-organizer-body">
                <section><div class="capital-organizer-section-head"><strong>Visibles</strong><span class="pocket-organizer-visible-count"></span></div><div class="pocket-organizer-visible capital-organizer-visible"></div></section>
                <section class="capital-organizer-hidden-section"><div class="capital-organizer-section-head"><strong>Ocultos</strong><span>Selecciona para volver a mostrar</span></div><div class="pocket-organizer-hidden capital-organizer-hidden"></div></section>
            </div>
            <div class="capital-organizer-footer"><button type="button" class="organizer-cancel pocket-organizer-cancel">Cancelar</button><button type="button" class="organizer-save pocket-organizer-save">Guardar cambios</button></div>
        </div>`;
    document.body.append(overlay);document.body.classList.add('felios-organizer-open');
    const getDraft=id=>pocketOrganizerDraft.find(x=>String(x.id)===String(id));
    const normalize=()=>{const vis=pocketOrganizerDraft.filter(x=>!x.hidden).sort((a,b)=>a.order-b.order),hid=pocketOrganizerDraft.filter(x=>x.hidden).sort((a,b)=>a.order-b.order);[...vis,...hid].forEach((x,i)=>x.order=i);};
    const close=()=>{if(pocketOrganizerSortCleanup){pocketOrganizerSortCleanup();pocketOrganizerSortCleanup=null;}overlay.classList.remove('show');document.body.classList.remove('felios-organizer-open');setTimeout(()=>overlay.remove(),160);pocketOrganizerDraft=null;};
    const render=()=>{
        if(!pocketOrganizerDraft)return;const visible=pocketOrganizerDraft.filter(x=>!x.hidden).sort((a,b)=>a.order-b.order),hidden=pocketOrganizerDraft.filter(x=>x.hidden).sort((a,b)=>a.order-b.order);
        overlay.querySelector('.pocket-organizer-visible-count').textContent=`${visible.length}`;
        const vis=overlay.querySelector('.pocket-organizer-visible');vis.innerHTML=visible.map(d=>{const p=pocketById(d.id);return p?`<div class="capital-organizer-row" data-id="${p.id}"><button type="button" class="organizer-drag-handle" title="Arrastrar">☰</button><span class="organizer-icon">${pocketEscape(p.icon||'🐷')}</span><div class="organizer-main"><strong>${pocketEscape(p.name)}</strong><small>${p.type==='percent'?`${p.percent}%`:`Fijo ${pocketMoney(p.fixedAmount)}`} · ${pocketMoney(p.balance)}</small></div><button type="button" class="pocket-organizer-hide organizer-hide" data-id="${p.id}" title="Ocultar">👁️</button></div>`:'';}).join('');
        const hid=overlay.querySelector('.pocket-organizer-hidden');hid.innerHTML=hidden.length?hidden.map(d=>{const p=pocketById(d.id);return p?`<button type="button" class="capital-organizer-row hidden-row pocket-organizer-restore" data-id="${p.id}"><span class="organizer-icon">${pocketEscape(p.icon||'🐷')}</span><div class="organizer-main"><strong>${pocketEscape(p.name)}</strong><small>${pocketMoney(p.balance)} · Oculto</small></div><span class="organizer-restore-label">Mostrar</span></button>`:'';}).join(''):`<div class="organizer-empty">No hay bolsillos ocultos.</div>`;
        if(pocketOrganizerSortCleanup)pocketOrganizerSortCleanup();
        if(typeof enablePointerReorder==='function')pocketOrganizerSortCleanup=enablePointerReorder(vis,{itemSelector:'.capital-organizer-row',handleSelector:'.organizer-drag-handle',onCommit:ids=>{ids.forEach((id,i)=>{const d=getDraft(id);if(d)d.order=i;});normalize();render();}});
    };
    overlay.addEventListener('click',e=>{const hide=e.target.closest('.pocket-organizer-hide');if(hide){const d=getDraft(hide.dataset.id);if(d){d.hidden=true;normalize();render();}return;}const restore=e.target.closest('.pocket-organizer-restore');if(restore){const d=getDraft(restore.dataset.id);if(d){d.hidden=false;const visible=pocketOrganizerDraft.filter(x=>!x.hidden).sort((a,b)=>a.order-b.order);d.order=visible.length;normalize();render();}return;}});
    overlay.querySelector('.capital-organizer-close').onclick=close;overlay.querySelector('.pocket-organizer-cancel').onclick=close;overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close();});
    overlay.querySelector('.pocket-organizer-save').onclick=()=>{if(!pocketOrganizerDraft)return;pocketOrganizerDraft.forEach(d=>{const p=pocketById(d.id);if(p){p.hidden=d.hidden;p.order=d.order;}});normalizePocketOrders();syncPocketState();close();renderPockets();};
    render();requestAnimationFrame(()=>overlay.classList.add('show'));
}


/* =====================================================
   ACORDEÓN FLOTANTE DE DESEOS
===================================================== */
let activePocketDesireAccordionId=null;
let activePocketDesireAccordionCleanup=null;
function renderQuickPocketDesires(p){
    const desires=[...(p?.desires||[])].sort((a,b)=>Number(a.order)-Number(b.order));
    return `<div class="pocket-desires-floating-head"><div><span>DESEOS</span><strong>${desires.length} ${desires.length===1?'deseo':'deseos'}</strong></div><span>${pocketMoney(p.balance)}</span></div><div class="pocket-desires-floating-list">${desires.map(d=>renderDesireMini(d)).join('')}</div><button type="button" class="pocket-desires-open-detail" data-id="${p.id}">✏️ Abrir deseos</button>`;
}
function closePocketDesireAccordion(){
    if(activePocketDesireAccordionCleanup){activePocketDesireAccordionCleanup();activePocketDesireAccordionCleanup=null;}
    const panel=document.querySelector('.pocket-desires-floating-panel');if(panel){panel.classList.remove('show');setTimeout(()=>panel.isConnected&&panel.remove(),160);}
    document.querySelectorAll('.pocket-desires-trigger').forEach(b=>b.setAttribute('aria-expanded','false'));activePocketDesireAccordionId=null;
}
function positionPocketDesireAccordion(panel,card){
    if(!panel||!card||!card.isConnected)return;const rect=card.getBoundingClientRect(),margin=10,gap=8,width=Math.min(360,window.innerWidth-margin*2),height=panel.offsetHeight||220;let left=rect.left,top=rect.bottom+gap;if(left+width>window.innerWidth-margin)left=window.innerWidth-width-margin;left=Math.max(margin,left);if(top+height>window.innerHeight-margin)top=rect.top-height-gap;top=Math.max(margin,top);panel.style.left=`${Math.round(left)}px`;panel.style.top=`${Math.round(top)}px`;panel.style.width=`${width}px`;
}
function openPocketDesireAccordion(p,card,button){
    closePocketDesireAccordion();activePocketDesireAccordionId=String(p.id);const panel=document.createElement('div');panel.className='pocket-desires-floating-panel';panel.innerHTML=renderQuickPocketDesires(p);document.body.append(panel);button.setAttribute('aria-expanded','true');const reposition=()=>positionPocketDesireAccordion(panel,card);const outside=ev=>{if(panel.contains(ev.target)||card.contains(ev.target)||ev.target.closest?.('.pocket-desires-trigger'))return;closePocketDesireAccordion();};window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);requestAnimationFrame(()=>{reposition();panel.classList.add('show');});setTimeout(()=>document.addEventListener('pointerdown',outside),0);activePocketDesireAccordionCleanup=()=>{window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);document.removeEventListener('pointerdown',outside);};
}


/* =====================================================
   EVENTOS
===================================================== */
document.body.addEventListener('click',async e=>{
    if(e.target.closest('#pocket-start-setup'))return openPocketSetup();
    if(e.target.closest('#pocket-edit-distribution'))return openDistributionEditor();
    if(e.target.closest('#pocket-transfer'))return openPocketTransferModal();
    if(e.target.closest('#pocket-edit-base'))return openBaseIncomeEditor();
    if(e.target.closest('#pocket-add-income'))return openIncomeModal();
    if(e.target.closest('#pocket-income-history'))return openIncomeHistory();
    if(e.target.closest('#pocket-add-category')||e.target.closest('#pocket-add-category-empty'))return openPocketEditor();
    if(e.target.closest('#pocket-organize')||e.target.closest('#pocket-organize-empty'))return openPocketOrganizer();
    if(e.target.closest('.open-saving-history'))return openSavingHistory();
    const fixed=e.target.closest('.fixed-pocket-add');if(fixed)return manualFixedContribution(pocketById(fixed.dataset.id));
    const menu=e.target.closest('.economic-pocket-menu');if(menu){const p=pocketById(menu.dataset.id);if(p)return openPocketActions(p,menu);}
    const desireTrigger=e.target.closest('.pocket-desires-trigger');if(desireTrigger){const p=pocketById(desireTrigger.dataset.id),card=desireTrigger.closest('.economic-pocket-card');if(!p||!card)return;if(activePocketDesireAccordionId===String(p.id)){closePocketDesireAccordion();return;}openPocketDesireAccordion(p,card,desireTrigger);return;}
    const desireOpen=e.target.closest('.pocket-desires-open-detail');if(desireOpen){const p=pocketById(desireOpen.dataset.id);closePocketDesireAccordion();if(p)return openPocketDetail(p);}
    const detail=e.target.closest('.open-pocket-detail');if(detail){const p=pocketById(detail.dataset.id);if(p)return openPocketDetail(p);}
    const hist=e.target.closest('.detail-history');if(hist){const p=pocketById(hist.dataset.id);if(p)return openPocketHistory(p);}
    const addDes=e.target.closest('.detail-add-desire');if(addDes){const p=pocketById(addDes.dataset.id);if(p)return openDesireEditor(p);}
    const dcard=e.target.closest('.desire-card-full');if(dcard){const p=pocketById(dcard.dataset.pocketId),d=desireById(p,dcard.dataset.desireId);if(!p||!d)return;if(e.target.closest('.desire-contribute'))return openDesireMoneyModal(p,d,'contribute');if(e.target.closest('.desire-withdraw'))return openDesireMoneyModal(p,d,'withdraw');if(e.target.closest('.desire-cover-now'))return openCoverNow(p,d);if(e.target.closest('.desire-complete'))return completeDesire(p,d);if(e.target.closest('.desire-options')){const body=`<div class="action-list"><button id="desire-edit">✏️ Editar</button><button id="desire-delete" class="danger">🗑️ Eliminar</button></div>`;return openPocketModal({title:`${pocketEscape(d.icon)} ${pocketEscape(d.name)}`,kicker:'OPCIONES DEL DESEO',body,onReady:o=>{o.querySelector('#desire-edit').onclick=()=>openDesireEditor(p,d);o.querySelector('#desire-delete').onclick=()=>deleteDesire(p,d);}});}}
    const incomeDetail=e.target.closest('.income-history-detail');if(incomeDetail){const item=pocketSystem.incomes.find(i=>String(i.id)===String(incomeDetail.dataset.id));if(item){const rows=(item.distribution||[]).map(r=>`<div><span>${pocketEscape(r.name)}</span><strong>${pocketMoney(r.amount)}</strong></div>`).join('');return openPocketModal({title:item.label||'Ingreso',kicker:new Date(item.date).toLocaleDateString('es-CO'),body:`<div class="simulation-card"><div class="simulation-head"><span>Total</span><strong>${pocketMoney(item.amount)}</strong></div><div class="simulation-rows">${rows}<div class="saving-row"><span>💰 Ahorro</span><strong>${pocketMoney(item.savingContribution)}</strong></div></div></div>`});}}
});

window.renderPockets=renderPockets;
