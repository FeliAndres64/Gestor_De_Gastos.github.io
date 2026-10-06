/* =====================================================
   FELIOS ECONOMY — SINCRONIZACIÓN OPCIONAL v1
   Bolsillo económico ↔ división de Capital (1 ↔ 1)

   El vínculo refleja únicamente el saldo disponible del bolsillo.
   Nunca modifica capital.balance: solo redistribuye el Capital entre
   Disponible y la división vinculada.
===================================================== */

const FELIOS_LINK_EPSILON = 0.005;

function feliosLinkId(){ return `link-${Date.now()}-${Math.floor(Math.random()*100000)}`; }
function feliosLinkEsc(v){ return typeof pocketEscape==='function' ? pocketEscape(v) : String(v ?? ''); }
function feliosLinkMoney(v){ return typeof pocketMoney==='function' ? pocketMoney(v) : (typeof fmt!=='undefined'?fmt.format(Number(v||0)):String(v||0)); }

function getSubPocketByLink(capitalId,subPocketId){
    const acc=typeof getCapitalById==='function' ? getCapitalById(capitalId) : (capital||[]).find(c=>String(c.id)===String(capitalId));
    if(!acc)return null;
    const sub=(acc.subPockets||[]).find(s=>String(s.id)===String(subPocketId))||null;
    return sub?{acc,sub}:null;
}

function getPocketCapitalPair(p){
    if(!p?.link?.capitalId || p?.link?.subPocketId==null)return null;
    const pair=getSubPocketByLink(p.link.capitalId,p.link.subPocketId);
    if(!pair)return null;
    if(pair.sub.linkedPocketId!=null && String(pair.sub.linkedPocketId)!==String(p.id))return null;
    return {...pair,pocket:p};
}

function getPocketForLinkedSubPocket(acc,sub){
    if(!sub?.linkedPocketId)return null;
    const p=typeof pocketById==='function' ? pocketById(sub.linkedPocketId) : (pockets||[]).find(x=>String(x.id)===String(sub.linkedPocketId));
    if(!p?.link)return null;
    if(String(p.link.capitalId)!==String(acc.id)||String(p.link.subPocketId)!==String(sub.id))return null;
    return p;
}

function getLinkDifference(p){
    const pair=getPocketCapitalPair(p);if(!pair)return 0;
    return Number(p.balance||0)-Number(pair.sub.amount||0);
}

function updatePocketLinkState(p){
    if(!p?.link)return null;
    const pair=getPocketCapitalPair(p);
    if(!pair){p.link.status='broken';p.link.pendingDelta=0;return null;}
    const diff=getLinkDifference(p);
    p.link.pendingDelta=Math.abs(diff)<=FELIOS_LINK_EPSILON?0:diff;
    p.link.status=Math.abs(diff)<=FELIOS_LINK_EPSILON?'synced':'pending';
    p.link.updatedAt=new Date().toISOString();
    pair.sub.linkedPocketId=p.id;
    return {...pair,diff};
}

function addPocketLocalSyncHistory(p,type,detail,amount=0){
    p.history=Array.isArray(p.history)?p.history:[];
    p.history.unshift({id:feliosLinkId(),date:new Date().toISOString(),type,detail,amount:Number(amount||0),sync:true});
}

function addLinkHistory(action,p,acc,sub,detail=''){
    if(!Array.isArray(history))return;
    const now=new Date().toISOString();
    history.unshift({
        id:feliosLinkId(),date:now.slice(0,10),createdAt:now,type:'edicion',module:'pockets',section:'bolsillos',
        action,objectType:'pocket',objectId:p?.id??null,objectName:p?.name||'',amount:0,
        link:{capitalId:acc?.id??null,capitalName:acc?.name||'',subPocketId:sub?.id??null,subPocketName:sub?.name||'',pocketId:p?.id??null,pocketName:p?.name||''},
        detail:detail||`🔗 ${p?.name||'Bolsillo'} · ${acc?.name||'Capital'} / ${sub?.name||'División'}`
    });
}

function annotateLatestHistoryWithPocketLink(p,{initiator='pocket',synced=true,pendingDelta=0}={}){
    if(!Array.isArray(history)||!history.length||!p?.link)return;
    const pair=getPocketCapitalPair(p);if(!pair)return;
    const item=history[0];
    item.link={capitalId:pair.acc.id,capitalName:pair.acc.name,subPocketId:pair.sub.id,subPocketName:pair.sub.name,pocketId:p.id,pocketName:p.name,initiator,synced:Boolean(synced),pendingDelta:Number(pendingDelta||0)};
}

