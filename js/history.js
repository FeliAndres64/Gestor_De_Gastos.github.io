/* =====================================================
   FELIOS ECONOMY — HISTORIAL v2
   - Filtros jerárquicos: módulo → objeto → tipo
   - Rangos rápidos + fechas personalizadas
   - Búsqueda instantánea
   - Orden por fecha financiera (más reciente primero)
   - Compatibilidad con eventos antiguos y nuevos
===================================================== */

const HISTORY_DEFAULT_RANGE = 'month';

const historyUIState = {
    module: 'all',
    object: 'all',
    action: 'all',
    range: HISTORY_DEFAULT_RANGE,
    from: '',
    to: '',
    query: ''
};

function historyEscape(value){
    return String(value ?? '')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#039;');
}

function historyNormalizeText(value=''){
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'')
        .toLocaleLowerCase('es');
}

function historyDateOnly(value){
    if(!value) return '';
    const raw=String(value);
    const iso=raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if(iso) return iso[1];
    const d=new Date(raw);
    if(Number.isNaN(d.getTime())) return '';
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
}

function historyToday(){
    return historyDateOnly(new Date().toISOString());
}

function historyAddDays(dateString,days){
    const d=new Date(`${dateString}T12:00:00`);
    d.setDate(d.getDate()+days);
    return historyDateOnly(d.toISOString());
}

function historyFormatDate(dateString,{long=false}={}){
    if(!dateString) return 'Sin fecha';
    const d=new Date(`${dateString}T12:00:00`);
    if(Number.isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('es-CO', long
        ? {day:'numeric',month:'long',year:'numeric'}
        : {day:'2-digit',month:'short',year:'numeric'}
    ).format(d);
}

function historyGroupDateLabel(dateString){
    const today=historyToday();
    if(dateString===today) return 'Hoy';
    if(dateString===historyAddDays(today,-1)) return 'Ayer';
    const d=new Date(`${dateString}T12:00:00`);
    if(Number.isNaN(d.getTime())) return dateString || 'Sin fecha';
    const current=new Date(`${today}T12:00:00`);
    const sameYear=d.getFullYear()===current.getFullYear();
    return new Intl.DateTimeFormat('es-CO',sameYear
        ? {weekday:'long',day:'numeric',month:'long'}
        : {day:'numeric',month:'long',year:'numeric'}
    ).format(d);
}

function historyMoney(value){
    const n=Number(value||0);
    if(!Number.isFinite(n)) return '';
    if(typeof fmt!=='undefined' && fmt?.format) return fmt.format(n);
    return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n);
}

function historyCurrentCapitalNames(){
    return (Array.isArray(window.capital)?window.capital:[])
        .map(x=>({id:x.id,name:x.name||'Capital',icon:x.icon||'💰'}));
}

function historyCurrentPocketNames(){
    return (Array.isArray(window.pockets)?window.pockets:[])
        .map(x=>({id:x.id,name:x.name||'Bolsillo',icon:x.icon||'🐷'}));
}

function historyDebtPeople(){
    const rows=[];
    (Array.isArray(window.debts)?window.debts:[]).forEach(g=>rows.push({direction:'debt',person:g.person||'Sin nombre',icon:g.icon||'👤'}));
    (Array.isArray(window.credits)?window.credits:[]).forEach(g=>rows.push({direction:'credit',person:g.person||'Sin nombre',icon:g.icon||'👤'}));
    return rows;
}

function historyInferModule(raw){
    if(['capital','pockets','debts'].includes(raw?.module)) return raw.module;
    const text=historyNormalizeText(`${raw?.detail||''} ${raw?.section||''} ${raw?.source||''} ${raw?.destination||''}`);

    if(/deuda|cobro|por cobrar|me deben|pago de deuda|persona actualizada/.test(text)) return 'debts';
    if(/ahorro|bolsillo|deseo|ingreso registrado|sueldo|meta|aporte/.test(text)) return 'pockets';

    const capitalNames=historyCurrentCapitalNames();
    if(/capital|division|saldo de|transferencia manual/.test(text)) return 'capital';
    if(capitalNames.some(c=>text.includes(historyNormalizeText(c.name)))) return 'capital';

    return 'general';
}

