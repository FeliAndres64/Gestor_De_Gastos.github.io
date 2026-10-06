/* =====================================================
   FELIOS ECONOMY — DEUDAS v2

   Gestiona:
   - Deudas que debo
   - Dinero que me deben
   - Agrupación por persona / entidad
   - Pagos parciales
   - Fecha real editable
   - Vencimiento opcional
   - Capital / Ahorro como origen o destino

   Mantiene compatibilidad con datos antiguos.
===================================================== */

const DEBT_NOTE_MAX = 50;
const debtAccordionState = { debt:null, credit:null };

/* =====================================================
   HELPERS
===================================================== */

function escapeDebtHtml(value){
    return String(value ?? '')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#039;');
}

function debtToday(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
}

function debtId(){
    return Date.now() + Math.floor(Math.random()*100000);
}

function debtDateLabel(value){
    if(!value) return '';
    const d = new Date(`${value}T12:00:00`);
    if(Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}).replace('.','');
}

function debtDateTimeLabel(value){
    if(!value) return '';
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'});
}

function debtMoney(value){
    return fmt.format(Number(value || 0));
}

function debtAvailableCapital(acc){
    if(!acc) return 0;
    if(typeof getCapitalAvailable === 'function') return Math.max(0,Number(getCapitalAvailable(acc)||0));
    const separated = Array.isArray(acc.subPockets)
        ? acc.subPockets.reduce((s,p)=>s+Math.max(0,Number(p.amount||0)),0)
        : 0;
    return Math.max(0,Number(acc.balance||0)-separated);
}

function debtSavingBalance(){
    return Math.max(0,Number(window.pocketSystem?.saving?.balance || 0));
}

function pushDebtHistory({date=debtToday(),type='edicion',detail='',action='',direction='',person='',reason='',amount=0,objectId=null,source='',destination=''}={}){
    if(!Array.isArray(history)) return null;
    const event={
        id:debtId(),
        date,
        createdAt:new Date().toISOString(),
        type,
        module:'debts',
        section:'deudas',
        action,
        direction,
        person,
        reason,
        amount:Number(amount||0),
        objectId,
        source,
        destination,
        detail
    };
    history.unshift(event);
    return event;
}

function debtHistoryEventById(id){
    if(!id || !Array.isArray(history)) return null;
    return history.find(h=>String(h.id)===String(id)) || null;
}

function debtDueState(dueAt,remaining){
    if(!dueAt || !(Number(remaining)>0)) return null;
    const today = new Date(`${debtToday()}T12:00:00`);
    const due = new Date(`${dueAt}T12:00:00`);
    if(Number.isNaN(due.getTime())) return null;
    const days = Math.ceil((due-today)/86400000);
    if(days < 0) return {kind:'overdue',label:`Vencida · ${debtDateLabel(dueAt)}`};
    if(days === 0) return {kind:'soon',label:'Vence hoy'};
    if(days <= 7) return {kind:'soon',label:`Vence en ${days} día${days===1?'':'s'}`};
    return {kind:'normal',label:`Vence ${debtDateLabel(dueAt)}`};
}

/* =====================================================
   NORMALIZACIÓN / MIGRACIÓN
===================================================== */

function normalizeDebtEntry(raw={},index=0){
    const legacyAmount = Math.max(0,Number(raw.amount ?? raw.remaining ?? 0));
    let originalAmount = Math.max(0,Number(raw.originalAmount ?? raw.original ?? 0));
    let paid = Math.max(0,Number(raw.paid ?? raw.paidAmount ?? 0));
    let remaining;

    if(raw.remaining != null){
        remaining = Math.max(0,Number(raw.remaining||0));
        if(!(originalAmount>0)) originalAmount = remaining + paid;
    }else if(originalAmount>0 || paid>0){
        if(!(originalAmount>0)) originalAmount = legacyAmount + paid;
        remaining = Math.max(0,originalAmount-paid);
    }else{
        originalAmount = legacyAmount;
        remaining = legacyAmount;
        paid = 0;
    }

    if(paid > originalAmount) paid = originalAmount;
    remaining = Math.max(0,originalAmount-paid);

    return {
        id:raw.id ?? (Date.now()+index+Math.floor(Math.random()*1000)),
        icon:String(raw.icon || '🧾').slice(0,8),
        reason:raw.reason || raw.name || 'Sin motivo',
        note:String(raw.note || '').slice(0,DEBT_NOTE_MAX),
        originalAmount,
        paid,
        remaining,
        // Compatibilidad con versiones antiguas: amount representa saldo pendiente.
        amount:remaining,
        occurredAt:raw.occurredAt || raw.date || debtToday(),
        dueAt:raw.dueAt || '',
        createdAt:raw.createdAt || new Date().toISOString(),
        historyEventId:raw.historyEventId || null,
        payments:Array.isArray(raw.payments) ? raw.payments.map((p,pi)=>({
            id:p.id ?? (Date.now()+pi+Math.floor(Math.random()*1000)),
            amount:Math.max(0,Number(p.amount||0)),
            occurredAt:p.occurredAt || p.date || debtToday(),
            createdAt:p.createdAt || new Date().toISOString(),
            accountType:p.accountType || p.sourceType || p.destinationType || '',
            accountId:p.accountId ?? p.sourceId ?? p.destinationId ?? null,
            accountName:p.accountName || p.source || p.destination || '',
            historyEventId:p.historyEventId || null
        })) : []
    };
}

function recalcDebtGroup(group){
    group.entries = Array.isArray(group.entries) ? group.entries : [];
    group.entries.forEach((entry,i)=> group.entries[i] = normalizeDebtEntry(entry,i));
    group.total = group.entries.reduce((sum,e)=>sum+Math.max(0,Number(e.remaining||0)),0);
    return group.total;
}

function normalizeDebtItem(item={},index=0){
    let entries = Array.isArray(item.entries) ? item.entries : [];
    if(!entries.length && Number(item.total)>0){
        entries = [{
            reason:item.reason || 'Saldo pendiente',
            amount:Number(item.total||0),
            occurredAt:item.occurredAt || item.date || debtToday(),
            createdAt:item.createdAt || new Date().toISOString()
        }];
    }
    const normalizedEntries=entries.map((e,i)=>normalizeDebtEntry(e,i));
    const group = {
        id:item.id ?? (Date.now()+index+Math.floor(Math.random()*1000)),
        person:item.person || item.name || 'Sin nombre',
        icon:String(item.icon || normalizedEntries[0]?.icon || '👤').slice(0,8),
        entries:normalizedEntries,
        createdAt:item.createdAt || new Date().toISOString(),
        total:0
    };
    recalcDebtGroup(group);
    return group;
}