function syncLinkedSubPocketFromPocket(p,{notify=false,reason='Movimiento del bolsillo'}={}){
    if(!p?.link)return {linked:false,synced:true,pendingDelta:0};
    const pair=getPocketCapitalPair(p);
    if(!pair){
        p.link.status='broken';p.link.pendingDelta=0;
        if(notify&&typeof showToast==='function')showToast(`El vínculo de ${p.name} ya no existe. Puedes volver a configurarlo.`,'var(--danger)');
        return {linked:true,synced:false,broken:true,pendingDelta:0};
    }
    const target=Math.max(0,Number(p.balance||0));
    const current=Math.max(0,Number(pair.sub.amount||0));
    const diff=target-current;
    if(Math.abs(diff)<=FELIOS_LINK_EPSILON){
        pair.sub.amount=target;updatePocketLinkState(p);return {linked:true,synced:true,pendingDelta:0,...pair};
    }
    if(diff>0){
        const available=typeof getCapitalAvailable==='function'?Math.max(0,Number(getCapitalAvailable(pair.acc)||0)):Math.max(0,Number(pair.acc.balance||0)-(pair.acc.subPockets||[]).reduce((s,x)=>s+Number(x.amount||0),0));
        if(available+FELIOS_LINK_EPSILON<diff){
            p.link.status='pending';p.link.pendingDelta=diff;p.link.updatedAt=new Date().toISOString();
            if(notify&&typeof showToast==='function')showToast(`${p.name}: faltan ${feliosLinkMoney(diff)} por reflejar en ${pair.acc.name}.`,'var(--edit)');
            return {linked:true,synced:false,pendingDelta:diff,available,...pair};
        }
    }
    pair.sub.amount=target;
    updatePocketLinkState(p);
    if(notify&&typeof showToast==='function')showToast(`🔗 ${p.name} sincronizado con ${pair.acc.name}.`);
    return {linked:true,synced:true,pendingDelta:0,...pair};
}

function changePocketBalanceWithLink(p,delta,{notify=false,reason='Movimiento del bolsillo'}={}){
    if(!p)return {ok:false};
    const before=Math.max(0,Number(p.balance||0));
    const after=Math.max(0,before+Number(delta||0));
    p.balance=after;
    const result=syncLinkedSubPocketFromPocket(p,{notify,reason});
    return {ok:true,before,after,delta:after-before,...result};
}

function setPocketBalanceWithLink(p,newBalance,{notify=false,reason='Ajuste de saldo'}={}){
    if(!p)return {ok:false};
    const before=Math.max(0,Number(p.balance||0));
    p.balance=Math.max(0,Number(newBalance||0));
    const result=syncLinkedSubPocketFromPocket(p,{notify,reason});
    return {ok:true,before,after:p.balance,delta:p.balance-before,...result};
}

function syncPocketFromLinkedSubPocket(acc,sub,{reason='Cambio en división vinculada',recordLocal=true}={}){
    const p=getPocketForLinkedSubPocket(acc,sub);if(!p)return {linked:false};
    const before=Math.max(0,Number(p.balance||0)),after=Math.max(0,Number(sub.amount||0)),delta=after-before;
    p.balance=after;p.link.status='synced';p.link.pendingDelta=0;p.link.updatedAt=new Date().toISOString();
    if(recordLocal&&Math.abs(delta)>FELIOS_LINK_EPSILON)addPocketLocalSyncHistory(p,delta>=0?'suma':'resta',`${reason}: ${feliosLinkMoney(before)} → ${feliosLinkMoney(after)}`,Math.abs(delta));
    return {linked:true,p,before,after,delta};
}

function unlinkPocketCapital(p,{record=true,reason='Vínculo eliminado'}={}){
    if(!p?.link)return false;
    const pair=getSubPocketByLink(p.link.capitalId,p.link.subPocketId);
    const old={...p.link};
    if(pair&&String(pair.sub.linkedPocketId)===String(p.id))delete pair.sub.linkedPocketId;
    p.link=null;
    if(record&&pair)addLinkHistory('unlink',p,pair.acc,pair.sub,`🔓 ${p.name} desvinculado de ${pair.acc.name} · ${pair.sub.name}`);
    return old;
}

function detachLinksForCapital(acc,{record=true}={}){
    if(!acc)return;
    (acc.subPockets||[]).forEach(sub=>{
        const p=getPocketForLinkedSubPocket(acc,sub);
        if(p)unlinkPocketCapital(p,{record,reason:'Capital eliminado'});
        delete sub.linkedPocketId;
    });
}