function historyInferDebtDirection(raw,text){
    if(raw?.direction==='debt' || raw?.direction==='credit') return raw.direction;
    if(/cobro|por cobrar|me deben|recibido/.test(text)) return 'credit';
    if(/deuda|pago/.test(text)) return 'debt';
    return '';
}

function historyInferObject(raw,module){
    const detail=String(raw?.detail||'');
    const text=historyNormalizeText(`${detail} ${raw?.person||''} ${raw?.reason||''}`);

    if(module==='capital'){
        const explicit=raw?.objectName || raw?.accountName || '';
        if(explicit){
            const live=historyCurrentCapitalNames().find(c=>String(c.id)===String(raw?.objectId));
            return {key:`capital:${String(raw?.objectId ?? historyNormalizeText(explicit))}`,label:explicit,icon:live?.icon||'💰'};
        }
        const match=historyCurrentCapitalNames().find(c=>text.includes(historyNormalizeText(c.name)));
        if(match) return {key:`capital:${String(match.id)}`,label:match.name,icon:match.icon};
        const patterns=[
            /saldo de\s+([^:]+):/i,
            /capital (?:ocultado|eliminado):\s*([^·:]+)/i,
            /divisi[oó]n (?:creada en|eliminada de)\s+([^:]+):/i,
            /^([^:·]+)\s*[·:]/
        ];
        for(const pattern of patterns){
            const m=detail.match(pattern);
            const name=m?.[1]?.trim();
            if(name && !/^(capital|orden|color)$/i.test(name)) return {key:`capital:legacy:${historyNormalizeText(name)}`,label:name,icon:'💰'};
        }
        return {key:'capital:general',label:'Capital general',icon:'💰'};
    }

    if(module==='pockets'){
        if(raw?.objectType==='saving' || /ahorro/.test(text)) return {key:'pockets:saving',label:'Ahorro',icon:'💰'};
        if(raw?.objectName){
            const live=historyCurrentPocketNames().find(p=>String(p.id)===String(raw?.objectId));
            return {key:`pockets:${String(raw?.objectId ?? historyNormalizeText(raw.objectName))}`,label:String(raw.objectName),icon:live?.icon||'🐷'};
        }
        const match=historyCurrentPocketNames().find(p=>text.includes(historyNormalizeText(p.name)));
        if(match) return {key:`pockets:${String(match.id)}`,label:match.name,icon:match.icon};
        if(/ingreso|sueldo/.test(text)) return {key:'pockets:income',label:'Ingresos',icon:'💵'};
        const legacy=detail.match(/^(?:[^\w\s]{1,4}\s*)?([^:]{2,40}):/u)?.[1]?.trim();
        if(legacy && !/^ahorro$/i.test(legacy)) return {key:`pockets:legacy:${historyNormalizeText(legacy)}`,label:legacy,icon:'🐷'};
        return {key:'pockets:general',label:'Bolsillos general',icon:'🐷'};
    }

    if(module==='debts'){
        const direction=historyInferDebtDirection(raw,text);
        let person=String(raw?.person||'').trim();
        if(!person){
            const match=historyDebtPeople().find(p=>text.includes(historyNormalizeText(p.person)));
            if(match) person=match.person;
        }
        if(person){
            const prefix=direction==='credit'?'Me deben':direction==='debt'?'Debo':'Deudas';
            const icon=direction==='credit'?'🟢':direction==='debt'?'🔴':'👤';
            return {key:`debts:${direction||'any'}:${historyNormalizeText(person)}`,label:`${prefix} · ${person}`,icon};
        }
        return {key:`debts:${direction||'general'}`,label:direction==='credit'?'Me deben':direction==='debt'?'Debo':'Deudas general',icon:'🤝'};
    }

    return {key:'general:all',label:'General',icon:'•'};
}