function normalizeDebtCollection(arr){
    if(!Array.isArray(arr)) return;
    const merged=[];
    const byPerson=new Map();

    arr.forEach((raw,index)=>{
        const group=normalizeDebtItem(raw,index);
        const key=group.person.trim().toLocaleLowerCase('es');
        if(byPerson.has(key)){
            const target=byPerson.get(key);
            if((!target.icon || target.icon==='👤') && group.icon) target.icon=group.icon;
            target.entries.push(...group.entries);
            recalcDebtGroup(target);
        }else{
            byPerson.set(key,group);
            merged.push(group);
        }
    });

    arr.splice(0,arr.length,...merged);
}

function debtGroupById(type,id){
    const arr=type==='debt'?debts:credits;
    normalizeDebtCollection(arr);
    return arr.find(g=>String(g.id)===String(id)) || null;
}

function debtEntryById(group,id){
    return group?.entries?.find(e=>String(e.id)===String(id)) || null;
}

function findDebtGroupByPerson(arr,person){
    const key=String(person||'').trim().toLocaleLowerCase('es');
    return arr.find(g=>String(g.person||'').trim().toLocaleLowerCase('es')===key) || null;
}

function removeEmptyDebtGroups(arr){
    // Conservamos las personas aunque ya no tengan movimientos.
    // El usuario decide si quiere mantenerlas o eliminarlas.
    if(!Array.isArray(arr)) return;
    arr.forEach(group=>recalcDebtGroup(group));
}

function deleteDebtGroup(type,group){
    const arr=type==='debt'?debts:credits;
    const index=arr.indexOf(group);
    if(index>=0) arr.splice(index,1);
    if(String(debtAccordionState[type])===String(group?.id)) debtAccordionState[type]=null;
    refreshAll();
}

/* =====================================================
   MODAL BASE
===================================================== */

function closeDebtModal(){
    document.querySelectorAll('.debt-modal-overlay').forEach(el=>{
        el.classList.remove('show');
        setTimeout(()=>el.remove(),160);
    });
    document.body.classList.remove('debt-modal-open');
}

function openDebtModal({title='',kicker='DEUDAS',body='',wide=false,onReady=null}={}){
    closeDebtModal();
    const overlay=document.createElement('div');
    overlay.className='pocket-modal-overlay debt-modal-overlay';
    overlay.innerHTML=`
        <div class="pocket-modal-card debt-modal-card ${wide?'wide':''}" role="dialog" aria-modal="true">
            <div class="pocket-modal-head">
                <div><small>${escapeDebtHtml(kicker)}</small><h3>${title}</h3></div>
                <button type="button" class="pocket-modal-close debt-modal-close" aria-label="Cerrar">×</button>
            </div>
            <div class="pocket-modal-body debt-modal-body">${body}</div>
        </div>`;
    document.body.append(overlay);
    document.body.classList.add('debt-modal-open');
    requestAnimationFrame(()=>overlay.classList.add('show'));
    overlay.querySelector('.debt-modal-close').onclick=closeDebtModal;
    overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)closeDebtModal();});
    if(onReady) onReady(overlay);
    return overlay;
}

/* =====================================================
   RENDER
===================================================== */

function debtSummary(type,arr){
    const entries=arr.reduce((n,g)=>n+(g.entries?.length||0),0);
    const total=arr.reduce((sum,g)=>sum+Number(g.total||0),0);
    const groupWord=arr.length===1?'persona':'personas';
    const entryWord=entries===1?(type==='debt'?'deuda':'cobro'):(type==='debt'?'deudas':'cobros');
    return {entries,total,text:`${arr.length} ${groupWord} · ${entries} ${entryWord}`};
}

function renderList(type){
    const arr=type==='debt'?debts:credits;
    const cont=document.getElementById(type==='debt'?'debts-list':'credits-list');
    if(!cont) return;

    normalizeDebtCollection(arr);
    const summary=debtSummary(type,arr);
    const meta=document.getElementById(type==='debt'?'debts-summary-meta':'credits-summary-meta');
    if(meta) meta.textContent=summary.text;

    cont.innerHTML='';

    if(!arr.length){
        cont.innerHTML=`
            <div class="debt-empty-state ${type}">
                <span>${type==='debt'?'✓':'🤝'}</span>
                <strong>${type==='debt'?'No tienes deudas pendientes':'Nadie te debe dinero ahora'}</strong>
                <small>${type==='debt'?'Cuando registres una obligación aparecerá aquí.':'Puedes registrar préstamos, ventas o dinero pendiente por recibir.'}</small>
            </div>`;
        return;
    }

    arr.forEach(group=>{
        recalcDebtGroup(group);
        const isOpen=String(debtAccordionState[type])===String(group.id);
        const entryCount=group.entries.length;
        const dueSoon=group.entries.filter(e=>{
            const state=debtDueState(e.dueAt,e.remaining);
            return state && (state.kind==='soon'||state.kind==='overdue');
        }).length;

        const card=document.createElement('article');
        card.className=`debt-person-card ${isOpen?'open':''}`;
        card.dataset.id=group.id;
        card.dataset.type=type;
        card.innerHTML=`
            <button type="button" class="debt-person-toggle" aria-expanded="${isOpen?'true':'false'}">
                <div class="debt-person-left">
                    <span class="debt-person-avatar">${escapeDebtHtml(group.icon || (type==='debt'?'🧾':'🤝'))}</span>
                    <div>
                        <strong>${escapeDebtHtml(group.person)}</strong>
                        <small>${entryCount} ${entryCount===1?'concepto':'conceptos'}${dueSoon?` · ${dueSoon} con alerta`:''}</small>
                    </div>
                </div>
                <div class="debt-person-right">
                    <strong>${debtMoney(group.total)}</strong>
                    <span class="debt-chevron">⌄</span>
                </div>
            </button>
            <div class="debt-person-accordion">
                <div class="debt-person-accordion-inner">
                    <div class="debt-person-toolbar">
                        <button type="button" class="debt-edit-person" data-type="${type}" data-id="${group.id}">✏️ Editar persona</button>
                        ${entryCount===0?`<button type="button" class="debt-delete-person" data-type="${type}" data-id="${group.id}">🗑️ Eliminar persona</button>`:''}
                    </div>
                    ${entryCount===0?`<div class="debt-person-empty">✓ Sin movimientos pendientes. Puedes conservar esta persona para usarla más adelante.</div>`:''}
                    <div class="debt-entry-list"></div>
                    <button type="button" class="debt-add-to-person" data-type="${type}" data-id="${group.id}">＋ ${type==='debt'?'Añadir deuda':'Añadir cobro'} a ${escapeDebtHtml(group.person)}</button>
                </div>
            </div>`;

        const list=card.querySelector('.debt-entry-list');
        [...group.entries]
            .sort((a,b)=>String(b.occurredAt||'').localeCompare(String(a.occurredAt||'')))
            .forEach(entry=>list.append(renderDebtEntry(type,group,entry)));

        cont.append(card);
    });
}