function detachLinkForSubPocket(acc,sub,{record=true}={}){
    const p=getPocketForLinkedSubPocket(acc,sub);if(!p)return null;
    unlinkPocketCapital(p,{record,reason:'División eliminada'});return p;
}

function repairPocketCapitalLinks({silent=true}={}){
    if(!Array.isArray(pockets)||!Array.isArray(capital))return;
    const claimed=new Set();
    pockets.forEach(p=>{
        if(!p?.link)return;
        const pair=getSubPocketByLink(p.link.capitalId,p.link.subPocketId);
        const key=pair?`${pair.acc.id}:${pair.sub.id}`:'';
        if(!pair||claimed.has(key)){
            p.link=null;return;
        }
        claimed.add(key);pair.sub.linkedPocketId=p.id;updatePocketLinkState(p);
    });
    capital.forEach(acc=>(acc.subPockets||[]).forEach(sub=>{
        if(!sub.linkedPocketId)return;
        const p=(pockets||[]).find(x=>String(x.id)===String(sub.linkedPocketId));
        if(!p?.link||String(p.link.capitalId)!==String(acc.id)||String(p.link.subPocketId)!==String(sub.id))delete sub.linkedPocketId;
    }));
    if(!silent){
        const pending=pockets.filter(p=>p?.link?.status==='pending').length;
        if(pending&&typeof showToast==='function')showToast(`${pending} vínculo${pending===1?'':'s'} pendiente${pending===1?'':'s'} de sincronizar.`,'var(--edit)');
    }
}

function renderPocketLinkBadge(p){
    if(!p?.link)return '';
    const pair=getPocketCapitalPair(p);
    if(!pair)return `<button type="button" class="pocket-link-badge broken" data-link-pocket="${p.id}" title="Reparar vínculo">⚠️ Vínculo no disponible</button>`;
    const diff=Number(p.balance||0)-Number(pair.sub.amount||0);
    const pending=Math.abs(diff)>FELIOS_LINK_EPSILON;
    return `<button type="button" class="pocket-link-badge ${pending?'pending':''}" data-link-pocket="${p.id}" title="Gestionar vínculo"><span>🔗</span><span>${feliosLinkEsc(pair.acc.name)} · ${feliosLinkEsc(pair.sub.name)}</span>${pending?`<b>+${feliosLinkMoney(Math.max(0,diff))} pendiente</b>`:''}</button>`;
}

function renderSubPocketLinkBadge(acc,sub){
    const p=getPocketForLinkedSubPocket(acc,sub);if(!p)return '';
    const diff=Number(p.balance||0)-Number(sub.amount||0);
    return `<span class="subpocket-link-badge ${Math.abs(diff)>FELIOS_LINK_EPSILON?'pending':''}" title="Vinculado con Bolsillos">🔗 ${feliosLinkEsc(p.icon||'🐷')} ${feliosLinkEsc(p.name)}${Math.abs(diff)>FELIOS_LINK_EPSILON?' · pendiente':''}</span>`;
}

function getLinkableSubPockets(acc,pocket){
    return (acc?.subPockets||[]).filter(sub=>!sub.linkedPocketId||String(sub.linkedPocketId)===String(pocket.id));
}