function historyInferAction(raw,module){
    if(raw?.action){
        const map={
            create:'create',payment:'payment',collection:'collection',complete:'complete',edit:'edit',
            delete:'delete','person-edit':'person-edit','payment-date-edit':'date-edit'
        };
        return map[raw.action] || raw.action;
    }
    const text=historyNormalizeText(raw?.detail||'');

    if(module==='capital'){
        if(/transfer/.test(text)) return 'transfer';
        if(/division/.test(text) && /cread/.test(text)) return 'division-create';
        if(/division/.test(text) && /elimin/.test(text)) return 'division-delete';
        if(/division/.test(text)) return 'division';
        if(/saldo/.test(text)) return 'balance';
        if(/nuevo capital|cread/.test(text)) return 'create';
        if(/elimin/.test(text)) return 'delete';
        if(/ocult|orden|color|actualiz/.test(text)) return 'edit';
    }

    if(module==='pockets'){
        if(/ingreso registrado|sueldo/.test(text)) return 'income';
        if(/transfer/.test(text)) return 'transfer';
        if(/deseo|meta|cubrir|complet/.test(text)) return 'desire';
        if(/aporte|aportado/.test(text)) return 'contribution';
        if(/bolsillo eliminado/.test(text)) return 'delete';
        if(/nuevo bolsillo/.test(text)) return 'create';
        if(/actualizado/.test(text)) return 'edit';
        if(/fijo/.test(text)) return 'fixed';
    }

    if(module==='debts'){
        if(/pago/.test(text) && /fecha/.test(text)) return 'date-edit';
        if(/cobro/.test(text) && /fecha/.test(text)) return 'date-edit';
        if(/complet|pagada/.test(text)) return 'complete';
        if(/pago/.test(text)) return 'payment';
        if(/cobro/.test(text) && !/cread/.test(text)) return 'collection';
        if(/deuda creada|por cobrar creado/.test(text)) return 'create';
        if(/elimin/.test(text)) return 'delete';
        if(/actualiz|edit/.test(text)) return 'edit';
    }

    if(raw?.type==='suma') return 'increase';
    if(raw?.type==='resta') return 'decrease';
    if(raw?.type==='edicion') return 'edit';
    return 'other';
}

function historyActionLabel(action,module=''){
    const labels={
        create:'Creación',payment:'Pago',collection:'Cobro',complete:'Completado',edit:'Edición',delete:'Eliminación',
        'person-edit':'Persona', 'date-edit':'Fecha corregida', transfer:'Transferencia', balance:'Saldo', division:'División',
        'division-create':'Nueva división','division-delete':'División eliminada',income:'Ingreso',desire:'Deseo / meta',
        contribution:'Aporte',fixed:'Fijo',increase:'Entrada',decrease:'Salida',other:'Otro'
    };
    if(module==='debts' && action==='create') return 'Nueva deuda / cobro';
    return labels[action] || String(action||'Otro');
}

function historyModuleMeta(module){
    return {
        capital:{label:'Capital',icon:'💳'},
        pockets:{label:'Bolsillos',icon:'🐷'},
        debts:{label:'Deudas',icon:'🤝'},
        general:{label:'General',icon:'•'}
    }[module] || {label:'General',icon:'•'};
}

function historySemantic(raw,action){
    if(['suma','resta','edicion'].includes(raw?.type)) return raw.type;
    if(['payment','decrease','delete'].includes(action)) return 'resta';
    if(['collection','income','increase','contribution','create'].includes(action)) return 'suma';
    return 'edicion';
}

function historyViewEvent(raw,index){
    const module=historyInferModule(raw||{});
    const object=historyInferObject(raw||{},module);
    const action=historyInferAction(raw||{},module);
    const effectiveDate=historyDateOnly(raw?.date || raw?.occurredAt || raw?.createdAt) || historyToday();
    const createdDate=historyDateOnly(raw?.createdAt);
    const detail=String(raw?.detail || raw?.reason || 'Movimiento');
    const amount=Number(raw?.amount||0);
    const moduleMeta=historyModuleMeta(module);
    const searchBlob=historyNormalizeText([
        detail,moduleMeta.label,object.label,historyActionLabel(action,module),raw?.person,raw?.reason,raw?.source,raw?.destination
    ].filter(Boolean).join(' '));

    return {
        raw,index,module,moduleLabel:moduleMeta.label,moduleIcon:moduleMeta.icon,
        objectKey:object.key,objectLabel:object.label,objectIcon:object.icon,
        action,actionLabel:historyActionLabel(action,module),
        semantic:historySemantic(raw,action),effectiveDate,createdDate,detail,amount,
        source:String(raw?.source||''),destination:String(raw?.destination||''),
        searchBlob
    };
}