function renderDebtEntry(type,group,entry){
    const row=document.createElement('div');
    row.className='debt-entry-row';
    row.dataset.groupId=group.id;
    row.dataset.entryId=entry.id;
    row.dataset.type=type;

    const paid=Math.max(0,Number(entry.paid||0));
    const original=Math.max(0,Number(entry.originalAmount||0));
    const remaining=Math.max(0,Number(entry.remaining||0));
    const pct=original>0?Math.min(100,paid/original*100):0;
    const due=debtDueState(entry.dueAt,remaining);
    const paymentText=paid>0?`${debtMoney(paid)} ${type==='debt'?'pagados':'recibidos'} de ${debtMoney(original)}`:`Original ${debtMoney(original)}`;

    row.innerHTML=`
        <div class="debt-entry-top">
            <div class="debt-entry-main">
                <span class="debt-entry-icon">${escapeDebtHtml(entry.icon||'🧾')}</span>
                <div class="debt-entry-copy">
                    <strong>${escapeDebtHtml(entry.reason)}</strong>
                    <small>${paymentText}</small>
                </div>
            </div>
            <div class="debt-entry-amount">
                <span>Pendiente</span>
                <strong>${debtMoney(remaining)}</strong>
            </div>
        </div>

        ${entry.note?`<div class="debt-entry-note">📝 ${escapeDebtHtml(entry.note)}</div>`:''}

        <div class="debt-entry-meta">
            <span>📅 ${debtDateLabel(entry.occurredAt)}</span>
            ${due?`<span class="debt-due ${due.kind}">${due.kind==='overdue'?'⚠️':due.kind==='soon'?'⏳':'🗓️'} ${escapeDebtHtml(due.label)}</span>`:''}
        </div>

        ${paid>0?`
            <div class="debt-progress" title="${pct.toFixed(0)}% ${type==='debt'?'pagado':'cobrado'}">
                <div style="width:${pct}%"></div>
            </div>`:''}

        <div class="debt-entry-actions">
            <button type="button" class="debt-payment-btn" data-type="${type}" data-group-id="${group.id}" data-entry-id="${entry.id}">
                ${type==='debt'?'Pagar':'Recibí pago'}
            </button>
            <div class="debt-entry-menu-wrap">
                <button type="button" class="debt-entry-menu-btn" aria-label="Más opciones">⋮</button>
                <div class="debt-entry-menu-popover">
                    <button type="button" class="debt-entry-edit">✏️ Editar</button>
                    ${entry.payments?.length?`<button type="button" class="debt-entry-payments">🧾 Ver pagos (${entry.payments.length})</button>`:''}
                    <button type="button" class="debt-entry-delete danger">🗑️ Eliminar</button>
                </div>
            </div>
        </div>`;

    return row;
}

/* =====================================================
   CREAR / EDITAR
===================================================== */