function openPocketCapitalLinkModal(p){
    if(!p||typeof openPocketModal!=='function')return;
    const current=getPocketCapitalPair(p);
    const capOptions=(capital||[]).map(acc=>`<option value="${acc.id}" ${current&&String(current.acc.id)===String(acc.id)?'selected':''}>${feliosLinkEsc(acc.icon||'💰')} ${feliosLinkEsc(acc.name)}</option>`).join('');
    if(!capOptions){
        openPocketModal({title:'Vincular con Capital',kicker:'SINCRONIZACIÓN OPCIONAL',body:`<div class="link-empty"><span>🏦</span><strong>Primero crea un Capital</strong><p>Necesitas al menos un bloque de Capital para vincular este bolsillo.</p></div><div class="pocket-modal-actions"><button class="pocket-cancel">Cerrar</button></div>`,onReady:o=>o.querySelector('.pocket-cancel').onclick=closePocketModal});
        return;
    }
    const body=`
        <div class="link-intro"><span>${feliosLinkEsc(p.icon||'🐷')}</span><div><small>BOLSILLO</small><strong>${feliosLinkEsc(p.name)}</strong><p>Saldo a reflejar: <b>${feliosLinkMoney(p.balance)}</b></p></div></div>
        <div class="field-grid two link-fields"><label>Capital<select id="link-capital">${capOptions}</select></label><label>División<select id="link-sub"></select></label></div>
        <div id="link-new-box" class="link-new-box"><div class="field-grid two"><label>Emoji<input id="link-new-icon" value="${feliosLinkEsc(p.icon||'◈')}" maxlength="8"></label><label>Nombre<input id="link-new-name" value="${feliosLinkEsc(p.name)}" maxlength="40"></label></div></div>
        <div id="link-preview" class="link-preview"></div>
        <p class="modal-help">El vínculo refleja el <b>saldo disponible</b> del bolsillo dentro de una división de Capital. No cambia el total del Capital.</p>
        <div class="pocket-modal-actions link-actions">
            <button class="pocket-cancel">Cancelar</button>
            ${current?'<button class="pocket-soft danger-soft" id="link-unlink">Desvincular</button>':''}
            <button class="pocket-primary" id="link-save">${current?(p.link?.status==='pending'?'Sincronizar ahora':'Guardar vínculo'):'Vincular'}</button>
        </div>`;
    openPocketModal({title:current?'Gestionar vínculo':'Vincular con Capital',kicker:'SINCRONIZACIÓN OPCIONAL',body,wide:true,onReady:o=>{
        const capSel=o.querySelector('#link-capital'),subSel=o.querySelector('#link-sub'),newBox=o.querySelector('#link-new-box'),preview=o.querySelector('#link-preview'),save=o.querySelector('#link-save');
        const getAcc=()=>getCapitalById(capSel.value);
        const getSub=()=>{const acc=getAcc();return acc?.subPockets?.find(s=>String(s.id)===String(subSel.value))||null;};
        const populateSubs=()=>{
            const acc=getAcc(),items=getLinkableSubPockets(acc,p);
            subSel.innerHTML=`<option value="__new__">＋ Crear división “${feliosLinkEsc(p.name)}”</option>`+items.map(s=>`<option value="${s.id}" ${current&&String(current.sub.id)===String(s.id)?'selected':''}>${feliosLinkEsc(s.icon||'◈')} ${feliosLinkEsc(s.name)} · ${feliosLinkMoney(s.amount)}</option>`).join('');
            if(current&&String(current.acc.id)===String(acc?.id)&&items.some(s=>String(s.id)===String(current.sub.id)))subSel.value=String(current.sub.id);
            else if(!current){const sameName=items.find(s=>String(s.name||'').trim().toLowerCase()===String(p.name||'').trim().toLowerCase());if(sameName)subSel.value=String(sameName.id);}
            update();
        };
        const update=()=>{
            const acc=getAcc(),sub=getSub(),creating=subSel.value==='__new__';newBox.hidden=!creating;
            if(!acc){save.disabled=true;preview.innerHTML='<div class="pocket-feedback error">Selecciona un Capital.</div>';return;}
            const currentAmount=creating?0:Number(sub?.amount||0),available=Math.max(0,Number(getCapitalAvailable(acc)||0));
            const required=Math.max(0,Number(p.balance||0)-currentAmount),capacity=currentAmount+available,valid=Number(p.balance||0)<=capacity+FELIOS_LINK_EPSILON;
            preview.innerHTML=`<div class="link-preview-grid"><div><span>Saldo bolsillo</span><strong>${feliosLinkMoney(p.balance)}</strong></div><div><span>${creating?'Disponible del Capital':'División actual'}</span><strong>${feliosLinkMoney(creating?available:currentAmount)}</strong></div><div><span>Disponible después</span><strong>${feliosLinkMoney(Math.max(0,available-required))}</strong></div></div>${valid?'<div class="pocket-feedback valid">✓ Se puede sincronizar sin modificar el total del Capital.</div>':`<div class="pocket-feedback error">⚠️ Faltan ${feliosLinkMoney(Number(p.balance||0)-capacity)} disponibles en ${feliosLinkEsc(acc.name)} para reflejar este saldo.</div>`}`;
            save.disabled=!valid;
        };
        capSel.onchange=populateSubs;subSel.onchange=update;o.querySelector('#link-new-name').oninput=update;o.querySelector('.pocket-cancel').onclick=closePocketModal;
        const unlink=o.querySelector('#link-unlink');if(unlink)unlink.onclick=async()=>{const ok=await pocketConfirm({title:'Desvincular bolsillo',message:`${p.name} y su división conservarán sus saldos actuales, pero dejarán de sincronizarse.`,confirmText:'Desvincular'});if(!ok)return;unlinkPocketCapital(p,{record:true});closePocketModal();refreshAll();showToast('Vínculo eliminado');};
        save.onclick=async()=>{
            const acc=getAcc();if(!acc)return;let sub=getSub();const creating=subSel.value==='__new__';
            const currentAmount=creating?0:Number(sub?.amount||0),available=Math.max(0,Number(getCapitalAvailable(acc)||0)),need=Math.max(0,Number(p.balance||0)-currentAmount);
            if(need>available+FELIOS_LINK_EPSILON)return showToast('No hay suficiente disponible en ese Capital.','var(--danger)');
            const ok=await pocketConfirm({title:current?'Actualizar vínculo':'Vincular bolsillo',message:`${p.name} se sincronizará con ${acc.name}. El total del Capital no cambiará.`,confirmText:current?'Guardar vínculo':'Vincular'});if(!ok)return;
            if(current)unlinkPocketCapital(p,{record:false});
            if(creating){
                const name=o.querySelector('#link-new-name').value.trim()||p.name,icon=o.querySelector('#link-new-icon').value.trim()||p.icon||'◈';
                sub={id:Date.now()+Math.floor(Math.random()*1000),name,icon,amount:Math.max(0,Number(p.balance||0)),order:(acc.subPockets||[]).length,linkedPocketId:p.id};
                acc.subPockets=Array.isArray(acc.subPockets)?acc.subPockets:[];acc.subPockets.push(sub);
            }else{
                sub.amount=Math.max(0,Number(p.balance||0));sub.linkedPocketId=p.id;
            }
            p.link={capitalId:acc.id,subPocketId:sub.id,linkedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'synced',pendingDelta:0};
            addLinkHistory('link',p,acc,sub,`🔗 ${p.name} vinculado con ${acc.name} · ${sub.name}`);
            closePocketModal();refreshAll();showToast('Vínculo activado');
        };
        populateSubs();
    }});
}

