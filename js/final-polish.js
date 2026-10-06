/* =====================================================
   FELIOS ECONOMY — ACABADO FINAL v1
   Búsqueda global · acciones rápidas · configuración
   navegación sticky · experiencia móvil · consistencia UI
===================================================== */

(function(){
'use strict';

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/* =====================================================
   PROTECCIÓN DE CAMBIOS SIN GUARDAR
===================================================== */

let feliosSavedSignature = null;
let feliosExitWarningPending = false;

function getFeliOSDataSignature(){
    const ps = window.pocketSystem || {};

    const state = {
        capital: window.capital || [],

        pocketSystem: {
            initialized: Boolean(ps.initialized),
            baseIncome: Number(ps.baseIncome || 0),
            lastIncome: Number(ps.lastIncome || 0),
            totalIncome: Number(ps.totalIncome || 0),

            general: ps.general || {},

            saving: ps.saving || {},

            incomes: ps.incomes || [],

            categories: window.pockets || []
        },

        debts: window.debts || [],
        credits: window.credits || [],
        history: window.history || [],
        lastContribution: window.lastContribution || {}
    };

    return JSON.stringify(state);
}

function feliosHasInformation(){
    const ps = window.pocketSystem || {};

    return (
        (window.capital?.length || 0) > 0 ||
        (window.pockets?.length || 0) > 0 ||
        (window.debts?.length || 0) > 0 ||
        (window.credits?.length || 0) > 0 ||
        (window.history?.length || 0) > 0 ||
        (ps.incomes?.length || 0) > 0 ||
        Number(ps.saving?.balance || 0) > 0 ||
        Number(ps.baseIncome || 0) > 0 ||
        Boolean(ps.initialized)
    );
}

function feliosHasUnsavedChanges(){
    if(feliosSavedSignature === null) return false;

    return (
        feliosHasInformation() &&
        getFeliOSDataSignature() !== feliosSavedSignature
    );
}

function markFeliOSSavedState(){
    feliosSavedSignature = getFeliOSDataSignature();
}

/* Lo hacemos accesible desde data.js */
window.markFeliOSSavedState = markFeliOSSavedState;

window.addEventListener('beforeunload', event => {
    if(!feliosHasUnsavedChanges()) return;

    feliosExitWarningPending = true;

    /*
       Si el usuario pulsa "Cancelar" en el aviso del navegador,
       vuelve a FeliOS y mostramos además nuestro aviso visual.
    */
    setTimeout(() => {
        if(
            feliosExitWarningPending &&
            document.visibilityState === 'visible'
        ){
            feliosExitWarningPending = false;

            if(typeof showToast === 'function'){
                showToast(
                    '⚠️ Tienes cambios sin guardar. Exporta tu JSON antes de cerrar FeliOS.',
                    'var(--danger)'
                );
            }
        }
    }, 250);

    event.preventDefault();

    /*
       Necesario para Chrome, Edge, Firefox, etc.
       El navegador decide el texto del aviso.
    */
    event.returnValue = '';

    return '';
});

window.addEventListener('pagehide', () => {
    feliosExitWarningPending = false;
});
function ensureSettings(){
    if(!window.appSettings||typeof window.appSettings!=='object')window.appSettings={};
    window.appSettings={version:1,defaultHistoryRange:'month',defaultFinancePeriod:'month',financeCollapsed:false,...window.appSettings};
    try{appSettings=window.appSettings;}catch{}
    return window.appSettings;
}

function closeFinalOverlay(){
    qa('.felios-final-overlay').forEach(el=>{el.classList.remove('show');setTimeout(()=>el.remove(),150);});
    document.body.classList.remove('felios-final-modal-open');
}
function openFinalOverlay({title,kicker='FELIOS',body='',wide=false,search=false,onReady}={}){
    closeFinalOverlay();
    const overlay=document.createElement('div');
    overlay.className='felios-final-overlay';
    overlay.innerHTML=`<div class="felios-final-card ${wide?'wide':''} ${search?'search-card':''}" role="dialog" aria-modal="true"><header><div><small>${esc(kicker)}</small><h4>${esc(title)}</h4></div><button class="felios-final-close" type="button" aria-label="Cerrar">×</button></header><div class="felios-final-body">${body}</div></div>`;
    document.body.append(overlay);document.body.classList.add('felios-final-modal-open');
    requestAnimationFrame(()=>overlay.classList.add('show'));
    const close=()=>closeFinalOverlay();
    q('.felios-final-close',overlay).onclick=close;
    overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close();});
    if(onReady)onReady(overlay,close);
    return overlay;
}

