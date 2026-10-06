// =====================================
// COPIAR ECONOMÍA PARA FELIOS
// =====================================
function buildFeliosEconomyState(){
    const pocketList=Array.isArray(pockets)?pockets:[];
    const capitalList=Array.isArray(capital)?capital:[];
    return {
        tipo:'economia',version:8,moneda:'COP',fecha:new Date().toISOString().slice(0,10),fuente:'Gestor de Gastos',
        capital:capitalList.map(acc=>({id:acc.id,nombre:acc.name,tipo:acc.type,emoji:acc.icon,saldo:Number(acc.balance||0),color:acc.color,oculto:Boolean(acc.hidden),orden:Number(acc.order||0),divisiones:Array.isArray(acc.subPockets)?acc.subPockets:[]})),
        planificacion:{
            configurado:Boolean(pocketSystem?.initialized),
            sueldoBase:Number(pocketSystem?.baseIncome||0),
            ultimoIngreso:Number(pocketSystem?.lastIncome||0),
            ingresoTotal:Number(pocketSystem?.totalIncome||0),
            distribucion:{...(pocketSystem?.general||{})},
            ahorro:{...(pocketSystem?.saving||{})},
            ingresos:Array.isArray(pocketSystem?.incomes)?pocketSystem.incomes:[],
            bolsillos:pocketList.map(p=>({id:p.id,nombre:p.name,emoji:p.icon,color:p.color,tipo:p.type,porcentaje:Number(p.percent||0),montoFijo:Number(p.fixedAmount||0),modoFijo:p.fixedMode,saldo:Number(p.balance||0),totalRecibido:Number(p.totalReceived||0),ultimoAporte:Number(p.lastContribution||0),aporteAnterior:Number(p.previousContribution||0),oculto:Boolean(p.hidden),orden:Number(p.order||0),vinculo:p.link||null,deseos:Array.isArray(p.desires)?p.desires:[]}))
        },
        deudas:Array.isArray(debts)?debts:[],meDeben:Array.isArray(credits)?credits:[],
        historial:Array.isArray(history)?history.slice(0,250):[],
        analitica:window.analytics||{version:1,snapshots:[]},
        configuracion:window.appSettings||{}
    };
}
function copyTextFallback(text){const textarea=document.createElement('textarea');textarea.value=text;textarea.setAttribute('readonly','');textarea.style.position='fixed';textarea.style.left='-9999px';document.body.appendChild(textarea);textarea.focus();textarea.select();let copied=false;try{copied=document.execCommand('copy');}catch(error){console.error(error);}textarea.remove();return copied;}
document.body.addEventListener('click',async e=>{const button=e.target.closest('#btn-copy-felios');if(!button)return;const text=JSON.stringify(buildFeliosEconomyState(),null,2);try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);showToast('🧠 Economía copiada para FeliOS');return;}if(copyTextFallback(text)){showToast('🧠 Economía copiada para FeliOS');return;}throw new Error('Clipboard no disponible');}catch(error){console.error(error);const modal=document.createElement('div');modal.className='felios-copy-overlay';modal.innerHTML=`<div class="felios-copy-dialog"><div class="felios-copy-header"><strong>🧠 Economía para FeliOS</strong><button type="button" class="felios-copy-close">×</button></div><textarea class="felios-copy-text" readonly></textarea><button type="button" class="felios-copy-select">Seleccionar todo</button></div>`;document.body.appendChild(modal);const textarea=modal.querySelector('.felios-copy-text');textarea.value=text;modal.querySelector('.felios-copy-close').onclick=()=>modal.remove();modal.querySelector('.felios-copy-select').onclick=()=>{textarea.focus();textarea.select();};textarea.focus();textarea.select();}});