function openDebtEditor(type,{group=null,entry=null}={}){
    const editing=Boolean(group&&entry);
    const addingToExisting=Boolean(group&&!entry);
    const lockedPerson=Boolean(group);
    const existingPerson=group?.person || '';
    const existingIcon=group?.icon || entry?.icon || '👤';
    const title=editing
        ? `Editar ${type==='debt'?'deuda':'cobro'} de ${escapeDebtHtml(group.person)}`
        : (group?`Añadir a ${escapeDebtHtml(group.person)}`:(type==='debt'?'Nueva deuda':'Nuevo por cobrar'));

    const body=`
        <p class="debt-modal-help">La fecha real determina dónde aparecerá este movimiento en tu línea de tiempo. La fecha de registro en FeliOS se conserva automáticamente.</p>
        <div class="debt-form-grid debt-person-grid ${lockedPerson?'debt-person-locked':''}">
            <label>Persona o entidad
                <div class="debt-locked-input-wrap">
                    <input id="debt-person" type="text" maxlength="60" value="${escapeDebtHtml(lockedPerson?existingPerson:'')}" placeholder="Ej. Dalton, Banco, Tienda" ${lockedPerson?'readonly':''}>
                </div>
            </label>
            <label>Emoji
                <div class="debt-locked-input-wrap">
                    <input id="debt-icon" type="text" maxlength="8" value="${escapeDebtHtml(lockedPerson?existingIcon:'👤')}" placeholder="👤" ${lockedPerson?'readonly':''}>
                </div>
            </label>
        </div>
        <label>Concepto
            <input id="debt-reason" type="text" maxlength="80" value="${escapeDebtHtml(entry?.reason||'')}" placeholder="Ej. Gasolina, préstamo, compra">
        </label>
        <div class="debt-form-grid two">
            <label>Monto original
                <input id="debt-amount" type="number" min="1" step="100" inputmode="decimal" value="${editing?Number(entry.originalAmount||0):''}" placeholder="0">
            </label>
            <label>Fecha real
                <input id="debt-occurred" type="date" max="${debtToday()}" value="${entry?.occurredAt||debtToday()}">
            </label>
        </div>
        <label class="debt-due-toggle">
            <input id="debt-has-due" type="checkbox" ${entry?.dueAt?'checked':''}>
            <span>Agregar fecha límite / vencimiento</span>
        </label>
        <label id="debt-due-wrap" class="${entry?.dueAt?'':'is-hidden'}">Vencimiento opcional
            <input id="debt-due" type="date" value="${entry?.dueAt||''}">
        </label>
        <label>Nota corta <span class="debt-char-count"><b id="debt-note-count">${String(entry?.note||'').slice(0,DEBT_NOTE_MAX).length}</b>/${DEBT_NOTE_MAX}</span>
            <input id="debt-note" type="text" maxlength="${DEBT_NOTE_MAX}" value="${escapeDebtHtml(String(entry?.note||'').slice(0,DEBT_NOTE_MAX))}" placeholder="Ej. Pagar cuando llegue el sueldo">
        </label>
        ${editing?`<div class="debt-technical-date">Registrada en FeliOS: ${escapeDebtHtml(debtDateTimeLabel(entry.createdAt))}</div>`:''}
        <div id="debt-editor-feedback" class="pocket-feedback"></div>
        <div class="pocket-modal-actions">
            <button type="button" class="pocket-cancel debt-editor-cancel">Cancelar</button>
            <button type="button" class="pocket-primary" id="debt-editor-save">${editing?'Guardar cambios':'Guardar'}</button>
        </div>`;

    openDebtModal({title,kicker:type==='debt'?'DEUDAS QUE DEBO':'DINERO QUE ME DEBEN',body,onReady:o=>{
        const person=o.querySelector('#debt-person');
        const amount=o.querySelector('#debt-amount');
        const reason=o.querySelector('#debt-reason');
        const occurred=o.querySelector('#debt-occurred');
        const hasDue=o.querySelector('#debt-has-due');
        const dueWrap=o.querySelector('#debt-due-wrap');
        const due=o.querySelector('#debt-due');
        const note=o.querySelector('#debt-note');
        const noteCount=o.querySelector('#debt-note-count');
        const feedback=o.querySelector('#debt-editor-feedback');
        const save=o.querySelector('#debt-editor-save');

        hasDue.onchange=()=>{
            dueWrap.classList.toggle('is-hidden',!hasDue.checked);
            if(!hasDue.checked) due.value='';
            update();
        };
        note.oninput=()=>{noteCount.textContent=note.value.length;update();};

        const update=()=>{
            const paid=Number(entry?.paid||0);
            const value=Number(amount.value||0);
            let message='';
            let valid=Boolean(person.value.trim()&&reason.value.trim()&&occurred.value&&value>0);
            if(editing && value<paid){valid=false;message=`El monto original no puede ser menor que lo ya ${type==='debt'?'pagado':'cobrado'} (${debtMoney(paid)}).`;}
            if(hasDue.checked&&!due.value){valid=false;message='Selecciona una fecha de vencimiento o desactiva esa opción.';}
            if(valid&&hasDue.checked&&due.value<occurred.value){valid=false;message='El vencimiento no puede ser anterior a la fecha real de la deuda.';}
            if(valid&&editing&&Array.isArray(entry.payments)&&entry.payments.length){
                const earliest=[...entry.payments].map(p=>p.occurredAt).filter(Boolean).sort()[0];
                if(earliest&&occurred.value>earliest){valid=false;message=`La fecha de origen no puede quedar después de un pago/cobro ya registrado (${debtDateLabel(earliest)}).`;}
            }
            if(valid&&!message) message=editing?'Estás editando solo este movimiento. La persona permanece sin cambios.':(addingToExisting?'Se añadirá a esta persona sin crear un registro duplicado.':'Puedes editar la fecha real más adelante si lo necesitas.');
            feedback.className=`pocket-feedback ${valid?'valid':'error'}`;
            feedback.textContent=message;
            save.disabled=!valid;
        };
        [person,reason,amount,occurred,due].forEach(el=>{el.addEventListener('input',update);el.addEventListener('change',update);});
        update();

        o.querySelector('.debt-editor-cancel').onclick=closeDebtModal;
        save.onclick=()=>{
            const arr=type==='debt'?debts:credits;

            // IMPORTANTE: no normalizamos la colección aquí.
            // normalizeDebtCollection() reemplaza los objetos del array y dejaría
            // las referencias `group` / `entry` obsoletas. Eso hacía que notas
            // y ediciones parecieran guardarse, pero desaparecieran al refrescar.
            const liveGroup=group
                ? (arr.find(g=>String(g.id)===String(group.id)) || group)
                : null;
            const liveEntry=(editing && liveGroup)
                ? (liveGroup.entries||[]).find(e=>String(e.id)===String(entry.id))
                : entry;

            const personName=lockedPerson?(liveGroup?.person||group?.person||existingPerson):person.value.trim();
            const newOriginal=Math.max(0,Number(amount.value||0));
            const icon=lockedPerson?((liveGroup?.icon||group?.icon||existingIcon)):(o.querySelector('#debt-icon').value.trim()||'👤').slice(0,8);
            const payload={
                icon,
                reason:reason.value.trim(),
                note:note.value.trim().slice(0,DEBT_NOTE_MAX),
                occurredAt:occurred.value,
                dueAt:hasDue.checked?due.value:'',
                originalAmount:newOriginal
            };

            if(editing){
                if(!liveGroup || !liveEntry) return;
                const paid=Math.max(0,Number(liveEntry.paid||0));
                if(newOriginal<paid) return;
                const oldReason=liveEntry.reason;
                Object.assign(liveEntry,payload,{paid,remaining:Math.max(0,newOriginal-paid),amount:Math.max(0,newOriginal-paid)});
                recalcDebtGroup(liveGroup);
                debtAccordionState[type]=liveGroup.id;

                const originEvent=debtHistoryEventById(liveEntry.historyEventId);
                if(originEvent){
                    originEvent.date=payload.occurredAt;
                    originEvent.person=liveGroup.person;
                    originEvent.reason=payload.reason;
                    originEvent.amount=newOriginal;
                    originEvent.detail=`${type==='debt'?'Deuda creada':'Por cobrar creado'}: ${liveGroup.person} · ${payload.reason} · ${debtMoney(newOriginal)}`;
                }
                pushDebtHistory({date:debtToday(),type:'edicion',action:'edit',direction:type,person:liveGroup.person,reason:payload.reason,amount:newOriginal,objectId:liveEntry.id,detail:`${type==='debt'?'Deuda':'Cobro'} actualizado: ${liveGroup.person} · ${oldReason} → ${payload.reason} · ${debtMoney(newOriginal)}${originEvent?' · fecha financiera corregida':''}`});
            }else{
                let target=liveGroup || findDebtGroupByPerson(arr,personName);
                if(!target){target={id:debtId(),person:personName,icon,entries:[],createdAt:new Date().toISOString(),total:0};arr.push(target);}
                if(!target.icon) target.icon=icon;
                payload.icon=target.icon;
                const newEntry=normalizeDebtEntry({id:debtId(),...payload,amount:newOriginal,originalAmount:newOriginal,paid:0,remaining:newOriginal,createdAt:new Date().toISOString(),payments:[]});
                target.entries.push(newEntry);recalcDebtGroup(target);debtAccordionState[type]=target.id;
                const createdEvent=pushDebtHistory({date:payload.occurredAt,type:type==='debt'?'resta':'suma',action:'create',direction:type,person:target.person,reason:payload.reason,amount:newOriginal,objectId:newEntry.id,detail:`${type==='debt'?'Deuda creada':'Por cobrar creado'}: ${target.person} · ${payload.reason} · ${debtMoney(newOriginal)}`});
                newEntry.historyEventId=createdEvent?.id || null;
            }

            closeDebtModal();refreshAll();showToast(editing?'Movimiento actualizado':(type==='debt'?'Deuda creada':'Cobro registrado'));
        };
        setTimeout(()=>{(lockedPerson?reason:person).focus();},80);
    }});
}

