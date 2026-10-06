/* =====================================================
   FELIOS ECONOMY — DATA CORE v7
   Capital y planificación (Bolsillos) son módulos separados.
===================================================== */

let capital = [];
let accounts = capital; // compatibilidad

/* =====================================================
   BOLSILLOS / PLANIFICACIÓN
===================================================== */

let sueldoBase = 0;
let pockets = [];

let pocketSystem = {
    version: 3,
    initialized: false,
    baseIncome: 0,
    lastIncome: 0,
    totalIncome: 0,
    general: {
        pocketsPercent: 70,
        savingPercent: 30
    },
    saving: {
        balance: 0,
        totalReceived: 0,
        lastContribution: 0,
        previousContribution: 0,
        history: []
    },
    incomes: [],
    categories: pockets
};

let debts = [];
let credits = [];
let history = [];
let sueldoGanado = 0;
let lastContribution = {};
let analytics = { version: 1, snapshots: [] };
let appSettings = { version: 1, defaultHistoryRange: 'month', defaultFinancePeriod: 'month' };
window.appSettings = appSettings;

function syncPocketAliases(){
    pocketSystem.categories = pockets;
    sueldoBase = Number(pocketSystem.baseIncome || 0);
    sueldoGanado = Number(pocketSystem.totalIncome || 0);
    window.pocketSystem = pocketSystem;
    window.pockets = pockets;
    window.sueldoBase = sueldoBase;
    window.sueldoGanado = sueldoGanado;
    window.lastContribution = lastContribution;
window.analytics = analytics;
}

function normalizePocketCategory(raw = {}, index = 0){
    const type = raw.type === 'fixed' ? 'fixed' : 'percent';
    const fixedMode = raw.fixedMode === 'manual' ? 'manual' : 'auto';
    return {
        id: raw.id ?? (Date.now() + index + Math.random()),
        name: raw.name || raw.motivo || 'Bolsillo',
        icon: raw.icon || '🐷',
        color: /^#[0-9a-fA-F]{6}$/.test(raw.color || '') ? String(raw.color).toUpperCase() : '#C8A951',
        type,
        percent: type === 'percent' ? Math.max(0, Number(raw.percent ?? ((raw.pct || 0) * 100))) : 0,
        fixedAmount: type === 'fixed' ? Math.max(0, Number(raw.fixedAmount || 0)) : 0,
        fixedMode,
        balance: Math.max(0, Number(raw.balance ?? raw.total ?? 0)),
        totalReceived: Math.max(0, Number(raw.totalReceived ?? raw.total ?? 0)),
        previousContribution: Math.max(0, Number(raw.previousContribution || 0)),
        lastContribution: Math.max(0, Number(raw.lastContribution || 0)),
        hidden: Boolean(raw.hidden),
        order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index,
        link: raw.link && raw.link.capitalId != null && raw.link.subPocketId != null ? {
            capitalId: raw.link.capitalId,
            subPocketId: raw.link.subPocketId,
            linkedAt: raw.link.linkedAt || new Date().toISOString(),
            updatedAt: raw.link.updatedAt || raw.link.linkedAt || new Date().toISOString(),
            status: ['synced','pending','broken'].includes(raw.link.status) ? raw.link.status : 'synced',
            pendingDelta: Number(raw.link.pendingDelta || 0)
        } : null,
        history: Array.isArray(raw.history) ? raw.history : [],
        desires: Array.isArray(raw.desires) ? raw.desires.map((d, di) => ({
            id: d.id ?? (Date.now()+di+Math.random()),
            name: d.name || d.motivo || 'Deseo',
            icon: d.icon || '✨',
            color: /^#[0-9a-fA-F]{6}$/.test(d.color || '') ? String(d.color).toUpperCase() : '#C8A951',
            target: d.target == null ? (Number(d.monto) > 1 ? Number(d.monto) : null) : (Number(d.target) > 0 ? Number(d.target) : null),
            reserved: Math.max(0, Number(d.reserved || 0)),
            spent: Math.max(0, Number(d.spent || 0)),
            url: d.url || '',
            note: String(d.note || '').slice(0,90),
            image: d.image || '',
            status: d.status || 'thinking',
            completionCount: Math.max(0, Number(d.completionCount || 0)),
            lastCompletedAt: d.lastCompletedAt || null,
            order: Number.isFinite(Number(d.order)) ? Number(d.order) : di,
            created: d.created || new Date().toISOString()
        })) : []
    };
}