function resolvePocketLink(p){
    if(!p?.link)return openPocketCapitalLinkModal(p);
    const result=syncLinkedSubPocketFromPocket(p,{notify:false,reason:'Sincronización manual'});
    if(result.synced){
        addLinkHistory('link-sync',p,result.acc,result.sub,`🔗 ${p.name} sincronizado manualmente con ${result.acc.name} · ${result.sub.name}`);
        refreshAll();showToast('Sincronización completada');
    }else if(result.broken)openPocketCapitalLinkModal(p);
    else openPocketCapitalLinkModal(p);
}

function notifyPendingPocketLinks(){
    const pending=(pockets||[]).filter(p=>p?.link?.status==='pending');
    if(!pending.length)return;
    const total=pending.reduce((s,p)=>s+Math.max(0,Number(p.link.pendingDelta||0)),0);
    if(typeof showToast==='function')showToast(`🔗 ${pending.length} vínculo${pending.length===1?'':'s'} pendiente${pending.length===1?'':'s'} · ${feliosLinkMoney(total)}`,'var(--edit)');
}

// Abrir/gestionar el vínculo desde las etiquetas de las tarjetas.
document.body.addEventListener('click',e=>{
    const badge=e.target.closest('.pocket-link-badge');if(!badge)return;
    const p=pocketById(badge.dataset.linkPocket);if(p)openPocketCapitalLinkModal(p);
});

window.getPocketCapitalPair=getPocketCapitalPair;
window.getPocketForLinkedSubPocket=getPocketForLinkedSubPocket;
window.syncLinkedSubPocketFromPocket=syncLinkedSubPocketFromPocket;
window.changePocketBalanceWithLink=changePocketBalanceWithLink;
window.setPocketBalanceWithLink=setPocketBalanceWithLink;
window.syncPocketFromLinkedSubPocket=syncPocketFromLinkedSubPocket;
window.unlinkPocketCapital=unlinkPocketCapital;
window.detachLinksForCapital=detachLinksForCapital;
window.detachLinkForSubPocket=detachLinkForSubPocket;
window.repairPocketCapitalLinks=repairPocketCapitalLinks;
window.renderPocketLinkBadge=renderPocketLinkBadge;
window.renderSubPocketLinkBadge=renderSubPocketLinkBadge;
window.openPocketCapitalLinkModal=openPocketCapitalLinkModal;
window.resolvePocketLink=resolvePocketLink;
window.notifyPendingPocketLinks=notifyPendingPocketLinks;
window.annotateLatestHistoryWithPocketLink=annotateLatestHistoryWithPocketLink;