function openDebtPersonEditor(type,group){
    if(!group) return;
    const currentName=group.person;
    const currentIcon=group.icon || '👤';
    const body=`
        <p class="debt-modal-help">Aquí editas a la persona o entidad completa. Sus deudas/cobros seguirán agrupados en el mismo lugar.</p>
        <div class="debt-form-grid debt-person-grid">
            <label>Persona o entidad<input id="debt-person-edit-name" type="text" maxlength="60" value="${escapeDebtHtml(currentName)}"></label>
            <label>Emoji<input id="debt-person-edit-icon" type="text" maxlength="8" value="${escapeDebtHtml(currentIcon)}"></label>
        </div>
        <div id="debt-person-edit-feedback" class="pocket-feedback"></div>
        <div class="pocket-modal-actions"><button class="pocket-cancel debt-person-edit-cancel">Cancelar</button><button class="pocket-primary" id="debt-person-edit-save">Guardar persona</button></div>`;
    openDebtModal({title:`Editar ${escapeDebtHtml(currentName)}`,kicker:'PERSONA / ENTIDAD',body,onReady:o=>{
        const name=o.querySelector('#debt-person-edit-name'),icon=o.querySelector('#debt-person-edit-icon'),fb=o.querySelector('#debt-person-edit-feedback'),save=o.querySelector('#debt-person-edit-save');
        const arr=type==='debt'?debts:credits;
        const update=()=>{
            const n=name.value.trim();
            const duplicate=arr.some(g=>g!==group&&String(g.person||'').trim().toLocaleLowerCase('es')===n.toLocaleLowerCase('es'));
            const valid=Boolean(n)&&!duplicate;
            fb.className=`pocket-feedback ${valid?'valid':'error'}`;
            fb.textContent=duplicate?'Ya existe una persona con ese nombre.':(valid?'Se actualizará el grupo completo y sus movimientos.':'Escribe un nombre válido.');
            save.disabled=!valid;
        };
        name.oninput=update;icon.oninput=update;update();
        o.querySelector('.debt-person-edit-cancel').onclick=closeDebtModal;
        save.onclick=()=>{
            const newName=name.value.trim(),newIcon=(icon.value.trim()||'👤').slice(0,8),oldName=group.person;
            group.person=newName;group.icon=newIcon;
            (group.entries||[]).forEach(entry=>entry.icon=newIcon);
            if(Array.isArray(history)) history.forEach(h=>{if(h?.module==='debts'&&h.person===oldName)h.person=newName;});
            pushDebtHistory({date:debtToday(),type:'edicion',action:'person-edit',direction:type,person:newName,reason:'',amount:0,objectId:group.id,detail:`Persona actualizada: ${oldName} → ${newName}`});
            closeDebtModal();refreshAll();showToast('Persona actualizada');
        };
        setTimeout(()=>name.focus(),80);
    }});
}

function removeCompletedDebtEntry(type,groupId,entryId){
    const arr=type==='debt'?debts:credits;
    const liveGroup=arr.find(g=>String(g.id)===String(groupId));
    if(!liveGroup) return null;
    const entries=Array.isArray(liveGroup.entries)?liveGroup.entries:[];
    const index=entries.findIndex(e=>String(e.id)===String(entryId));
    if(index>=0) entries.splice(index,1);
    recalcDebtGroup(liveGroup);
    return liveGroup;
}

function openEmptyDebtPersonChoice(type,groupOrId){
    const id=(groupOrId && typeof groupOrId==='object')?groupOrId.id:groupOrId;
    const group=debtGroupById(type,id);
    if(!group || (group.entries?.length||0)>0) return;
    const label=type==='debt'?'deudas':'cobros';
    const body=`
        <div class="debt-empty-person-choice">
            <span>${escapeDebtHtml(group.icon||'👤')}</span>
            <h4>${escapeDebtHtml(group.person)}</h4>
            <p>Ya no quedan ${label} pendientes para esta persona. Puedes conservarla para añadir movimientos más adelante o eliminarla de la lista.</p>
        </div>
        <div class="pocket-modal-actions debt-empty-person-actions">
            <button type="button" class="pocket-cancel debt-keep-person">Mantener persona</button>
            <button type="button" class="pocket-primary debt-remove-person">Eliminar persona</button>
        </div>`;
    openDebtModal({title:'¿Qué quieres hacer con esta persona?',kicker:'SIN MOVIMIENTOS PENDIENTES',body,onReady:o=>{
        o.querySelector('.debt-keep-person').onclick=()=>{closeDebtModal();debtAccordionState[type]=group.id;refreshAll();};
        o.querySelector('.debt-remove-person').onclick=()=>{closeDebtModal();deleteDebtGroup(type,group);showToast('Persona eliminada');};
    }});
}