function normalizePocketSystem(raw){
    if(raw && typeof raw === 'object'){
        pocketSystem = {
            version: 3,
            initialized: Boolean(raw.initialized),
            baseIncome: Math.max(0, Number(raw.baseIncome || 0)),
            lastIncome: Math.max(0, Number(raw.lastIncome || 0)),
            totalIncome: Math.max(0, Number(raw.totalIncome || 0)),
            general: {
                pocketsPercent: Math.min(100, Math.max(0, Number(raw.general?.pocketsPercent ?? 70))),
                savingPercent: Math.min(100, Math.max(0, Number(raw.general?.savingPercent ?? 30)))
            },
            saving: {
                balance: Math.max(0, Number(raw.saving?.balance || 0)),
                totalReceived: Math.max(0, Number(raw.saving?.totalReceived || 0)),
                lastContribution: Math.max(0, Number(raw.saving?.lastContribution || 0)),
                previousContribution: Math.max(0, Number(raw.saving?.previousContribution || 0)),
                history: Array.isArray(raw.saving?.history) ? raw.saving.history : []
            },
            incomes: Array.isArray(raw.incomes) ? raw.incomes : [],
            categories: []
        };
        pockets.length = 0;
        const incomingCategories = Array.isArray(raw.categories) ? raw.categories : [];
        incomingCategories.forEach((p,i)=>pockets.push(normalizePocketCategory(p,i)));
        pocketSystem.categories = pockets;
        if(Math.abs((pocketSystem.general.pocketsPercent + pocketSystem.general.savingPercent) - 100) > .001){
            pocketSystem.general.savingPercent = Math.max(0, 100-pocketSystem.general.pocketsPercent);
        }
        syncPocketAliases();
        return;
    }

    // Migración de versiones antiguas: conservamos datos, pero activamos el nuevo motor.
    if(pockets.length){
        const old = [...pockets];
        pockets.length = 0;
        old.forEach((p,i)=>{
            if(Number(p.id) === 8){
                pocketSystem.saving.balance = Number(p.total || 0);
                pocketSystem.saving.totalReceived = Number(p.total || 0);
                return;
            }
            pockets.push(normalizePocketCategory({
                ...p,
                type: Number(p.id) === 6 ? 'fixed' : 'percent',
                fixedAmount: Number(p.id) === 6 ? 10000 : 0,
                fixedMode: Number(p.id) === 6 ? 'manual' : 'auto'
            },i));
        });
        pocketSystem.initialized = true;
    }
    syncPocketAliases();
}

window.capital = capital;
window.accounts = accounts;
window.debts = debts;
window.credits = credits;
window.history = history;
window.pockets = pockets;
window.pocketSystem = pocketSystem;
window.sueldoBase = sueldoBase;
window.sueldoGanado = sueldoGanado;
window.lastContribution = lastContribution;
window.normalizePocketSystem = normalizePocketSystem;
window.syncPocketAliases = syncPocketAliases;

/* =====================================================
   EXPORTAR JSON
===================================================== */
document.body.addEventListener('click', e => {
    if(!e.target.closest('#btn-export')) return;
    const state = {
        version: 10,
        exportedAt: new Date().toISOString(),
        capital,
        pocketSystem: {
            ...pocketSystem,
            categories: pockets
        },
        // Compatibilidad de lectura con versiones anteriores.
        pockets,
        debts,
        credits,
        history,
        sueldoGanado: pocketSystem.totalIncome,
        lastContribution,
        analytics,
        appSettings
    };
    const blob = new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
a.href = url;
a.download = 'gastos-felios.json';

document.body.appendChild(a);
a.click();
a.remove();

URL.revokeObjectURL(url);

/* Ya existe una copia actualizada del estado */
if(typeof window.markFeliOSSavedState === 'function'){
    window.markFeliOSSavedState();
}

if(typeof showToast === 'function'){
    showToast('JSON exportado · cambios guardados');
}
});

/* =====================================================
   IMPORTAR JSON
===================================================== */
const fileInput = document.getElementById('file-input');
document.body.addEventListener('click',e=>{
    const btn=e.target.closest('#btn-import');if(!btn||!fileInput)return;e.preventDefault();fileInput.click();
});