function scrollToElement(el){
    if(!el)return;
    el.scrollIntoView({behavior:'smooth',block:'center'});
    el.classList.remove('felios-focus-pulse');void el.offsetWidth;el.classList.add('felios-focus-pulse');
    setTimeout(()=>el.classList.remove('felios-focus-pulse'),1800);
}
function openHistory(query=''){
    const modal=q('#modalHistory');if(!modal)return;
    if(query){
        const input=q('#history-search');if(input){input.value=query;historyUIState.query=query;if(typeof renderHistory==='function')renderHistory();}
    }
    if(window.bootstrap?.Modal)bootstrap.Modal.getOrCreateInstance(modal).show();
}

function buildSearchIndex(){
    const items=[];
    (window.capital||[]).forEach(c=>{
        items.push({kind:'capital',icon:c.icon||'💰',title:c.name,subtitle:`Capital · ${typeof fmt!=='undefined'?fmt.format(c.balance||0):c.balance||0}`,capitalId:c.id,keywords:`capital ${c.name} ${c.type||''}`});
        (c.subPockets||[]).forEach(sp=>items.push({kind:'division',icon:sp.icon||'◈',title:sp.name,subtitle:`División de ${c.name}`,capitalId:c.id,subPocketId:sp.id,keywords:`division sub bolsillo ${sp.name} ${c.name}`}));
    });
    items.push({kind:'saving',icon:'💰',title:'Ahorro',subtitle:`Bolsillos · ${typeof fmt!=='undefined'?fmt.format(window.pocketSystem?.saving?.balance||0):''}`,keywords:'ahorro bolsillos reserva'});
    (window.pockets||[]).forEach(p=>{
        items.push({kind:'pocket',icon:p.icon||'🐷',title:p.name,subtitle:`Bolsillo económico · ${p.type==='fixed'?'Fijo':`${Number(p.percent||0)}%`}`,pocketId:p.id,keywords:`bolsillo ${p.name} ${p.type}`});
        (p.desires||[]).forEach(d=>items.push({kind:'desire',icon:d.icon||'✨',title:d.name,subtitle:`Deseo · ${p.name}`,pocketId:p.id,desireId:d.id,keywords:`deseo meta ${d.name} ${p.name} ${d.note||''}`}));
    });
    [['debt',window.debts||[]],['credit',window.credits||[]]].forEach(([type,list])=>list.forEach(g=>{
        items.push({kind:'debt-person',icon:g.icon||'👤',title:g.person||'Persona',subtitle:type==='debt'?'Deudas que debo':'Me deben',debtType:type,groupId:g.id,keywords:`deuda cobro persona ${g.person||''}`});
        (g.entries||[]).forEach(e=>items.push({kind:'debt-entry',icon:e.icon||g.icon||'🤝',title:e.reason||e.name||'Movimiento',subtitle:`${g.person||''} · ${type==='debt'?'Debo':'Me deben'}`,debtType:type,groupId:g.id,entryId:e.id,keywords:`deuda cobro ${g.person||''} ${e.reason||''} ${e.note||''}`}));
    }));
    (window.history||[]).slice(0,250).forEach((h,i)=>items.push({kind:'history',icon:'◷',title:h.detail||'Movimiento',subtitle:`Historial · ${financeDateOnly?.(h.date||h.createdAt)||String(h.date||'')}`,historyQuery:h.objectName||h.person||h.detail||'',keywords:`historial ${h.detail||''} ${h.objectName||''} ${h.person||''} ${h.source||''} ${h.destination||''}`,order:i}));
    return items;
}
function searchResults(query){
    const needle=norm(query.trim());const all=buildSearchIndex();
    if(!needle)return all.filter(x=>x.kind!=='history').slice(0,12);
    return all.map(x=>{const hay=norm(`${x.title} ${x.subtitle} ${x.keywords}`);let score=hay.includes(needle)?10:0;if(norm(x.title).startsWith(needle))score+=8;if(norm(x.title)===needle)score+=10;return {...x,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,30);
}
function openSearchResult(item){
    closeFinalOverlay();
    if(item.kind==='capital'){setTimeout(()=>scrollToElement(q(`.account-card[data-id="${CSS.escape(String(item.capitalId))}"]`)),80);return;}
    if(item.kind==='division'){
        const c=(window.capital||[]).find(x=>String(x.id)===String(item.capitalId));if(c&&typeof openSubPocketInterface==='function')openSubPocketInterface(c);return;
    }
    if(item.kind==='saving'){setTimeout(()=>scrollToElement(q('.saving-pocket-card')),80);return;}
    if(item.kind==='pocket'||item.kind==='desire'){
        const p=(window.pockets||[]).find(x=>String(x.id)===String(item.pocketId));if(p&&typeof openPocketDetail==='function')openPocketDetail(p);return;
    }
    if(item.kind==='debt-person'||item.kind==='debt-entry'){
        if(typeof debtAccordionState!=='undefined'){debtAccordionState[item.debtType]=item.groupId;if(typeof renderList==='function')renderList(item.debtType);}
        setTimeout(()=>scrollToElement(item.debtType==='debt'?q('.debt-panel-debt'):q('.debt-panel-credit')),80);return;
    }
    if(item.kind==='history'){openHistory(item.historyQuery);}
}
function openGlobalSearch(){
    const body=`<div class="global-search-box"><i class="bi bi-search"></i><input id="global-search-input" type="search" placeholder="Capital, bolsillo, deseo, persona, deuda, movimiento..." autocomplete="off"><kbd>Esc</kbd></div><div class="global-search-hint">Busca en toda tu economía. Los resultados se abren directamente en su sección.</div><div id="global-search-results" class="global-search-results"></div>`;
    openFinalOverlay({title:'Buscar en FeliOS',kicker:'BÚSQUEDA GLOBAL',body,wide:true,search:true,onReady:(o)=>{
        const input=q('#global-search-input',o),list=q('#global-search-results',o);
        const render=()=>{const rows=searchResults(input.value);list.innerHTML=rows.length?rows.map((r,i)=>`<button type="button" class="global-search-result" data-i="${i}"><span class="global-search-icon">${esc(r.icon)}</span><span><strong>${esc(r.title)}</strong><small>${esc(r.subtitle)}</small></span><i class="bi bi-arrow-right-short"></i></button>`).join(''):`<div class="global-search-empty">No encontré coincidencias.</div>`;qa('.global-search-result',list).forEach(btn=>btn.onclick=()=>openSearchResult(rows[Number(btn.dataset.i)]));};
        input.oninput=render;render();setTimeout(()=>input.focus(),50);
        o.addEventListener('keydown',e=>{if(e.key==='Escape')closeFinalOverlay();});
    }});
}

function quickActionItems(){return [
    {icon:'💵',title:'Registrar ingreso',sub:'Distribuir un ingreso nuevo',run:()=>typeof openIncomeModal==='function'&&openIncomeModal()},
    {icon:'↔',title:'Transferir dinero',sub:'Capital → Ahorro o Bolsillo',run:()=>typeof openPocketTransferModal==='function'&&openPocketTransferModal()},
    {icon:'💳',title:'Nuevo capital',sub:'Crear una cuenta o ubicación de dinero',run:()=>typeof openCapitalMetaEditor==='function'&&openCapitalMetaEditor()},
    {icon:'🐷',title:'Nuevo bolsillo',sub:'Crear una categoría económica',run:()=>{if(!window.pocketSystem?.initialized&&typeof openPocketSetup==='function')openPocketSetup();else if(typeof openPocketEditor==='function')openPocketEditor();}},
    {icon:'↓',title:'Nueva deuda',sub:'Registrar algo que debes',run:()=>typeof openDebtEditor==='function'&&openDebtEditor('debt')},
    {icon:'↑',title:'Nuevo cobro',sub:'Registrar algo que te deben',run:()=>typeof openDebtEditor==='function'&&openDebtEditor('credit')},
    {icon:'◷',title:'Historial',sub:'Consultar movimientos',run:()=>openHistory()},
    {icon:'📈',title:'Progreso económico',sub:'Ir al análisis financiero',run:()=>setTimeout(()=>scrollToElement(q('#financial-dashboard')),50)}
];}
function openQuickActions(){
    const items=quickActionItems();
    openFinalOverlay({title:'Acciones rápidas',kicker:'NUEVO MOVIMIENTO',body:`<div class="quick-action-grid">${items.map((x,i)=>`<button type="button" data-i="${i}"><span>${x.icon}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.sub)}</small></div></button>`).join('')}</div>`,wide:true,onReady:o=>qa('.quick-action-grid button',o).forEach(b=>b.onclick=()=>{const item=items[Number(b.dataset.i)];closeFinalOverlay();setTimeout(item.run,80);} )});
}