function showDebtCelebration(type,group,entry,onDone=null){
    document.querySelectorAll('.debt-celebration').forEach(x=>x.remove());
    const pieces=Array.from({length:48},(_,i)=>{const angle=(i/48)*Math.PI*2;const radius=120+(i%7)*16;const x=Math.cos(angle)*radius;const y=Math.sin(angle)*radius-70-(i%5)*14;const rot=240+(i%9)*45;const delay=(i%12)*12;return `<i style="--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px;--r:${rot}deg;--delay:${delay}ms;--c:hsl(${(i*47)%360} 78% 60%)"></i>`;}).join('');
    const overlay=document.createElement('div');
    overlay.className='desire-celebration debt-celebration';
    const title=type==='debt'?'¡Deuda saldada!':'¡Pago recibido!';
    const text=type==='debt'?`Terminaste de pagar <strong>${escapeDebtHtml(entry.reason)}</strong> de ${escapeDebtHtml(group.person)}.`:`Recibiste por completo <strong>${escapeDebtHtml(entry.reason)}</strong> de ${escapeDebtHtml(group.person)}.`;
    overlay.innerHTML=`<div class="confetti-box">${pieces}<div class="celebration-content"><span>🎉</span><h3>${title}</h3><p>${text}</p><button>Continuar</button></div></div>`;
    document.body.append(overlay);
    requestAnimationFrame(()=>overlay.classList.add('show'));
    let done=false;
    const finish=()=>{if(done)return;done=true;if(overlay.isConnected)overlay.remove();if(typeof onDone==='function')onDone();};
    overlay.querySelector('button').onclick=finish;
    setTimeout(finish,6500);
}

/* =====================================================
   PAGAR / COBRAR PARCIALMENTE
===================================================== */

function debtMovementOptions(type){
    const options=[];
    if(type==='debt'){
        options.push({value:'saving',label:`💰 Ahorro · ${debtMoney(debtSavingBalance())}`,available:debtSavingBalance()});
        (Array.isArray(capital)?capital:[]).forEach(acc=>options.push({value:`capital:${acc.id}`,label:`${acc.icon||'💰'} ${acc.name} · ${debtMoney(debtAvailableCapital(acc))} disponible`,available:debtAvailableCapital(acc)}));
    }else{
        options.push({value:'saving',label:`💰 Ahorro · ${debtMoney(debtSavingBalance())}`,available:Infinity});
        (Array.isArray(capital)?capital:[]).forEach(acc=>options.push({value:`capital:${acc.id}`,label:`${acc.icon||'💰'} ${acc.name} · ${debtMoney(Number(acc.balance||0))}`,available:Infinity}));
    }
    return options;
}

function openDebtPayment(type,group,entry){
    const isDebt=type==='debt';
    const remaining=Math.max(0,Number(entry.remaining||0));
    const options=debtMovementOptions(type);
    const body=`
        <div class="debt-payment-summary">
            <div><span>${escapeDebtHtml(entry.icon||'🧾')} ${escapeDebtHtml(entry.reason)}</span><strong>${debtMoney(remaining)}</strong></div>
            <small>${escapeDebtHtml(group.person)} · pendiente actual</small>
        </div>
        <label>${isDebt?'Pagar desde':'Recibir en'}
            <select id="debt-payment-account">${options.map(o=>`<option value="${escapeDebtHtml(o.value)}">${escapeDebtHtml(o.label)}</option>`).join('')}</select>
        </label>
        <div class="debt-form-grid two">
            <label>Monto
                <input id="debt-payment-amount" type="number" min="1" step="100" inputmode="decimal" value="${remaining}">
            </label>
            <label>Fecha real del ${isDebt?'pago':'cobro'}
                <input id="debt-payment-date" type="date" min="${entry.occurredAt||''}" max="${debtToday()}" value="${debtToday()}">
            </label>
        </div>
        <div id="debt-payment-feedback" class="pocket-feedback"></div>
        <div class="debt-payment-quick"><button type="button" id="debt-payment-all">Usar saldo pendiente completo</button></div>
        <div class="pocket-modal-actions"><button type="button" class="pocket-cancel debt-payment-cancel">Cancelar</button><button type="button" class="pocket-primary" id="debt-payment-confirm">${isDebt?'Registrar pago':'Registrar cobro'}</button></div>`;

    openDebtModal({title:isDebt?'Pagar deuda':'Registrar dinero recibido',kicker:isDebt?'PAGO PARCIAL O TOTAL':'COBRO PARCIAL O TOTAL',body,onReady:o=>{
        const select=o.querySelector('#debt-payment-account');
        const amount=o.querySelector('#debt-payment-amount');
        const date=o.querySelector('#debt-payment-date');
        const feedback=o.querySelector('#debt-payment-feedback');
        const confirm=o.querySelector('#debt-payment-confirm');
        const optionByValue=v=>options.find(x=>x.value===v);
        const maxAllowed=()=>{
            if(!isDebt) return remaining;
            const opt=optionByValue(select.value);
            return Math.max(0,Math.min(remaining,Number(opt?.available||0)));
        };
        const update=()=>{
            let value=Math.max(0,Number(amount.value||0));
            const max=maxAllowed();
            if(value>max){value=max;amount.value=String(max);}
            const valid=value>0&&Boolean(date.value)&&Boolean(select.value)&&value<=max;
            feedback.className=`pocket-feedback ${valid?'valid':'error'}`;
            if(!options.length) feedback.textContent=isDebt?'No tienes Ahorro ni Capital disponible para pagar.':'Crea primero un Capital o configura Ahorro para recibir el dinero.';
            else if(isDebt) feedback.textContent=valid?`Después quedarán ${debtMoney(remaining-value)} pendientes.`:`Máximo disponible desde esta fuente: ${debtMoney(max)}.`;
            else feedback.textContent=valid?`Entrarán ${debtMoney(value)} al destino seleccionado y quedarán ${debtMoney(remaining-value)} por cobrar.`:'Introduce un monto válido.';
            confirm.disabled=!valid;
        };
        select.onchange=()=>{const max=maxAllowed();amount.value=String(max);update();};
        amount.oninput=update;date.onchange=update;
        o.querySelector('#debt-payment-all').onclick=()=>{amount.value=String(maxAllowed());update();};
        o.querySelector('.debt-payment-cancel').onclick=closeDebtModal;
        update();

        confirm.onclick=()=>{
            let value=Math.max(0,Number(amount.value||0));
            const max=maxAllowed();value=Math.min(value,max);
            if(!(value>0)||!date.value)return;
            let accountName='';
            let accountId=null;
            let accountType='';

            if(select.value==='saving'){
                const s=window.pocketSystem?.saving;
                if(!s)return showToast('Ahorro no está disponible.','var(--danger)');
                if(isDebt){if(Number(s.balance||0)<value)return showToast('Ahorro insuficiente.','var(--danger)');s.balance=Number(s.balance||0)-value;}
                else{s.balance=Number(s.balance||0)+value;}
                if(!Array.isArray(s.history))s.history=[];
                s.history.unshift({id:debtId(),date:new Date().toISOString(),type:isDebt?'resta':'suma',detail:`${isDebt?'Pago de deuda':'Cobro recibido'} · ${group.person} · ${entry.reason}`,amount:value});
                accountName='Ahorro';accountType='saving';
            }else if(select.value.startsWith('capital:')){
                const id=select.value.split(':')[1];
                const acc=(Array.isArray(capital)?capital:[]).find(c=>String(c.id)===String(id));
                if(!acc)return;
                if(isDebt){if(debtAvailableCapital(acc)<value)return showToast('Saldo disponible insuficiente.','var(--danger)');acc.balance=Number(acc.balance||0)-value;}
                else{acc.balance=Number(acc.balance||0)+value;}
                accountName=acc.name;accountId=acc.id;accountType='capital';
            }

            entry.paid=Math.min(Number(entry.originalAmount||0),Number(entry.paid||0)+value);
            entry.remaining=Math.max(0,Number(entry.originalAmount||0)-entry.paid);
            entry.amount=entry.remaining;
            entry.payments=Array.isArray(entry.payments)?entry.payments:[];
            const paymentRecord={id:debtId(),amount:value,occurredAt:date.value,createdAt:new Date().toISOString(),accountType,accountId,accountName,historyEventId:null};
            entry.payments.unshift(paymentRecord);
            recalcDebtGroup(group);

            const completed=entry.remaining<=0.00001;
            const paymentEvent=pushDebtHistory({date:date.value,type:isDebt?'resta':'suma',action:isDebt?'payment':'collection',direction:type,person:group.person,reason:entry.reason,amount:value,objectId:entry.id,source:isDebt?accountName:'',destination:isDebt?'':accountName,detail:`${isDebt?'Pago':'Cobro'} ${group.person} · ${entry.reason} · ${debtMoney(value)} · ${accountName}${completed?' · 🎉 Completado':''}`});
            paymentRecord.historyEventId=paymentEvent?.id || null;

            let completedGroup=group;
            const completedSnapshot={
                reason:entry.reason,
                originalAmount:Number(entry.originalAmount||0)
            };
            const completedGroupId=group.id;

            if(completed){
                pushDebtHistory({date:date.value,type:'edicion',action:'complete',direction:type,person:group.person,reason:entry.reason,amount:Number(entry.originalAmount||0),objectId:entry.id,detail:`🎉 ${isDebt?'Deuda pagada':'Cobro completado'}: ${group.person} · ${entry.reason}`});

                // El movimiento completado deja de ser una deuda/cobro pendiente.
                // Lo quitamos de la colección VIVA por ID para evitar cualquier
                // referencia obsoleta creada por normalizaciones previas.
                completedGroup=removeCompletedDebtEntry(type,completedGroupId,entry.id) || group;
            }

            closeDebtModal();refreshAll();
            if(completed){
                const personSnapshot={person:completedGroup?.person||group.person,icon:completedGroup?.icon||group.icon};
                showDebtCelebration(type,personSnapshot,completedSnapshot,()=>{
                    const currentGroup=debtGroupById(type,completedGroupId);
                    if(currentGroup && (currentGroup.entries?.length||0)===0) openEmptyDebtPersonChoice(type,completedGroupId);
                });
            }else{
                showToast(isDebt?'Pago registrado':'Cobro registrado');
            }
        };
    }});
}