if(fileInput){
    fileInput.addEventListener('change',e=>{
        const file=e.target.files?.[0];if(!file)return;
        const reader=new FileReader();
        reader.onload=async()=>{
            try{
                const state=JSON.parse(reader.result);
                if(!state || typeof state!=='object' || Array.isArray(state)) throw new Error('Estructura JSON no válida');
                if(typeof feliosConfirm==='function'){const ok=await feliosConfirm({title:'Importar copia de seguridad',message:'El estado actual será reemplazado por el contenido de este JSON.',confirmText:'Importar y reemplazar',danger:true});if(!ok){fileInput.value='';return;}}

                capital.length=0;
                const incomingCapital=Array.isArray(state.capital)?state.capital:(Array.isArray(state.accounts)?state.accounts:[]);
                incomingCapital.forEach((c,i)=>{
                    const subs=Array.isArray(c.subPockets)?c.subPockets.map((p,pi)=>({
                        ...p,id:p.id??Date.now()+pi+Math.random(),name:p.name||'División',icon:p.icon||'◈',amount:Math.max(0,Number(p.amount||0)),order:Number.isFinite(Number(p.order))?Number(p.order):pi
                    })):[];
                    capital.push({
                        ...c,id:c.id??Date.now()+i+Math.random(),name:c.name||'Capital',type:c.type||'otro',icon:c.icon||'💰',color:/^#[0-9a-fA-F]{6}$/.test(c.color||'')?String(c.color).toUpperCase():'#C8A951',balance:Math.max(0,Number(c.balance||0)),hidden:Boolean(c.hidden),order:Number.isFinite(Number(c.order))?Number(c.order):i,subPockets:subs,settings:c.settings||{allowSubPockets:true}
                    });
                });

                if(state.pocketSystem){
                    normalizePocketSystem(state.pocketSystem);
                }else if(Array.isArray(state.pockets)){
                    // importar legado
                    pockets.length=0;
                    state.pockets.forEach((p,i)=>pockets.push(normalizePocketCategory(p,i)));
                    pocketSystem={version:3,initialized:true,baseIncome:Number(state.sueldoBase||811750),lastIncome:Number(state.lastSalaryAdded||0),totalIncome:Number(state.sueldoGanado||0),general:{pocketsPercent:55,savingPercent:45},saving:{balance:0,totalReceived:0,lastContribution:0,previousContribution:0,history:[]},incomes:[],categories:pockets};
                    const oldSaving=state.pockets.find(p=>Number(p.id)===8);
                    if(oldSaving){pocketSystem.saving.balance=Number(oldSaving.total||0);pocketSystem.saving.totalReceived=Number(oldSaving.total||0);}
                    syncPocketAliases();
                }else{
                    pockets.length=0;
                    normalizePocketSystem(null);
                }

                debts.length=0;if(Array.isArray(state.debts))debts.push(...state.debts);
                credits.length=0;if(Array.isArray(state.credits))credits.push(...state.credits);
                history.length=0;if(Array.isArray(state.history))history.push(...state.history);
                lastContribution={...(state.lastContribution||{})};window.lastContribution=lastContribution;
                analytics = state.analytics && typeof state.analytics==='object' ? {version:1,snapshots:Array.isArray(state.analytics.snapshots)?state.analytics.snapshots.filter(x=>x&&typeof x==='object').slice(-800):[]} : {version:1,snapshots:[]};
                window.analytics=analytics;
                const importedSettings=state.appSettings&&typeof state.appSettings==='object'?state.appSettings:{};
                const historyRanges=new Set(['today','7d','month','prev-month','all']);
                const financeRanges=new Set(['today','month','2m','3m','6m','12m','year','2y','3y','all']);
                appSettings={
                    version:1,
                    defaultHistoryRange:historyRanges.has(importedSettings.defaultHistoryRange)?importedSettings.defaultHistoryRange:'month',
                    defaultFinancePeriod:financeRanges.has(importedSettings.defaultFinancePeriod)?importedSettings.defaultFinancePeriod:'month',
                    financeCollapsed:Boolean(importedSettings.financeCollapsed)
                };
                window.appSettings=appSettings;
                if(typeof financeUI!=='undefined'&&appSettings.defaultFinancePeriod)financeUI.preset=appSettings.defaultFinancePeriod;
                if(typeof historyUIState!=='undefined'&&appSettings.defaultHistoryRange)historyUIState.range=appSettings.defaultHistoryRange;
                if(typeof repairPocketCapitalLinks==='function')repairPocketCapitalLinks({silent:true});
if(typeof refreshAll === 'function'){
    refreshAll();
}

/*
   El archivo que acabamos de importar ya constituye
   nuestra última copia guardada.
*/
if(typeof window.markFeliOSSavedState === 'function'){
    window.markFeliOSSavedState();
}

if(typeof showToast === 'function'){
    showToast('JSON importado');
}
            }catch(err){console.error(err);if(typeof showToast==='function')showToast('JSON inválido','var(--danger)');}
            finally{fileInput.value='';}
        };
        reader.readAsText(file);
    });
}