function openSettings(){
    const st=ensureSettings();
    const body=`<div class="settings-grid"><section><small>PLANIFICACIÓN</small><button type="button" id="settings-base"><span>💵</span><div><strong>Ingreso base</strong><small>${typeof fmt!=='undefined'?fmt.format(window.pocketSystem?.baseIncome||0):window.pocketSystem?.baseIncome||0} como referencia</small></div><i class="bi bi-chevron-right"></i></button><button type="button" id="settings-distribution"><span>◒</span><div><strong>Distribución</strong><small>${Number(window.pocketSystem?.general?.savingPercent||0)}% Ahorro · ${Number(window.pocketSystem?.general?.pocketsPercent||0)}% Bolsillos</small></div><i class="bi bi-chevron-right"></i></button></section><section><small>PREFERENCIAS</small><label class="settings-select"><span>Historial al abrir</span><select id="settings-history"><option value="today">Hoy</option><option value="7d">7 días</option><option value="month">Este mes</option><option value="prev-month">Mes anterior</option><option value="all">Todo</option></select></label><label class="settings-select"><span>Gráficos al abrir</span><select id="settings-finance"><option value="today">Hoy</option><option value="month">Este mes</option><option value="2m">2 meses</option><option value="3m">3 meses</option><option value="6m">6 meses</option><option value="12m">12 meses</option><option value="year">Este año</option><option value="2y">2 años</option><option value="3y">3 años</option><option value="all">Todo</option></select></label><button type="button" id="settings-theme"><span>🎨</span><div><strong>Tema y apariencia</strong><small>Cambia colores y modo visual</small></div><i class="bi bi-chevron-right"></i></button></section><section><small>DATOS</small><div class="settings-data-actions"><button id="settings-export" type="button"><i class="bi bi-cloud-arrow-up"></i> Exportar JSON</button><button id="settings-import" type="button"><i class="bi bi-cloud-arrow-down"></i> Importar JSON</button></div><p class="settings-note">FeliOS conserva vínculos, historial, gráficos y preferencias dentro de tu copia JSON.</p></section></div><div class="felios-final-actions"><button class="secondary" id="settings-cancel">Cancelar</button><button class="primary" id="settings-save">Guardar configuración</button></div>`;
    openFinalOverlay({title:'Configuración',kicker:'FELIOS PERSONAL',body,wide:true,onReady:(o)=>{
        q('#settings-history',o).value=st.defaultHistoryRange||'month';q('#settings-finance',o).value=st.defaultFinancePeriod||'month';
        q('#settings-cancel',o).onclick=closeFinalOverlay;
        q('#settings-base',o).onclick=()=>{closeFinalOverlay();setTimeout(()=>openBaseIncomeEditor?.(),70)};
        q('#settings-distribution',o).onclick=()=>{closeFinalOverlay();setTimeout(()=>openDistributionEditor?.(),70)};
        q('#settings-theme',o).onclick=()=>{closeFinalOverlay();setTimeout(()=>q('#themes-button')?.click(),70)};
        q('#settings-export',o).onclick=()=>{closeFinalOverlay();setTimeout(()=>q('#btn-export')?.click(),70)};q('#settings-import',o).onclick=()=>{closeFinalOverlay();setTimeout(()=>q('#btn-import')?.click(),70)};
        q('#settings-save',o).onclick=()=>{st.defaultHistoryRange=q('#settings-history',o).value;st.defaultFinancePeriod=q('#settings-finance',o).value;window.appSettings=st;try{appSettings=st;}catch{};if(typeof historyUIState!=='undefined'){historyUIState.range=st.defaultHistoryRange;historyUIState.from='';historyUIState.to='';renderHistory?.();}if(typeof financeUI!=='undefined'){financeUI.preset=st.defaultFinancePeriod;renderFinancialDashboard?.();}closeFinalOverlay();showToast?.('Configuración guardada');};
    }});
}