/* =====================================================
   HISTORIAL DE PAGOS DE UNA DEUDA
===================================================== */

function openDebtPaymentsHistory(type,group,entry){
    const payments=Array.isArray(entry.payments)?entry.payments:[];
    const rows=payments.length?payments.map(p=>`
        <div class="debt-payment-history-row">
            <div><strong>${debtMoney(p.amount)}</strong><small>${debtDateLabel(p.occurredAt)} · ${escapeDebtHtml(p.accountName||'Sin destino')}</small></div>
            <button type="button" class="debt-payment-date-edit" data-payment-id="${p.id}">📅 Editar fecha</button>
        </div>`).join(''):`<div class="debt-empty-mini">Todavía no hay pagos parciales.</div>`;

    openDebtModal({title:`${entry.icon||'🧾'} ${escapeDebtHtml(entry.reason)}`,kicker:type==='debt'?'PAGOS REGISTRADOS':'COBROS REGISTRADOS',body:`
        <div class="debt-payment-history-summary"><span>Total original</span><strong>${debtMoney(entry.originalAmount)}</strong><span>${type==='debt'?'Pagado':'Cobrado'}</span><strong>${debtMoney(entry.paid)}</strong><span>Pendiente</span><strong>${debtMoney(entry.remaining)}</strong></div>
        <div class="debt-payment-history-list">${rows}</div>`,onReady:o=>{
            o.querySelectorAll('.debt-payment-date-edit').forEach(btn=>btn.onclick=()=>{
                const payment=payments.find(p=>String(p.id)===String(btn.dataset.paymentId));if(!payment)return;
                openDebtPaymentDateEditor(type,group,entry,payment);
            });
        }});
}

function openDebtPaymentDateEditor(type,group,entry,payment){
    openDebtModal({title:'Editar fecha del movimiento',kicker:'LÍNEA DE TIEMPO',body:`
        <p class="debt-modal-help">Solo cambia la fecha financiera del movimiento. La fecha técnica de registro en FeliOS no se modifica.</p>
        <label>Fecha real<input id="debt-payment-date-edit-input" type="date" min="${entry.occurredAt||''}" max="${debtToday()}" value="${payment.occurredAt||debtToday()}"></label>
        <div class="debt-technical-date">Registrado en FeliOS: ${escapeDebtHtml(debtDateTimeLabel(payment.createdAt))}</div>
        <div class="pocket-modal-actions"><button class="pocket-cancel debt-payment-date-cancel">Cancelar</button><button class="pocket-primary" id="debt-payment-date-save">Guardar fecha</button></div>`,onReady:o=>{
            o.querySelector('.debt-payment-date-cancel').onclick=()=>openDebtPaymentsHistory(type,group,entry);
            o.querySelector('#debt-payment-date-save').onclick=()=>{
                const value=o.querySelector('#debt-payment-date-edit-input').value;if(!value)return;
                const old=payment.occurredAt;payment.occurredAt=value;
                const financialEvent=debtHistoryEventById(payment.historyEventId);
                if(financialEvent)financialEvent.date=value;
                pushDebtHistory({date:debtToday(),type:'edicion',action:'payment-date-edit',direction:type,person:group.person,reason:entry.reason,amount:payment.amount,objectId:entry.id,detail:`Fecha de ${type==='debt'?'pago':'cobro'} corregida: ${debtDateLabel(old)} → ${debtDateLabel(value)} · ${group.person} · ${entry.reason}`});
                openDebtPaymentsHistory(type,group,entry);refreshAll();
            };
        }});
}