function historyAllEvents(){
    return (Array.isArray(history)?history:[])
        .map((h,i)=>historyViewEvent(h,i))
        .sort((a,b)=>{
            const dateCompare=String(b.effectiveDate).localeCompare(String(a.effectiveDate));
            if(dateCompare) return dateCompare;
            const createdCompare=String(b.raw?.createdAt||'').localeCompare(String(a.raw?.createdAt||''));
            if(createdCompare) return createdCompare;
            return a.index-b.index;
        });
}

function historyRangeBounds(range){
    const today=historyToday();
    const now=new Date(`${today}T12:00:00`);
    if(range==='today') return {from:today,to:today};
    if(range==='7d') return {from:historyAddDays(today,-6),to:today};
    if(range==='month') return {from:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`,to:today};
    if(range==='prev-month'){
        const firstCurrent=new Date(now.getFullYear(),now.getMonth(),1,12);
        const lastPrev=new Date(firstCurrent);lastPrev.setDate(0);
        const firstPrev=new Date(lastPrev.getFullYear(),lastPrev.getMonth(),1,12);
        return {from:historyDateOnly(firstPrev.toISOString()),to:historyDateOnly(lastPrev.toISOString())};
    }
    if(range==='custom') return {from:historyUIState.from,to:historyUIState.to};
    return {from:'',to:''};
}

function historyFilteredEvents(){
    const all=historyAllEvents();
    const bounds=historyRangeBounds(historyUIState.range);
    const q=historyNormalizeText(historyUIState.query.trim());
    return all.filter(e=>{
        if(historyUIState.module!=='all' && e.module!==historyUIState.module) return false;
        if(historyUIState.object!=='all' && e.objectKey!==historyUIState.object) return false;
        if(historyUIState.action!=='all' && e.action!==historyUIState.action) return false;
        if(bounds.from && e.effectiveDate<bounds.from) return false;
        if(bounds.to && e.effectiveDate>bounds.to) return false;
        if(q && !e.searchBlob.includes(q)) return false;
        return true;
    });
}

function historyObjectOptions(events,module){
    const filtered=module==='all'?events:events.filter(e=>e.module===module);
    const map=new Map();
    filtered.forEach(e=>map.set(e.objectKey,{key:e.objectKey,label:e.objectLabel,icon:e.objectIcon}));

    if(module==='capital') historyCurrentCapitalNames().forEach(c=>map.set(`capital:${String(c.id)}`,{key:`capital:${String(c.id)}`,label:c.name,icon:c.icon}));
    if(module==='pockets'){
        map.set('pockets:saving',{key:'pockets:saving',label:'Ahorro',icon:'💰'});
        historyCurrentPocketNames().forEach(p=>map.set(`pockets:${String(p.id)}`,{key:`pockets:${String(p.id)}`,label:p.name,icon:p.icon}));
    }
    if(module==='debts'){
        historyDebtPeople().forEach(p=>{
            const key=`debts:${p.direction}:${historyNormalizeText(p.person)}`;
            const label=`${p.direction==='credit'?'Me deben':'Debo'} · ${p.person}`;
            map.set(key,{key,label,icon:p.direction==='credit'?'🟢':'🔴'});
        });
    }
    return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'es'));
}

function historyActionOptions(events,module,objectKey){
    let filtered=events;
    if(module!=='all') filtered=filtered.filter(e=>e.module===module);
    if(objectKey!=='all') filtered=filtered.filter(e=>e.objectKey===objectKey);
    const map=new Map();
    filtered.forEach(e=>map.set(e.action,{key:e.action,label:e.actionLabel}));
    return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'es'));
}

function historyIconFor(event){
    const actionIcons={
        payment:'↘',collection:'↗',complete:'🎉',transfer:'⇄',income:'↓',desire:'★',contribution:'＋',
        balance:'↕',create:'＋',delete:'×',edit:'✎','person-edit':'✎','date-edit':'◷',division:'◇',
        'division-create':'＋','division-delete':'×',increase:'↑',decrease:'↓',fixed:'◆'
    };
    return actionIcons[event.action] || (event.semantic==='suma'?'↑':event.semantic==='resta'?'↓':'✎');
}

function historyRenderSelectOptions(){
    const all=historyAllEvents();
    const objectSelect=document.getElementById('history-filter-object');
    const actionSelect=document.getElementById('history-filter-action');
    if(!objectSelect||!actionSelect) return;

    const objects=historyObjectOptions(all,historyUIState.module);
    objectSelect.innerHTML=`<option value="all">${historyUIState.module==='all'?'Todos los objetos':'Todo el módulo'}</option>`+
        objects.map(o=>`<option value="${historyEscape(o.key)}">${historyEscape(`${o.icon||''} ${o.label}`.trim())}</option>`).join('');
    if(!objects.some(o=>o.key===historyUIState.object)) historyUIState.object='all';
    objectSelect.value=historyUIState.object;
    objectSelect.disabled=historyUIState.module==='all';

    const actions=historyActionOptions(all,historyUIState.module,historyUIState.object);
    actionSelect.innerHTML=`<option value="all">Todos los tipos</option>`+
        actions.map(a=>`<option value="${historyEscape(a.key)}">${historyEscape(a.label)}</option>`).join('');
    if(!actions.some(a=>a.key===historyUIState.action)) historyUIState.action='all';
    actionSelect.value=historyUIState.action;
}

function historyUpdateControls(){
    document.querySelectorAll('[data-history-module]').forEach(btn=>btn.classList.toggle('active',btn.dataset.historyModule===historyUIState.module));
    document.querySelectorAll('[data-history-range]').forEach(btn=>btn.classList.toggle('active',btn.dataset.historyRange===historyUIState.range));
    const custom=document.getElementById('history-custom-dates');
    if(custom) custom.classList.toggle('show',historyUIState.range==='custom');
    const from=document.getElementById('history-from');if(from) from.value=historyUIState.from;
    const to=document.getElementById('history-to');if(to) to.value=historyUIState.to;
    const search=document.getElementById('history-search');if(search && search.value!==historyUIState.query) search.value=historyUIState.query;
    historyRenderSelectOptions();
}

function historyRenderSummary(filtered,total){
    const el=document.getElementById('history-result-summary');
    if(!el) return;
    const rangeLabel={today:'Hoy','7d':'Últimos 7 días',month:'Este mes','prev-month':'Mes anterior',all:'Todo el historial',custom:'Rango personalizado'}[historyUIState.range]||'Historial';
    el.innerHTML=`<strong>${filtered.length}</strong> movimiento${filtered.length===1?'':'s'} <span>· ${historyEscape(rangeLabel)}</span>${total!==filtered.length?` <small>de ${total}</small>`:''}`;
}

function historyRenderItem(e){
    const moved=e.source||e.destination
        ? `<div class="history-route">${e.source?`<span>${historyEscape(e.source)}</span>`:''}${e.source&&e.destination?'<b>→</b>':''}${e.destination?`<span>${historyEscape(e.destination)}</span>`:''}</div>`
        : '';
    const registeredDifferent=e.createdDate && e.createdDate!==e.effectiveDate;
    const amount=e.amount>0?`<strong class="history-amount">${historyEscape(historyMoney(e.amount))}</strong>`:'';
    return `<article class="history-event ${historyEscape(e.semantic)}">
        <div class="history-event-icon">${historyEscape(historyIconFor(e))}</div>
        <div class="history-event-main">
            <div class="history-event-topline">
                <div class="history-event-tags">
                    <span>${historyEscape(e.moduleIcon)} ${historyEscape(e.moduleLabel)}</span>
                    <span>${historyEscape(e.objectLabel)}</span>
                    <span>${historyEscape(e.actionLabel)}</span>
                </div>
                ${amount}
            </div>
            <div class="history-event-detail">${historyEscape(e.detail)}</div>
            <div class="history-event-foot">
                ${moved}
                <span class="history-effective-date">${historyEscape(historyFormatDate(e.effectiveDate))}</span>
                ${registeredDifferent?`<span class="history-recorded-date">Registrado ${historyEscape(historyFormatDate(e.createdDate))}</span>`:''}
            </div>
        </div>
    </article>`;
}

function renderHistory(filters={}){
    // Compatibilidad con llamadas antiguas a renderHistory({from,to,type,text}).
    if(filters && Object.keys(filters).length){
        if(filters.from || filters.to){historyUIState.range='custom';historyUIState.from=filters.from||'';historyUIState.to=filters.to||'';}
        if(filters.text!=null) historyUIState.query=filters.text;
        if(filters.type){
            historyUIState.action=filters.type==='suma'?'increase':filters.type==='resta'?'decrease':filters.type==='edicion'?'edit':'all';
        }
    }

    historyUpdateControls();
    const all=historyAllEvents();
    const list=historyFilteredEvents();
    historyRenderSummary(list,all.length);

    const container=document.getElementById('history-list');
    if(!container) return;

    if(!list.length){
        container.innerHTML=`<div class="history-empty">
            <div>⌕</div><strong>No hay movimientos con estos filtros</strong>
            <p>Prueba otro periodo, objeto o término de búsqueda.</p>
            <button type="button" id="history-show-all">Ver todo el historial</button>
        </div>`;
        return;
    }

    let lastDate='';
    container.innerHTML=list.map(e=>{
        const group=e.effectiveDate!==lastDate
            ? `<div class="history-date-group"><span>${historyEscape(historyGroupDateLabel(e.effectiveDate))}</span><small>${historyEscape(historyFormatDate(e.effectiveDate))}</small></div>`
            : '';
        lastDate=e.effectiveDate;
        return group+historyRenderItem(e);
    }).join('');
}

function historyReset({keepRange=false}={}){
    historyUIState.module='all';
    historyUIState.object='all';
    historyUIState.action='all';
    historyUIState.query='';
    historyUIState.from='';
    historyUIState.to='';
    if(!keepRange) historyUIState.range=HISTORY_DEFAULT_RANGE;
    renderHistory();
}

function historyBindUI(){
    const modal=document.getElementById('modalHistory');
    if(!modal || modal.dataset.historyV2Bound==='1') return;
    modal.dataset.historyV2Bound='1';

    modal.addEventListener('shown.bs.modal',()=>renderHistory());

    modal.addEventListener('click',e=>{
        const moduleBtn=e.target.closest('[data-history-module]');
        if(moduleBtn){
            historyUIState.module=moduleBtn.dataset.historyModule||'all';
            historyUIState.object='all';historyUIState.action='all';
            renderHistory();return;
        }
        const rangeBtn=e.target.closest('[data-history-range]');
        if(rangeBtn){historyUIState.range=rangeBtn.dataset.historyRange||'month';renderHistory();return;}
        if(e.target.closest('#history-reset')){historyReset();return;}
        if(e.target.closest('#history-show-all')){historyUIState.range='all';renderHistory();return;}
    });

    const object=document.getElementById('history-filter-object');
    const action=document.getElementById('history-filter-action');
    const search=document.getElementById('history-search');
    const from=document.getElementById('history-from');
    const to=document.getElementById('history-to');

    if(object) object.addEventListener('change',()=>{historyUIState.object=object.value||'all';historyUIState.action='all';renderHistory();});
    if(action) action.addEventListener('change',()=>{historyUIState.action=action.value||'all';renderHistory();});
    if(from) from.addEventListener('change',()=>{historyUIState.from=from.value;historyUIState.range='custom';renderHistory();});
    if(to) to.addEventListener('change',()=>{historyUIState.to=to.value;historyUIState.range='custom';renderHistory();});
    if(search){
        let timer=null;
        search.addEventListener('input',()=>{
            clearTimeout(timer);
            historyUIState.query=search.value;
            timer=setTimeout(()=>renderHistory(),120);
        });
    }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',historyBindUI);
else historyBindUI();

window.renderHistory=renderHistory;
window.historyUIState=historyUIState;