function openMobileMore(){
    const items=[
        {icon:'🎨',title:'Temas',run:()=>q('#themes-button')?.click()},
        {icon:'🌙',title:'Cambiar modo',run:()=>q('#mode-toggle')?.click()},
        {icon:'🧠',title:'Copiar para FeliOS',run:()=>q('#btn-copy-felios')?.click()},
        {icon:'↑',title:'Exportar JSON',run:()=>q('#btn-export')?.click()},
        {icon:'↓',title:'Importar JSON',run:()=>q('#btn-import')?.click()},
        {icon:'⚙️',title:'Configuración',run:()=>openSettings()}
    ];
    openFinalOverlay({title:'Más opciones',kicker:'FELIOS',body:`<div class="mobile-more-list">${items.map((x,i)=>`<button data-i="${i}" type="button"><span>${x.icon}</span><strong>${esc(x.title)}</strong><i class="bi bi-chevron-right"></i></button>`).join('')}</div>`,onReady:o=>qa('.mobile-more-list button',o).forEach(b=>b.onclick=()=>{const x=items[Number(b.dataset.i)];closeFinalOverlay();setTimeout(x.run,80);})});
}

function setupFinanceCollapse(){
    const root=q('#financial-dashboard'),head=q('.finance-dashboard-head',root);if(!root||!head||q('#finance-collapse',head))return;
    const btn=document.createElement('button');btn.id='finance-collapse';btn.className='finance-collapse';btn.type='button';
    const apply=()=>{const collapsed=!!ensureSettings().financeCollapsed;root.classList.toggle('finance-collapsed',collapsed);btn.innerHTML=collapsed?'<i class="bi bi-chevron-down"></i> Mostrar análisis':'<i class="bi bi-chevron-up"></i> Ocultar análisis';};
    head.appendChild(btn);btn.onclick=()=>{const st=ensureSettings();st.financeCollapsed=!st.financeCollapsed;apply();};apply();
}