/* =====================================================
   ELIMINAR
===================================================== */

async function deleteDebtEntry(type,group,entry){
    const text=Number(entry.paid||0)>0
        ? `Se eliminará el saldo pendiente de ${debtMoney(entry.remaining)}. Los pagos/cobros ya realizados permanecerán registrados en el historial general.`
        : `Se eliminará ${entry.reason} por ${debtMoney(entry.remaining)}. Esta acción no mueve dinero de Capital ni Ahorro.`;
    const ok=await feliosConfirm({title:`Eliminar ${type==='debt'?'deuda':'cobro'}`,message:text,confirmText:'Eliminar',danger:true});
    if(!ok)return;
    const idx=group.entries.indexOf(entry);if(idx>=0)group.entries.splice(idx,1);
    pushDebtHistory({date:debtToday(),type:'edicion',action:'delete',direction:type,person:group.person,reason:entry.reason,amount:entry.remaining,objectId:entry.id,detail:`Eliminado: ${group.person} · ${entry.reason} · saldo ${debtMoney(entry.remaining)}`});
    recalcDebtGroup(group);refreshAll();showToast('Movimiento eliminado');
    if((group.entries?.length||0)===0)setTimeout(()=>openEmptyDebtPersonChoice(type,group),120);
}

/* =====================================================
   DESGLOSE LEGADO
===================================================== */

document.body.addEventListener('click',e=>{
    if(!e.target.closest('.breakdown-trigger'))return;
    const tbody=document.querySelector('#breakdown-table tbody');const modalEl=document.getElementById('modalBreakdown');
    if(!tbody||!modalEl)return;
    normalizeDebtCollection(debts);tbody.innerHTML='';
    debts.forEach(d=>(d.entries||[]).forEach(entry=>{
        const tr=document.createElement('tr');tr.innerHTML=`<td>${escapeDebtHtml(d.person)}</td><td>${escapeDebtHtml(entry.reason)}</td><td>${debtMoney(entry.remaining)}</td>`;tbody.append(tr);
    }));
    if(window.bootstrap?.Modal)bootstrap.Modal.getOrCreateInstance(modalEl).show();
});

/* =====================================================
   EVENTOS
===================================================== */

document.body.addEventListener('click',e=>{
    const addDebt=e.target.closest('#add-debt');if(addDebt){e.preventDefault();return openDebtEditor('debt');}
    const addCredit=e.target.closest('#add-credit');if(addCredit){e.preventDefault();return openDebtEditor('credit');}

    const toggle=e.target.closest('.debt-person-toggle');
    if(toggle){
        const card=toggle.closest('.debt-person-card');if(!card)return;
        const type=card.dataset.type,id=card.dataset.id;
        const willOpen=!card.classList.contains('open');
        document.querySelectorAll(`.debt-person-card[data-type="${type}"].open`).forEach(other=>{
            if(other!==card){other.classList.remove('open');other.querySelector('.debt-person-toggle')?.setAttribute('aria-expanded','false');}
        });
        card.classList.toggle('open',willOpen);
        toggle.setAttribute('aria-expanded',willOpen?'true':'false');
        debtAccordionState[type]=willOpen?id:null;
        return;
    }

    const editPerson=e.target.closest('.debt-edit-person');
    if(editPerson){const type=editPerson.dataset.type,group=debtGroupById(type,editPerson.dataset.id);if(group)return openDebtPersonEditor(type,group);}

    const deletePerson=e.target.closest('.debt-delete-person');
    if(deletePerson){const type=deletePerson.dataset.type,group=debtGroupById(type,deletePerson.dataset.id);if(group&&(group.entries?.length||0)===0)return openEmptyDebtPersonChoice(type,group);}

    const addPerson=e.target.closest('.debt-add-to-person');
    if(addPerson){const type=addPerson.dataset.type,group=debtGroupById(type,addPerson.dataset.id);if(group)return openDebtEditor(type,{group});}

    const payment=e.target.closest('.debt-payment-btn');
    if(payment){const type=payment.dataset.type,group=debtGroupById(type,payment.dataset.groupId),entry=debtEntryById(group,payment.dataset.entryId);if(group&&entry)return openDebtPayment(type,group,entry);}

    const menuBtn=e.target.closest('.debt-entry-menu-btn');
    if(menuBtn){
        const wrap=menuBtn.closest('.debt-entry-menu-wrap');const pop=wrap?.querySelector('.debt-entry-menu-popover');if(!pop)return;
        document.querySelectorAll('.debt-entry-menu-popover.show').forEach(x=>{if(x!==pop)x.classList.remove('show');});
        pop.classList.toggle('show');return;
    }

    const edit=e.target.closest('.debt-entry-edit');
    const payments=e.target.closest('.debt-entry-payments');
    const del=e.target.closest('.debt-entry-delete');
    if(edit||payments||del){
        const row=e.target.closest('.debt-entry-row');if(!row)return;
        const type=row.dataset.type,group=debtGroupById(type,row.dataset.groupId),entry=debtEntryById(group,row.dataset.entryId);if(!group||!entry)return;
        row.querySelector('.debt-entry-menu-popover')?.classList.remove('show');
        if(edit)return openDebtEditor(type,{group,entry});
        if(payments)return openDebtPaymentsHistory(type,group,entry);
        if(del)return deleteDebtEntry(type,group,entry);
    }
});

document.addEventListener('click',e=>{
    if(e.target.closest('.debt-entry-menu-wrap'))return;
    document.querySelectorAll('.debt-entry-menu-popover.show').forEach(x=>x.classList.remove('show'));
});

document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
        if(document.querySelector('.debt-modal-overlay'))closeDebtModal();
        document.querySelectorAll('.debt-entry-menu-popover.show').forEach(x=>x.classList.remove('show'));
    }
});

/* =====================================================
   EXPONER
===================================================== */

window.renderList=renderList;
window.normalizeDebtCollection=normalizeDebtCollection;