function applyDefaults(){
    const st=ensureSettings();
    if(typeof historyUIState!=='undefined'&&st.defaultHistoryRange)historyUIState.range=st.defaultHistoryRange;
    if(typeof financeUI!=='undefined'&&st.defaultFinancePeriod)financeUI.preset=st.defaultFinancePeriod;
}

function bindNavigation(){
    q('#felios-home-link')?.addEventListener('click',e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});});
    q('#btn-quick-actions')?.addEventListener('click',openQuickActions);
    q('#btn-settings')?.addEventListener('click',openSettings);
    q('#btn-nav-history')?.addEventListener('click',()=>openHistory());
    q('#btn-mobile-menu')?.addEventListener('click',openMobileMore);
document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&q('.felios-final-overlay')){
        closeFinalOverlay();
    }
});
}

function polishHistoryButton(){
    const b=q('.btn-history');if(!b)return;b.innerHTML='<i class="bi bi-clock-history"></i><span>Ver historial</span><small>Buscar, filtrar y revisar movimientos</small>';
}

function initFinalPolish(){
    applyDefaults();
    bindNavigation();
    setupFinanceCollapse();
    polishHistoryButton();

    if(typeof renderFinancialDashboard === 'function'){
        renderFinancialDashboard();
    }

    if(typeof renderHistory === 'function'){
        renderHistory();
    }

    setTimeout(() => {
        markFeliOSSavedState();
    }, 0);
}

document.addEventListener('DOMContentLoaded',initFinalPolish);
window.openGlobalSearch=openGlobalSearch;
window.openQuickActions=openQuickActions;
window.openFeliOSSettings=openSettings;
})();
