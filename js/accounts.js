/* =====================================================
   FELIOS ECONOMY — CAPITAL MANAGER

   Gestiona únicamente Capital:
   - Capital real
   - Bancos / efectivo / tarjetas
   - Personalización
   - Orden / ocultar / ver más
   - Sub-bolsillos internos
   - Edición de saldo

   NO controla Bolsillo, Ahorro ni Salarios.
===================================================== */

const CAPITAL_TYPES = {
    efectivo:{ name:'Efectivo', icon:'💵' },
    banco:{ name:'Banco', icon:'🏦' },
    virtual:{ name:'Banco virtual', icon:'📱' },
    tarjeta:{ name:'Tarjeta', icon:'💳' },
    otro:{ name:'Otro', icon:'💰' }
};

const MAX_MAIN_CAPITALS = 6;
let capitalMoreOpen = false;
let activeSubPocketAccordionId = null;
let activeSubPocketAccordionCleanup = null;
let activeSubPocketCapitalId = null;
let subPocketSortCleanup = null;

function escapeHtml(value){
    return String(value ?? '')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#039;');
}

function normalizeMoney(value){
    const normalized = String(value ?? '')
        .trim()
        .replace(/\s/g,'')
        .replace(/\.(?=\d{3}(?:\D|$))/g,'')
        .replace(',','.');
    return Number(normalized);
}

function getCapitalIcon(name='', type=''){
    const text = `${name} ${type}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'');
    if(text.includes('fisico') || text.includes('efectivo')) return '💵';
    if(text.includes('nequi')) return '📱';
    if(text.includes('lulo')) return '🍈';
    if(text.includes('banco')) return '🏦';
    if(text.includes('tarjeta')) return '💳';
    return CAPITAL_TYPES[type]?.icon || '💰';
}

function pushCapitalHistory(type, detail){
    if(!Array.isArray(history)) return;
    const text=String(detail||'').toLowerCase();
    const related=(Array.isArray(capital)?capital:[]).find(acc=>text.includes(String(acc.name||'').toLowerCase()));
    let action='edit';
    if(text.includes('transfer')) action='transfer';
    else if(text.includes('saldo')) action='balance';
    else if(text.includes('división creada')) action='division-create';
    else if(text.includes('división eliminada')) action='division-delete';
    else if(text.includes('división')) action='division';
    else if(text.includes('nuevo capital')) action='create';
    else if(text.includes('eliminado')) action='delete';
    const now=new Date().toISOString();
    history.unshift({
        id:`capital-${Date.now()}-${Math.floor(Math.random()*100000)}`,
        date:now.slice(0,10),
        createdAt:now,
        type,
        module:'capital',
        section:'capital',
        action,
        objectId:related?.id ?? null,
        objectName:related?.name || '',
        detail
    });
}

function getCapitalById(id){
    if(!Array.isArray(capital)) return null;
    return capital.find(c => String(c.id) === String(id)) || null;
}

function normalizeCapitalState(){
    if(!Array.isArray(capital)) return;
    capital.forEach((acc,index) => {
        acc.id = acc.id ?? (Date.now()+index);
        acc.name = acc.name || 'Capital';
        acc.type = CAPITAL_TYPES[acc.type] ? acc.type : 'otro';
        acc.icon = acc.icon || getCapitalIcon(acc.name,acc.type);
        acc.color = /^#[0-9a-fA-F]{6}$/.test(acc.color || '') ? acc.color.toUpperCase() : '#C8A951';
        acc.balance = Math.max(0, Number(acc.balance || 0));
        acc.hidden = Boolean(acc.hidden);
        acc.order = Number.isFinite(Number(acc.order)) ? Number(acc.order) : index;
        acc.settings = acc.settings || {allowSubPockets:true};
        acc.subPockets = Array.isArray(acc.subPockets) ? acc.subPockets : [];
        acc.subPockets.forEach((p,pIndex) => {
            p.id = p.id ?? (Date.now()+pIndex);
            p.name = p.name || 'División';
            p.icon = p.icon || '◈';
            p.amount = Math.max(0, Number(p.amount || 0));
            p.order = Number.isFinite(Number(p.order)) ? Number(p.order) : pIndex;
        });
        acc.subPockets.sort((a,b) => Number(a.order)-Number(b.order));
        acc.subPockets.forEach((p,i) => p.order = i);
    });
}

function getOrderedCapitals({includeHidden=false} = {}){
    normalizeCapitalState();
    return [...capital]
        .filter(acc => includeHidden || !acc.hidden)
        .sort((a,b) => Number(a.order)-Number(b.order));
}

function compactCapitalOrders(){
    const visible = getOrderedCapitals().filter(acc => !acc.hidden);
    const hidden = getOrderedCapitals({includeHidden:true})
        .filter(acc => acc.hidden)
        .sort((a,b) => Number(a.order)-Number(b.order));
    [...visible,...hidden].forEach((acc,i) => acc.order = i);
}

function getCapitalSeparated(acc){
    if(!acc || !Array.isArray(acc.subPockets)) return 0;
    return acc.subPockets.reduce((total,p) => total + Math.max(0,Number(p.amount || 0)),0);
}

function getCapitalAvailable(acc){
    if(!acc) return 0;
    return Math.max(0, Number(acc.balance || 0) - getCapitalSeparated(acc));
}

function getPocketTotal(){
    if(!Array.isArray(pockets)) return 0;
    return pockets.reduce((sum,p) => sum + Number(p.balance ?? p.total ?? 0),0);
}

function createCapital(data={}){
    const order = getOrderedCapitals({includeHidden:true}).length;
    return {
        id:Date.now()+Math.floor(Math.random()*1000),
        name:data.name || 'Nuevo capital',
        type:CAPITAL_TYPES[data.type] ? data.type : 'otro',
        icon:data.icon || getCapitalIcon(data.name,data.type),
        color:data.color || '#C8A951',
        balance:Math.max(0,Number(data.balance || 0)),
        hidden:Boolean(data.hidden),
        order:Number.isFinite(Number(data.order)) ? Number(data.order) : order,
        subPockets:Array.isArray(data.subPockets) ? data.subPockets : [],
        settings:data.settings || {allowSubPockets:true},
        created:data.created || new Date().toISOString()
    };
}
window.createCapital = createCapital;

/* =====================================================
   TARJETAS / RENDER
===================================================== */

function renderCapitalCard(acc){
    const type = CAPITAL_TYPES[acc.type] || CAPITAL_TYPES.otro;
    const subPockets = Array.isArray(acc.subPockets) ? acc.subPockets : [];
    const separated = getCapitalSeparated(acc);
    return `
        <div class="card account-card capital-card" data-id="${acc.id}" style="--capital-color:${acc.color || '#C8A951'}">
            <div class="card-body">
                <div class="account-top">
                    <div class="account-name">
                        <span class="acc-emoji">${escapeHtml(acc.icon || getCapitalIcon(acc.name,acc.type))}</span>
                        <strong>${escapeHtml(acc.name)}</strong>
                    </div>
                    <button type="button" class="capital-menu" aria-label="Opciones de ${escapeHtml(acc.name)}" title="Opciones">⋮</button>
                </div>

                <div class="account-type">${type.icon} ${type.name}</div>

                <div class="balance-row">
                    <div class="balance">${fmt.format(Number(acc.balance || 0))}</div>
                    <button type="button" class="edit-balance" title="Editar saldo" aria-label="Editar saldo">✏️</button>
                </div>

                ${separated > 0 ? `
                    <div class="account-separated">Separado: <strong>${fmt.format(separated)}</strong></div>
                ` : ''}

                <div class="account-footer">
                    <button type="button" class="sub-pocket-trigger" title="Mostrar divisiones" aria-expanded="false">
                        <span class="sub-pocket-label">📂 ${subPockets.length} ${subPockets.length === 1 ? 'división' : 'divisiones'}</span>
                        <span class="sub-pocket-chevron" aria-hidden="true">›</span>
                    </button>
                </div>
            </div>
        </div>`;
}

function createCapitalCol(acc, extraClass=''){
    const col = document.createElement('div');
    col.className = `col-md-4 col-lg-3 ${extraClass}`.trim();
    col.dataset.capitalColId = String(acc.id);
    col.innerHTML = renderCapitalCard(acc);
    return col;
}

function renderAccounts(){
    const container = document.getElementById('accounts');
    if(!container) return;

    normalizeCapitalState();
    container.innerHTML = '';

    // Nuevo capital — siempre primero.
    const createCol = document.createElement('div');
    createCol.className = 'col-md-4 col-lg-3';
    createCol.innerHTML = `
        <div class="account-card add-capital-card" id="create-capital">
            <div class="add-capital-content">
                <div class="account-add-icon">+</div>
                <strong>Nuevo capital</strong>
                <small>Banco, efectivo o tarjeta</small>
            </div>
        </div>`;
    container.append(createCol);

    // Bolsillo fijo — siempre segundo.
    const bolsilloCol = document.createElement('div');
    bolsilloCol.className = 'col-md-4 col-lg-3';
    bolsilloCol.innerHTML = `
        <div class="card account-card fixed-pocket-card" data-fixed="bolsillo" style="--capital-color:#C8A951">
            <div class="card-body">
                <div class="account-top">
                    <div class="account-name"><span class="acc-emoji">👜</span><strong>Bolsillo</strong></div>
                </div>
                <div class="account-type">🐷 Distribución de dinero</div>
                <div class="balance-row"><div class="balance">${fmt.format(getPocketTotal())}</div></div>
                <div class="fixed-pocket-info">Metas, gastos y ahorro</div>
                <div class="account-footer">
                    <button type="button" class="sub-pocket-trigger fixed-pocket-trigger" title="Ver bolsillos"><span>🐷 Ver bolsillos</span></button>
                </div>
            </div>
        </div>`;
    container.append(bolsilloCol);

    const visible = getOrderedCapitals().filter(acc => !acc.hidden);
    const main = visible.slice(0,MAX_MAIN_CAPITALS);
    const extra = visible.slice(MAX_MAIN_CAPITALS);

    main.forEach(acc => container.append(createCapitalCol(acc)));

    if(capital.length){
        const toolsCol = document.createElement('div');
        toolsCol.className = 'col-12 capital-section-tools-col';
        toolsCol.innerHTML = `
            <div class="capital-section-tools">
                ${extra.length ? `
                    <button type="button" class="capital-show-more" aria-expanded="${capitalMoreOpen ? 'true' : 'false'}">
                        <span>${capitalMoreOpen ? '−' : '+'}</span>
                        ${capitalMoreOpen ? 'Ver menos' : 'Ver más'} · ${extra.length}
                    </button>
                ` : ''}
                <button type="button" class="capital-organize-button">⚙️ Organizar capitales</button>
            </div>`;
        container.append(toolsCol);

        if(extra.length){
            const moreCol = document.createElement('div');
            moreCol.className = `col-12 capital-more-wrapper ${capitalMoreOpen ? 'show' : ''}`;
            moreCol.innerHTML = `<div class="capital-more-grid row g-3"></div>`;
            const grid = moreCol.querySelector('.capital-more-grid');
            extra.forEach(acc => grid.append(createCapitalCol(acc,'capital-extra-col')));
            container.append(moreCol);
        }
    }

    if(activeSubPocketAccordionId){
        requestAnimationFrame(refreshSubPocketAccordion);
    }
}

/* =====================================================
   VER MÁS
===================================================== */

document.body.addEventListener('click', e => {
    const button = e.target.closest('.capital-show-more');
    if(!button) return;
    capitalMoreOpen = !capitalMoreOpen;
    closeSubPocketAccordion();
    renderAccounts();
});

/* =====================================================
   CREAR CAPITAL
===================================================== */

function openCapitalMetaEditor(acc=null){
    document.querySelectorAll('.capital-meta-overlay').forEach(el=>el.remove());
    const editing=Boolean(acc);
    const overlay=document.createElement('div');
    overlay.className='capital-meta-overlay';
    overlay.innerHTML=`
        <div class="capital-meta-card" role="dialog" aria-modal="true">
            <div class="capital-meta-head"><div><small>${editing?'EDITAR CAPITAL':'NUEVO CAPITAL'}</small><h4>${editing?`${escapeHtml(acc.icon||'💰')} ${escapeHtml(acc.name)}`:'Crea un nuevo lugar para tu dinero'}</h4></div><button type="button" class="capital-meta-close">×</button></div>
            <div class="capital-meta-grid">
                <label>Emoji<input class="capital-meta-icon" value="${escapeHtml(editing?acc.icon:getCapitalIcon('', 'banco'))}" maxlength="8"></label>
                <label>Nombre<input class="capital-meta-name" value="${escapeHtml(editing?acc.name:'')}" maxlength="40" placeholder="Ej. Nequi, Banco, Efectivo..."></label>
            </div>
            <label>Tipo<select class="capital-meta-type">${Object.entries(CAPITAL_TYPES).map(([id,t])=>`<option value="${id}" ${(editing?acc.type:'banco')===id?'selected':''}>${t.icon} ${t.name}</option>`).join('')}</select></label>
            <div class="capital-meta-preview"><span>Vista previa</span><div><strong class="capital-meta-preview-icon">${escapeHtml(editing?acc.icon:'🏦')}</strong><div><b class="capital-meta-preview-name">${escapeHtml(editing?acc.name:'Nuevo capital')}</b><small class="capital-meta-preview-type">${CAPITAL_TYPES[editing?acc.type:'banco'].name}</small></div></div></div>
            <div class="capital-meta-actions"><button type="button" class="capital-meta-cancel">Cancelar</button><button type="button" class="capital-meta-save">${editing?'Guardar cambios':'Crear capital'}</button></div>
        </div>`;
    document.body.append(overlay);requestAnimationFrame(()=>overlay.classList.add('show'));
    const icon=overlay.querySelector('.capital-meta-icon'),name=overlay.querySelector('.capital-meta-name'),type=overlay.querySelector('.capital-meta-type'),save=overlay.querySelector('.capital-meta-save');
    const update=()=>{const t=CAPITAL_TYPES[type.value]||CAPITAL_TYPES.otro;overlay.querySelector('.capital-meta-preview-icon').textContent=icon.value.trim()||t.icon;overlay.querySelector('.capital-meta-preview-name').textContent=name.value.trim()||'Nuevo capital';overlay.querySelector('.capital-meta-preview-type').textContent=t.name;save.disabled=!name.value.trim();};
    icon.oninput=name.oninput=type.onchange=update;update();
    const close=()=>{overlay.classList.remove('show');setTimeout(()=>overlay.remove(),150);};
    overlay.querySelector('.capital-meta-close').onclick=close;overlay.querySelector('.capital-meta-cancel').onclick=close;overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close();});
    save.onclick=()=>{const nm=name.value.trim();if(!nm)return;const tp=CAPITAL_TYPES[type.value]?type.value:'otro';const ic=icon.value.trim()||getCapitalIcon(nm,tp);if(editing){const old=acc.name;acc.name=nm;acc.type=tp;acc.icon=ic;pushCapitalHistory('edicion',`Capital actualizado: ${old} → ${acc.name}`);}else{capital.push(createCapital({name:nm,type:tp,icon:ic}));compactCapitalOrders();pushCapitalHistory('suma',`Nuevo capital creado: ${nm}`);}close();refreshAll();};
    setTimeout(()=>name.focus(),70);
}

document.body.addEventListener('click', e => {
    if(!e.target.closest('#create-capital')) return;
    openCapitalMetaEditor();
});

/* =====================================================
   CONFIRMACIÓN / EDITORES MONETARIOS
===================================================== */

function feliosConfirm({title='Confirmar',message='',confirmText='Confirmar',danger=false} = {}){
    return new Promise(resolve => {
        document.querySelectorAll('.felios-confirm-overlay').forEach(el => el.remove());
        const overlay = document.createElement('div');
        overlay.className = 'felios-confirm-overlay';
        overlay.innerHTML = `
            <div class="felios-confirm-card" role="dialog" aria-modal="true">
                <div class="felios-confirm-icon">${danger ? '⚠️' : '✓'}</div>
                <h4>${escapeHtml(title)}</h4>
                <p>${escapeHtml(message).replace(/\n/g,'<br>')}</p>
                <div class="felios-confirm-actions">
                    <button type="button" class="felios-confirm-cancel">Cancelar</button>
                    <button type="button" class="felios-confirm-ok ${danger ? 'danger' : ''}">${escapeHtml(confirmText)}</button>
                </div>
            </div>`;
        document.body.append(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));
        const finish = value => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(),160);
            resolve(value);
        };
        overlay.querySelector('.felios-confirm-cancel').onclick = () => finish(false);
        overlay.querySelector('.felios-confirm-ok').onclick = () => finish(true);
        overlay.addEventListener('pointerdown', ev => { if(ev.target === overlay) finish(false); });
    });
}

function openCapitalBalanceEditor(acc){
    document.querySelectorAll('.felios-money-overlay').forEach(el => el.remove());
    const separated = getCapitalSeparated(acc);
    const overlay = document.createElement('div');
    overlay.className = 'felios-money-overlay';
    overlay.innerHTML = `
        <div class="felios-money-card" role="dialog" aria-modal="true">
            <div class="felios-money-head">
                <div><small>SALDO DEL CAPITAL</small><h4>${escapeHtml(acc.icon || '💰')} ${escapeHtml(acc.name)}</h4></div>
                <button type="button" class="felios-money-close">×</button>
            </div>
            <div class="felios-money-current">
                <span>Saldo actual</span><strong>${fmt.format(acc.balance)}</strong>
            </div>
            <label>Nuevo saldo</label>
            <input class="felios-money-input" type="number" min="${separated}" step="100" value="${Number(acc.balance || 0)}">
            <div class="felios-money-preview"></div>
            <div class="felios-money-actions">
                <button type="button" class="felios-money-cancel">Cancelar</button>
                <button type="button" class="felios-money-save">Confirmar cambio</button>
            </div>
        </div>`;
    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    const input = overlay.querySelector('.felios-money-input');
    const preview = overlay.querySelector('.felios-money-preview');
    const save = overlay.querySelector('.felios-money-save');
    const update = () => {
        const value = Number(input.value);
        const valid = Number.isFinite(value) && value >= separated;
        const availableAfter = valid ? value - separated : 0;
        preview.className = `felios-money-preview ${valid ? 'valid' : 'error'}`;
        preview.innerHTML = valid
            ? `Disponible después: <strong>${fmt.format(availableAfter)}</strong>`
            : `El saldo no puede ser menor al dinero separado: <strong>${fmt.format(separated)}</strong>`;
        save.disabled = !valid || value === Number(acc.balance || 0);
    };
    input.addEventListener('input',update);
    update();
    const close = () => { overlay.classList.remove('show'); setTimeout(()=>overlay.remove(),160); };
    overlay.querySelector('.felios-money-close').onclick = close;
    overlay.querySelector('.felios-money-cancel').onclick = close;
    overlay.addEventListener('pointerdown',ev => { if(ev.target === overlay) close(); });
    save.onclick = async () => {
        const value = Number(input.value);
        if(!Number.isFinite(value) || value < separated) return;
        const ok = await feliosConfirm({
            title:'Confirmar saldo',
            message:`${acc.name}\n${fmt.format(acc.balance)} → ${fmt.format(value)}`,
            confirmText:'Guardar cambio'
        });
        if(!ok) return;
        const old = Number(acc.balance || 0);
        acc.balance = value;
        pushCapitalHistory('edicion',`Saldo de ${acc.name}: ${fmt.format(old)} → ${fmt.format(value)}`);
        close();
        refreshAll();
    };
    setTimeout(() => { input.focus(); input.select(); },80);
}

document.body.addEventListener('click', e => {
    const button = e.target.closest('.edit-balance');
    if(!button) return;
    const card = button.closest('.capital-card');
    const acc = card && getCapitalById(card.dataset.id);
    if(acc) openCapitalBalanceEditor(acc);
});

/* =====================================================
   MENÚ ⋮ INTELIGENTE
===================================================== */

function closeCapitalActionsMenus(){
    document.querySelectorAll('.capital-actions-menu').forEach(menu => {
        if(typeof menu._feliosCleanup === 'function') menu._feliosCleanup();
        menu.classList.remove('show');
        setTimeout(() => { if(menu.isConnected) menu.remove(); },160);
    });
}

function positionCapitalActionsMenu(menu, button){
    if(!menu || !button || !button.isConnected) return;
    const rect = button.getBoundingClientRect();
    const cardRect = button.closest('.capital-card')?.getBoundingClientRect() || rect;
    const margin = 10;
    const gap = 10;
    const width = Math.min(200,window.innerWidth-margin*2);
    const height = menu.offsetHeight || 185;
    const rightCandidate = cardRect.right + gap;
    const leftCandidate = cardRect.left - width - gap;
    let left;
    if(rightCandidate + width <= window.innerWidth-margin) left = rightCandidate;
    else if(leftCandidate >= margin) left = leftCandidate;
    else left = Math.max(margin,Math.min(rect.right-width,window.innerWidth-width-margin));
    let top = cardRect.top;
    if(top + height > window.innerHeight-margin) top = window.innerHeight-height-margin;
    if(top < margin) top = Math.max(margin,rect.bottom+gap);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.width = `${width}px`;
}

document.body.addEventListener('click', e => {
    const button = e.target.closest('.capital-menu');
    if(!button) return;
    const card = button.closest('.capital-card');
    if(!card) return;
    const id = String(card.dataset.id);
    const existing = document.querySelector(`.capital-actions-menu[data-capital-id="${CSS.escape(id)}"]`);
    if(existing){ closeCapitalActionsMenus(); return; }
    closeCapitalActionsMenus();
    const acc = getCapitalById(id);
    if(!acc) return;
    const menu = document.createElement('div');
    menu.className = 'capital-actions-menu';
    menu.dataset.capitalId = id;
    menu.innerHTML = `
        <button type="button" class="capital-action-edit">✏️ Editar capital</button>
        <button type="button" class="capital-action-color">🎨 Cambiar color</button>
        <button type="button" class="capital-action-hide">👁️ Ocultar capital</button>
        <button type="button" class="capital-action-delete">🗑️ Eliminar</button>`;
    document.body.append(menu);
    const reposition = () => positionCapitalActionsMenu(menu,button);
    const outside = ev => { if(!menu.contains(ev.target) && !button.contains(ev.target)) closeCapitalActionsMenus(); };
    window.addEventListener('resize',reposition);
    window.addEventListener('scroll',reposition,true);
    menu._feliosCleanup = () => {
        window.removeEventListener('resize',reposition);
        window.removeEventListener('scroll',reposition,true);
        document.removeEventListener('pointerdown',outside);
    };
    requestAnimationFrame(() => { reposition(); menu.classList.add('show'); });
    setTimeout(() => document.addEventListener('pointerdown',outside),0);
});

document.body.addEventListener('click', e => {
    const button = e.target.closest('.capital-action-edit');
    if(!button) return;
    const id = button.closest('.capital-actions-menu')?.dataset.capitalId;
    const acc = id && getCapitalById(id);
    if(!acc) return;
    closeCapitalActionsMenus();
    openCapitalMetaEditor(acc);
});

document.body.addEventListener('click', e => {
    const button = e.target.closest('.capital-action-hide');
    if(!button) return;
    const id = button.closest('.capital-actions-menu')?.dataset.capitalId;
    const acc = id && getCapitalById(id);
    if(!acc) return;
    closeCapitalActionsMenus();
    closeSubPocketAccordion();
    acc.hidden = true;
    compactCapitalOrders();
    pushCapitalHistory('edicion',`Capital ocultado: ${acc.name}`);
    refreshAll();
});

function removeCapitalCompletely(acc, detail){
    if(typeof detachLinksForCapital==='function')detachLinksForCapital(acc,{record:true});
    const index=capital.indexOf(acc);if(index>=0)capital.splice(index,1);
    compactCapitalOrders();
    pushCapitalHistory('edicion',detail||`Capital eliminado: ${acc.name}`);
    refreshAll();
}

function openCapitalDeleteFlow(acc){
    const total=Math.max(0,Number(acc.balance||0));
    const linkedCount=(acc.subPockets||[]).filter(sp=>typeof getPocketForLinkedSubPocket==='function'&&getPocketForLinkedSubPocket(acc,sp)).length;
    const otherCapitals=capital.filter(c=>String(c.id)!==String(acc.id));
    const options=[`<option value="saving">💰 Ahorro</option>`,...otherCapitals.map(c=>`<option value="capital:${c.id}">${escapeHtml(c.icon||'💰')} ${escapeHtml(c.name)}</option>`)].join('');
    if(typeof openPocketModal!=='function'){
        return feliosConfirm({title:'Eliminar capital',message:`¿Eliminar ${acc.name}?`,confirmText:'Eliminar',danger:true}).then(ok=>{if(ok)removeCapitalCompletely(acc,`Capital eliminado con ${fmt.format(total)}: ${acc.name}`);});
    }
    const body=`
        <div class="block-delete-warning"><span>⚠️</span><div><strong>Eliminar ${escapeHtml(acc.name)}</strong><p>Al eliminar este bloque se perderán sus divisiones y configuración. Actualmente contiene <b>${fmt.format(total)}</b>.${linkedCount?` <b>${linkedCount} división${linkedCount===1?' está':'es están'} vinculada${linkedCount===1?'':'s'}</b> y se desvinculará${linkedCount===1?'':'n'} de Bolsillos antes de eliminar.`:''}</p></div></div>
        <div class="block-delete-transfer">
            <label>Transferir todo antes de eliminar<select id="delete-capital-destination">${options}</select></label>
            <button type="button" class="pocket-primary" id="delete-capital-transfer" ${total<=0?'disabled':''}>⇄ Transferir ${fmt.format(total)} y eliminar</button>
        </div>
        <div class="delete-choice-separator"><span>o</span></div>
        <button type="button" class="delete-with-money" id="delete-capital-force">🗑️ Eliminar bloque con todo y dinero</button>
        <button type="button" class="pocket-cancel full">Cancelar eliminación</button>`;
    openPocketModal({title:'Eliminar capital',kicker:'ACCIÓN IMPORTANTE',body,onReady:o=>{
        o.querySelector('.pocket-cancel').onclick=closePocketModal;
        const transfer=o.querySelector('#delete-capital-transfer');
        if(transfer)transfer.onclick=async()=>{
            if(!(total>0))return;
            const dest=o.querySelector('#delete-capital-destination').value;
            const ok=await feliosConfirm({title:'Transferir y eliminar',message:`Se transferirán ${fmt.format(total)} antes de eliminar ${acc.name}.`,confirmText:'Transferir y eliminar'});if(!ok)return;
            if(dest==='saving'){
                const sv=window.pocketSystem?.saving;
                if(!sv)return;
                sv.previousContribution=Number(sv.lastContribution||0);sv.lastContribution=total;sv.balance=Number(sv.balance||0)+total;sv.totalReceived=Number(sv.totalReceived||0)+total;
                if(typeof savingHistory==='function')savingHistory('suma',`Recuperado al eliminar ${acc.name}: +${fmt.format(total)}`,total);
                else history.unshift({date:new Date().toISOString().slice(0,10),type:'suma',detail:`💰 Ahorro: +${fmt.format(total)} desde ${acc.name}`});
            }else if(dest.startsWith('capital:')){
                const target=getCapitalById(dest.split(':')[1]);if(!target)return;
                target.balance=Number(target.balance||0)+total;
                pushCapitalHistory('suma',`${target.name}: +${fmt.format(total)} transferidos desde ${acc.name}`);
            }
            closePocketModal();
            removeCapitalCompletely(acc,`Capital eliminado después de transferir ${fmt.format(total)}: ${acc.name}`);
        };
        o.querySelector('#delete-capital-force').onclick=async()=>{
            const ok=await feliosConfirm({title:'Eliminar con todo y dinero',message:`Se eliminará ${acc.name} y ${fmt.format(total)} dejarán de formar parte de FeliOS. Esta acción no se puede deshacer.`,confirmText:'Eliminar definitivamente',danger:true});if(!ok)return;
            closePocketModal();
            removeCapitalCompletely(acc,`Capital eliminado con ${fmt.format(total)}: ${acc.name}`);
        };
    }});
}

document.body.addEventListener('click', e => {
    const button = e.target.closest('.capital-action-delete');
    if(!button) return;
    const id = button.closest('.capital-actions-menu')?.dataset.capitalId;
    const acc = id && getCapitalById(id);
    if(!acc) return;
    closeCapitalActionsMenus();
    openCapitalDeleteFlow(acc);
});

/* =====================================================
   EDITOR VISUAL DE COLOR
===================================================== */

function hexToHsv(hex){
    const value = hex.replace('#','');
    const r=parseInt(value.slice(0,2),16)/255, g=parseInt(value.slice(2,4),16)/255, b=parseInt(value.slice(4,6),16)/255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b), delta=max-min;
    let h=0;
    if(delta!==0){
        if(max===r) h=60*(((g-b)/delta)%6);
        else if(max===g) h=60*(((b-r)/delta)+2);
        else h=60*(((r-g)/delta)+4);
    }
    if(h<0) h+=360;
    return {h,s:max===0?0:delta/max,v:max};
}

function hsvToHex(h,s,v){
    const c=v*s, x=c*(1-Math.abs(((h/60)%2)-1)), m=v-c;
    let r=0,g=0,b=0;
    if(h<60){r=c;g=x;} else if(h<120){r=x;g=c;} else if(h<180){g=c;b=x;} else if(h<240){g=x;b=c;} else if(h<300){r=x;b=c;} else {r=c;b=x;}
    const toHex=n=>Math.round((n+m)*255).toString(16).padStart(2,'0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function getCapitalCardElement(id){
    return Array.from(document.querySelectorAll('#accounts .capital-card')).find(card => String(card.dataset.id) === String(id)) || null;
}

function openCapitalColorEditor(acc,card){
    closeCapitalActionsMenus();
    document.querySelectorAll('.capital-color-editor').forEach(editor => editor.remove());
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(acc.color || '') ? acc.color.toUpperCase() : '#C8A951';
    const editor = document.createElement('div');
    editor.className = 'capital-color-editor';
    editor.innerHTML = `
        <div class="color-editor-header"><strong>🎨 Color del capital</strong><button type="button" class="color-editor-close">×</button></div>
        <div class="color-picker-visual">
            <div class="color-picker-area" role="slider"><div class="color-picker-thumb"></div></div>
            <input type="range" class="color-hue-slider" min="0" max="360" step="1">
        </div>
        <div class="color-custom-row">
            <div class="color-current-chip"></div>
            <div class="color-hex-field"><span>HEX</span><input type="text" class="capital-color-hex" value="${safeColor}" maxlength="7"></div>
        </div>
        <div class="color-preview-box"><span>Vista previa</span><div class="color-preview-line"></div></div>
        <div class="color-editor-actions"><button type="button" class="color-cancel">Cancelar</button><button type="button" class="color-save">Guardar color</button></div>`;
    document.body.append(editor);
    const area=editor.querySelector('.color-picker-area'), thumb=editor.querySelector('.color-picker-thumb'), hue=editor.querySelector('.color-hue-slider'), hex=editor.querySelector('.capital-color-hex'), preview=editor.querySelector('.color-preview-line'), chip=editor.querySelector('.color-current-chip');
    let hsv=hexToHsv(safeColor), dragging=false;
    const currentHex=()=>hsvToHex(hsv.h,hsv.s,hsv.v);
    const updateCard=color=>{ preview.style.background=color; preview.style.boxShadow=`0 0 14px ${color}`; chip.style.background=color; card.style.setProperty('--capital-color',color); };
    const renderPicker=(updateHex=true)=>{
        const hueColor=`hsl(${hsv.h} 100% 50%)`;
        area.style.background=`linear-gradient(to top,#000 0%,transparent 100%),linear-gradient(to right,#fff 0%,${hueColor} 100%)`;
        thumb.style.left=`${hsv.s*100}%`; thumb.style.top=`${(1-hsv.v)*100}%`; hue.value=String(Math.round(hsv.h));
        const color=currentHex(); if(updateHex) hex.value=color; updateCard(color);
    };
    const setPointer=event=>{ const rect=area.getBoundingClientRect(); const x=Math.max(0,Math.min(rect.width,event.clientX-rect.left)); const y=Math.max(0,Math.min(rect.height,event.clientY-rect.top)); hsv.s=rect.width?x/rect.width:0; hsv.v=rect.height?1-y/rect.height:1; renderPicker(); };
    area.addEventListener('pointerdown',ev=>{dragging=true;area.setPointerCapture?.(ev.pointerId);setPointer(ev);});
    area.addEventListener('pointermove',ev=>{if(dragging)setPointer(ev);});
    area.addEventListener('pointerup',()=>dragging=false); area.addEventListener('pointercancel',()=>dragging=false);
    hue.addEventListener('input',()=>{hsv.h=Number(hue.value)||0;renderPicker();});
    hex.addEventListener('input',()=>{let value=hex.value.trim();if(!value.startsWith('#'))value=`#${value}`;if(/^#[0-9a-fA-F]{6}$/.test(value)){hsv=hexToHsv(value);renderPicker(false);updateCard(value.toUpperCase());}});
    const position=()=>{
        const rect=card.getBoundingClientRect(), margin=10, width=Math.min(330,window.innerWidth-margin*2), height=editor.offsetHeight||390;
        let left,top;
        if(window.innerWidth<=700){left=Math.max(margin,(window.innerWidth-width)/2);top=Math.max(margin,(window.innerHeight-height)/2);} else {
            const right=rect.right+margin, leftCandidate=rect.left-width-margin;
            if(right+width<=window.innerWidth-margin) left=right; else if(leftCandidate>=margin) left=leftCandidate; else left=Math.max(margin,window.innerWidth-width-margin);
            top=Math.max(margin,Math.min(rect.top,window.innerHeight-height-margin));
        }
        editor.style.left=`${Math.round(left)}px`;editor.style.top=`${Math.round(top)}px`;editor.style.width=`${width}px`;
    };
    let outside;
    const close=()=>{card.style.setProperty('--capital-color',acc.color||'#C8A951');document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);editor.remove();};
    editor.querySelector('.color-editor-close').onclick=close; editor.querySelector('.color-cancel').onclick=close;
    editor.querySelector('.color-save').onclick=()=>{const final=hex.value.trim().toUpperCase();if(!/^#[0-9A-F]{6}$/.test(final)){showToast('Color inválido. Usa un HEX de 6 dígitos.','var(--danger)');return;}acc.color=final;pushCapitalHistory('edicion',`Color de ${acc.name} actualizado`);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);editor.remove();refreshAll();};
    outside=event=>{if(!editor.contains(event.target))close();};
    requestAnimationFrame(()=>document.addEventListener('pointerdown',outside));
    window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
    renderPicker();requestAnimationFrame(()=>{position();editor.classList.add('show');});
}

document.body.addEventListener('click',e=>{
    const button=e.target.closest('.capital-action-color');if(!button)return;
    const id=button.closest('.capital-actions-menu')?.dataset.capitalId;const acc=id&&getCapitalById(id);const card=acc&&getCapitalCardElement(acc.id);if(acc&&card)openCapitalColorEditor(acc,card);
});

/* =====================================================
   ACORDEÓN FLOTANTE DE DIVISIONES
===================================================== */

function getOrderedSubPockets(acc){
    const list = Array.isArray(acc?.subPockets) ? [...acc.subPockets] : [];
    return list.sort((a,b)=>Number(a.order)-Number(b.order));
}

function renderQuickSubPockets(acc){
    const subPockets=getOrderedSubPockets(acc), available=getCapitalAvailable(acc);
    const content=subPockets.length?`
        <div class="subpocket-floating-list">
            ${subPockets.map(p=>`<div class="quick-subpocket-row"><div class="quick-subpocket-name"><span class="quick-subpocket-icon">${escapeHtml(p.icon||'◈')}</span><div><strong>${escapeHtml(p.name||'División')}</strong>${typeof renderSubPocketLinkBadge==='function'?`<small class="quick-subpocket-link">${renderSubPocketLinkBadge(acc,p)}</small>`:''}</div></div><strong class="quick-subpocket-amount">${fmt.format(Number(p.amount||0))}</strong></div>`).join('')}
        </div>
        <div class="quick-subpocket-available"><span>Disponible</span><strong>${fmt.format(available)}</strong></div>`:
        `<div class="sub-pocket-quick-empty"><span>Todavía no hay divisiones</span></div>`;
    return `<div class="subpocket-floating-head"><div><span>DIVISIONES</span><strong>${subPockets.length} ${subPockets.length===1?'división':'divisiones'}</strong></div><span class="subpocket-floating-total">${fmt.format(Number(acc.balance||0))}</span></div>${content}<button type="button" class="subpocket-open-editor" data-id="${acc.id}">✏️ Editar divisiones</button>`;
}

function closeSubPocketAccordion(){
    if(activeSubPocketAccordionCleanup){activeSubPocketAccordionCleanup();activeSubPocketAccordionCleanup=null;}
    const panel=document.querySelector('.subpocket-floating-panel');
    if(panel){panel.classList.remove('show');setTimeout(()=>{if(panel.isConnected)panel.remove();},160);}
    document.querySelectorAll('#accounts .sub-pocket-trigger').forEach(btn=>{if(!btn.classList.contains('fixed-pocket-trigger'))btn.setAttribute('aria-expanded','false');});
    activeSubPocketAccordionId=null;
}

function positionSubPocketAccordion(panel,card){
    if(!panel||!card||!card.isConnected)return;
    const rect=card.getBoundingClientRect(),margin=10,gap=8,width=Math.min(320,window.innerWidth-margin*2),height=panel.offsetHeight||180;
    let left=rect.left,top=rect.bottom+gap;
    if(left+width>window.innerWidth-margin)left=window.innerWidth-width-margin;
    left=Math.max(margin,left);
    if(top+height>window.innerHeight-margin)top=rect.top-height-gap;
    top=Math.max(margin,top);
    panel.style.left=`${Math.round(left)}px`;panel.style.top=`${Math.round(top)}px`;panel.style.width=`${width}px`;
}

function refreshSubPocketAccordion(){
    if(!activeSubPocketAccordionId)return;
    const acc=getCapitalById(activeSubPocketAccordionId),card=getCapitalCardElement(activeSubPocketAccordionId),panel=document.querySelector('.subpocket-floating-panel');
    if(!acc||!card||!panel){closeSubPocketAccordion();return;}
    panel.innerHTML=renderQuickSubPockets(acc);positionSubPocketAccordion(panel,card);
}

function openSubPocketAccordion(acc,card,button){
    closeSubPocketAccordion();activeSubPocketAccordionId=String(acc.id);
    const panel=document.createElement('div');panel.className='subpocket-floating-panel';panel.innerHTML=renderQuickSubPockets(acc);document.body.append(panel);button.setAttribute('aria-expanded','true');
    const reposition=()=>positionSubPocketAccordion(panel,card);
    const outside=ev=>{if(panel.contains(ev.target)||card.contains(ev.target)||ev.target.closest?.('.sub-pocket-trigger'))return;closeSubPocketAccordion();};
    window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);requestAnimationFrame(()=>{reposition();panel.classList.add('show');});setTimeout(()=>document.addEventListener('pointerdown',outside),0);
    activeSubPocketAccordionCleanup=()=>{window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);document.removeEventListener('pointerdown',outside);};
}

document.body.addEventListener('click',e=>{
    const button=e.target.closest('.sub-pocket-trigger');if(!button||button.classList.contains('fixed-pocket-trigger'))return;
    const card=button.closest('.capital-card');const acc=card&&getCapitalById(card.dataset.id);if(!acc)return;
    if(activeSubPocketAccordionId===String(acc.id)){closeSubPocketAccordion();return;}
    openSubPocketAccordion(acc,card,button);
});

document.body.addEventListener('click',e=>{
    const button=e.target.closest('.subpocket-open-editor');if(!button)return;const acc=getCapitalById(button.dataset.id);if(!acc)return;closeSubPocketAccordion();openSubPocketInterface(acc);
});

/* =====================================================
   SORTABLE POINTER — CAPITAL / SUB-BOLSILLOS
===================================================== */

function enablePointerReorder(container,{itemSelector,handleSelector,onCommit}){
    if(!container)return()=>{};
    let active=null,pointerId=null;
    const down=event=>{
        const handle=event.target.closest(handleSelector);if(!handle||!container.contains(handle))return;
        const item=handle.closest(itemSelector);if(!item)return;
        event.preventDefault();active=item;pointerId=event.pointerId;active.classList.add('is-dragging');container.classList.add('is-sorting');handle.setPointerCapture?.(pointerId);
        document.body.classList.add('felios-reordering');
    };
    const move=event=>{
        if(!active||event.pointerId!==pointerId)return;
        event.preventDefault();
        const target=document.elementFromPoint(event.clientX,event.clientY)?.closest(itemSelector);
        if(!target||target===active||target.parentElement!==container)return;
        const rect=target.getBoundingClientRect();
        const before=event.clientY<rect.top+rect.height/2;
        container.insertBefore(active,before?target:target.nextSibling);
    };
    const end=event=>{
        if(!active||event.pointerId!==pointerId)return;
        const item=active;active=null;pointerId=null;item.classList.remove('is-dragging');container.classList.remove('is-sorting');document.body.classList.remove('felios-reordering');
        const ids=Array.from(container.querySelectorAll(itemSelector)).map(el=>String(el.dataset.id||el.dataset.pocketId));
        onCommit?.(ids);
    };
    container.addEventListener('pointerdown',down);window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
    return()=>{container.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};
}

/* =====================================================
   ORGANIZAR CAPITALES
===================================================== */

let capitalOrganizerDraft = null;
let capitalOrganizerSortCleanup = null;

function createCapitalOrganizer(){
    if(document.getElementById('felios-capital-organizer'))return;
    const overlay=document.createElement('div');overlay.id='felios-capital-organizer';overlay.className='capital-organizer-overlay';overlay.innerHTML=`
        <div class="capital-organizer-panel" role="dialog" aria-modal="true">
            <div class="capital-organizer-head"><div><small>CAPITAL</small><h3>Organizar capitales</h3><p>Arrastra para cambiar el orden. Los primeros ${MAX_MAIN_CAPITALS} aparecen en la vista principal.</p></div><button type="button" class="capital-organizer-close">×</button></div>
            <div class="capital-organizer-body">
                <section><div class="capital-organizer-section-head"><strong>Visibles</strong><span class="organizer-visible-count"></span></div><div class="capital-organizer-visible"></div></section>
                <section class="capital-organizer-hidden-section"><div class="capital-organizer-section-head"><strong>Ocultos</strong><span>Selecciona para volver a mostrar</span></div><div class="capital-organizer-hidden"></div></section>
            </div>
            <div class="capital-organizer-footer"><button type="button" class="organizer-cancel">Cancelar</button><button type="button" class="organizer-save">Guardar cambios</button></div>
        </div>`;
    document.body.append(overlay);
    overlay.querySelector('.capital-organizer-close').onclick=closeCapitalOrganizer;
    overlay.querySelector('.organizer-cancel').onclick=closeCapitalOrganizer;
    overlay.querySelector('.organizer-save').onclick=saveCapitalOrganizer;
    overlay.addEventListener('pointerdown',ev=>{if(ev.target===overlay)closeCapitalOrganizer();});
    overlay.addEventListener('click',handleOrganizerClick);
}

function openCapitalOrganizer(){
    normalizeCapitalState();createCapitalOrganizer();
    capitalOrganizerDraft=getOrderedCapitals({includeHidden:true}).map(acc=>({id:String(acc.id),hidden:Boolean(acc.hidden),order:Number(acc.order)}));
    document.body.classList.add('felios-organizer-open');
    const overlay=document.getElementById('felios-capital-organizer');overlay.classList.add('show');renderCapitalOrganizer();
}

function closeCapitalOrganizer(){
    if(capitalOrganizerSortCleanup){capitalOrganizerSortCleanup();capitalOrganizerSortCleanup=null;}
    const overlay=document.getElementById('felios-capital-organizer');if(overlay)overlay.classList.remove('show');
    document.body.classList.remove('felios-organizer-open');capitalOrganizerDraft=null;
}

function getOrganizerDraftAcc(id){return capitalOrganizerDraft?.find(x=>String(x.id)===String(id))||null;}

function draftVisibleOrdered(){return (capitalOrganizerDraft||[]).filter(x=>!x.hidden).sort((a,b)=>a.order-b.order);}
function draftHiddenOrdered(){return (capitalOrganizerDraft||[]).filter(x=>x.hidden).sort((a,b)=>a.order-b.order);}

function normalizeDraftOrders(){
    const all=[...draftVisibleOrdered(),...draftHiddenOrdered()];all.forEach((x,i)=>x.order=i);
}

function renderCapitalOrganizer(){
    const overlay=document.getElementById('felios-capital-organizer');if(!overlay||!capitalOrganizerDraft)return;
    const visible=draftVisibleOrdered(), hidden=draftHiddenOrdered();
    overlay.querySelector('.organizer-visible-count').textContent=`${Math.min(visible.length,MAX_MAIN_CAPITALS)} principales · ${Math.max(0,visible.length-MAX_MAIN_CAPITALS)} en Ver más`;
    const visibleEl=overlay.querySelector('.capital-organizer-visible');
    visibleEl.innerHTML=visible.map((d,i)=>{const acc=getCapitalById(d.id);return acc?`
        <div class="capital-organizer-row" data-id="${acc.id}">
            <button type="button" class="organizer-drag-handle" title="Arrastrar">☰</button>
            <span class="organizer-icon">${escapeHtml(acc.icon||'💰')}</span>
            <div class="organizer-main"><strong>${escapeHtml(acc.name)}</strong><small>${fmt.format(acc.balance)} · ${i<MAX_MAIN_CAPITALS?'Principal':'Ver más'}</small></div>
            <button type="button" class="organizer-hide" data-id="${acc.id}" title="Ocultar">👁️</button>
        </div>`:'';}).join('');
    const hiddenEl=overlay.querySelector('.capital-organizer-hidden');
    hiddenEl.innerHTML=hidden.length?hidden.map(d=>{const acc=getCapitalById(d.id);return acc?`
        <button type="button" class="capital-organizer-row hidden-row organizer-restore" data-id="${acc.id}">
            <span class="organizer-icon">${escapeHtml(acc.icon||'💰')}</span>
            <div class="organizer-main"><strong>${escapeHtml(acc.name)}</strong><small>${fmt.format(acc.balance)} · Oculto</small></div>
            <span class="organizer-restore-label">Mostrar</span>
        </button>`:'';}).join(''):`<div class="organizer-empty">No hay capitales ocultos.</div>`;
    if(capitalOrganizerSortCleanup)capitalOrganizerSortCleanup();
    capitalOrganizerSortCleanup=enablePointerReorder(visibleEl,{itemSelector:'.capital-organizer-row',handleSelector:'.organizer-drag-handle',onCommit:ids=>{ids.forEach((id,i)=>{const d=getOrganizerDraftAcc(id);if(d)d.order=i;});normalizeDraftOrders();renderCapitalOrganizer();}});
}

function handleOrganizerClick(e){
    const hide=e.target.closest('.organizer-hide');
    if(hide){const d=getOrganizerDraftAcc(hide.dataset.id);if(d){d.hidden=true;normalizeDraftOrders();renderCapitalOrganizer();}return;}
    const restore=e.target.closest('.organizer-restore');
    if(restore){
        const d=getOrganizerDraftAcc(restore.dataset.id);if(!d)return;
        const visible=draftVisibleOrdered();
        const insertAt=visible.length>=MAX_MAIN_CAPITALS?MAX_MAIN_CAPITALS-1:visible.length;
        visible.forEach((x,i)=>{if(i>=insertAt)x.order+=1;});
        d.hidden=false;d.order=insertAt;normalizeDraftOrders();renderCapitalOrganizer();
    }
}

function saveCapitalOrganizer(){
    if(!capitalOrganizerDraft)return;
    capitalOrganizerDraft.forEach(d=>{const acc=getCapitalById(d.id);if(acc){acc.hidden=d.hidden;acc.order=d.order;}});
    compactCapitalOrders();
    pushCapitalHistory('edicion','Orden y visibilidad de capitales actualizados');
    closeCapitalOrganizer();renderAccounts();
}

document.body.addEventListener('click',e=>{if(e.target.closest('.capital-organize-button'))openCapitalOrganizer();});

/* =====================================================
   INTERFAZ SUB-BOLSILLOS
===================================================== */

function createSubPocketInterface(){
    if(document.getElementById('felios-subpocket-overlay'))return;
    const overlay=document.createElement('div');overlay.id='felios-subpocket-overlay';overlay.className='felios-subpocket-overlay';overlay.innerHTML=`
        <div class="felios-subpocket-panel" role="dialog" aria-modal="true">
            <div class="subpocket-header"><div><small>DIVISIONES</small><h3 id="subpocket-title">Capital</h3></div><button type="button" class="subpocket-close" id="subpocket-close">×</button></div>
            <div class="subpocket-summary"><div><span>Capital total</span><strong id="subpocket-total">$0</strong></div><div><span>Disponible</span><strong id="subpocket-available">$0</strong></div></div>
            <div class="subpocket-progress"><div id="subpocket-progress-bar"></div></div>
            <div class="subpocket-existing" id="subpocket-existing"></div>
            <div class="subpocket-new">
                <div class="subpocket-section-title"><strong>Nueva división</strong><span>Se descuenta del disponible</span></div>
                <div class="subpocket-fields">
                    <input id="subpocket-icon" type="text" placeholder="◈" maxlength="8" autocomplete="off" aria-label="Emoji de la división">
                    <input id="subpocket-name" type="text" placeholder="Ej. Animales" maxlength="40" autocomplete="off">
                    <input id="subpocket-amount" type="number" min="0" step="100" placeholder="Monto" inputmode="decimal">
                </div>
                <div id="subpocket-feedback" class="subpocket-feedback">Disponible para separar</div>
                <button type="button" id="subpocket-add" class="subpocket-add" disabled>+ Crear división</button>
            </div>
            <div class="subpocket-footer"><button type="button" id="subpocket-done" class="subpocket-done">Listo</button></div>
        </div>`;
    document.body.append(overlay);
    overlay.querySelector('#subpocket-close').onclick=closeSubPocketInterface;
    overlay.querySelector('#subpocket-done').onclick=closeSubPocketInterface;
    overlay.addEventListener('pointerdown',ev=>{if(ev.target===overlay)closeSubPocketInterface();});
    ['subpocket-name','subpocket-amount','subpocket-icon'].forEach(id=>overlay.querySelector(`#${id}`).addEventListener('input',updateSubPocketPreview));
    overlay.querySelector('#subpocket-add').onclick=addSubPocket;
    overlay.querySelector('#subpocket-existing').addEventListener('click',handleExistingSubPocketAction);
}

function openSubPocketInterface(acc){
    if(!acc)return;createSubPocketInterface();activeSubPocketCapitalId=acc.id;document.body.classList.add('felios-subpocket-open');
    document.getElementById('subpocket-title').textContent=`${acc.icon||'💰'} ${acc.name}`;
    document.getElementById('felios-subpocket-overlay').classList.add('show');renderSubPocketInterface();
    setTimeout(()=>document.getElementById('subpocket-name')?.focus(),100);
}

function closeSubPocketInterface(){
    if(subPocketSortCleanup){subPocketSortCleanup();subPocketSortCleanup=null;}
    document.getElementById('felios-subpocket-overlay')?.classList.remove('show');document.body.classList.remove('felios-subpocket-open');activeSubPocketCapitalId=null;
}

function renderSubPocketInterface(){
    const acc=getCapitalById(activeSubPocketCapitalId);if(!acc)return;normalizeCapitalState();
    const total=Number(acc.balance||0),separated=getCapitalSeparated(acc),available=getCapitalAvailable(acc);
    document.getElementById('subpocket-total').textContent=fmt.format(total);document.getElementById('subpocket-available').textContent=fmt.format(available);
    const progress=document.getElementById('subpocket-progress-bar');if(progress)progress.style.width=`${total>0?Math.min(100,separated/total*100):0}%`;
    const existing=document.getElementById('subpocket-existing');const list=getOrderedSubPockets(acc);
    if(!list.length){existing.innerHTML=`<div class="subpocket-empty"><span>Aún no hay divisiones.</span><small>El dinero permanece completamente disponible.</small></div>`;}
    else{
        existing.innerHTML=`
            <div class="subpocket-section-title"><strong>Divisiones actuales</strong><span>${list.length} · arrastra ☰ para ordenar</span></div>
            <div class="subpocket-list">
                ${list.map(p=>`
                    <div class="subpocket-item" data-pocket-id="${p.id}">
                        <button type="button" class="subpocket-drag-handle" title="Arrastrar">☰</button>
                        <div class="subpocket-item-main"><span class="subpocket-item-icon">${escapeHtml(p.icon||'◈')}</span><div><strong>${escapeHtml(p.name||'División')}</strong><small>Dinero separado</small>${typeof renderSubPocketLinkBadge==='function'?renderSubPocketLinkBadge(acc,p):''}</div></div>
                        <div class="subpocket-item-right"><strong>${fmt.format(Number(p.amount||0))}</strong><button type="button" class="subpocket-item-menu" title="Opciones">⋮</button></div>
                        <div class="subpocket-item-actions-drawer">
                            <button type="button" class="subpocket-action-edit">✏️ Editar</button>
                            <button type="button" class="subpocket-action-add">＋ Agregar</button>
                            <button type="button" class="subpocket-action-subtract">− Retirar</button>
                            ${typeof getPocketForLinkedSubPocket==='function'&&getPocketForLinkedSubPocket(acc,p)?'<button type="button" class="subpocket-action-link">🔗 Gestionar vínculo</button>':''}
                            <button type="button" class="subpocket-action-delete">🗑️ Eliminar</button>
                        </div>
                    </div>`).join('')}
            </div>`;
        if(subPocketSortCleanup)subPocketSortCleanup();
        const listEl=existing.querySelector('.subpocket-list');
        subPocketSortCleanup=enablePointerReorder(listEl,{itemSelector:'.subpocket-item',handleSelector:'.subpocket-drag-handle',onCommit:ids=>{
            ids.forEach((id,i)=>{const p=acc.subPockets.find(x=>String(x.id)===String(id));if(p)p.order=i;});
            acc.subPockets.sort((a,b)=>a.order-b.order);pushCapitalHistory('edicion',`Orden de divisiones actualizado en ${acc.name}`);refreshSubPocketAccordion();
        }});
    }
    updateSubPocketPreview();
}

function updateSubPocketPreview(){
    const acc=getCapitalById(activeSubPocketCapitalId);if(!acc)return;
    const nameInput=document.getElementById('subpocket-name'),amountInput=document.getElementById('subpocket-amount'),feedback=document.getElementById('subpocket-feedback'),add=document.getElementById('subpocket-add');
    if(!nameInput||!amountInput||!feedback||!add)return;
    const name=nameInput.value.trim(),amount=Number(amountInput.value),total=Number(acc.balance||0),available=getCapitalAvailable(acc);
    const validAmount=Number.isFinite(amount)&&amount>0&&amount<=available;
    const previewAvailable=validAmount?available-amount:available;
    document.getElementById('subpocket-total').textContent=fmt.format(total);document.getElementById('subpocket-available').textContent=fmt.format(Math.max(0,previewAvailable));
    const progress=document.getElementById('subpocket-progress-bar');if(progress){const previewSeparated=getCapitalSeparated(acc)+(validAmount?amount:0);progress.style.width=`${total>0?Math.min(100,previewSeparated/total*100):0}%`;}
    let valid=true,message=`Disponible para separar: ${fmt.format(available)}`;
    if(!name&&!amount){valid=false;} else if(!name){valid=false;message='Escribe el nombre de la división.';} else if(!Number.isFinite(amount)||amount<=0){valid=false;message='Introduce un monto mayor que 0.';} else if(amount>available){valid=false;message=`⚠️ Solo puedes separar ${fmt.format(available)}.`;} else message=`✓ Después de crearla quedarán ${fmt.format(available-amount)} disponibles.`;
    feedback.textContent=message;feedback.classList.toggle('error',!valid);feedback.classList.toggle('valid',valid&&!!name&&amount>0);add.disabled=!(valid&&name&&amount>0);
}

function addSubPocket(){
    const acc=getCapitalById(activeSubPocketCapitalId);if(!acc)return;
    const nameInput=document.getElementById('subpocket-name'),amountInput=document.getElementById('subpocket-amount'),iconInput=document.getElementById('subpocket-icon');if(!nameInput||!amountInput||!iconInput)return;
    const name=nameInput.value.trim(),amount=Number(amountInput.value),icon=iconInput.value.trim()||'◈',available=getCapitalAvailable(acc);
    if(!name)return showToast('Escribe el nombre de la división.','var(--danger)');if(!Number.isFinite(amount)||amount<=0)return showToast('Introduce un monto válido.','var(--danger)');if(amount>available)return showToast(`No puedes separar más de ${fmt.format(available)}.`,'var(--danger)');
    if(acc.subPockets.some(p=>String(p.name).trim().toLowerCase()===name.toLowerCase()))return showToast('Ya existe una división con ese nombre.','var(--danger)');
    acc.subPockets.push({id:Date.now()+Math.floor(Math.random()*1000),name,icon,amount,order:acc.subPockets.length});
    pushCapitalHistory('suma',`División creada en ${acc.name}: ${name} ${fmt.format(amount)}`);
    nameInput.value='';iconInput.value='';amountInput.value='';renderSubPocketInterface();renderAccounts();refreshAllExceptAccounts();
}

function openSubPocketMoneyEditor(acc,pocket,mode='edit'){
    document.querySelectorAll('.subpocket-money-overlay').forEach(el=>el.remove());
    const available=getCapitalAvailable(acc),oldAmount=Number(pocket.amount||0);
    const linkedPocket=typeof getPocketForLinkedSubPocket==='function'?getPocketForLinkedSubPocket(acc,pocket):null;
    const overlay=document.createElement('div');overlay.className='subpocket-money-overlay';
    const isEdit=mode==='edit',isAdd=mode==='add',isSubtract=mode==='subtract';
    overlay.innerHTML=`
        <div class="subpocket-money-card" role="dialog" aria-modal="true">
            <div class="subpocket-money-head"><div><small>${isEdit?'EDITAR DIVISIÓN':isAdd?'AGREGAR DINERO':'RETIRAR DINERO'}</small><h4>${escapeHtml(pocket.icon||'◈')} ${escapeHtml(pocket.name)}</h4></div><button type="button" class="subpocket-money-close">×</button></div>
            ${isEdit?`<div class="subpocket-edit-meta"><input class="subpocket-edit-icon" value="${escapeHtml(pocket.icon||'◈')}" maxlength="8"><input class="subpocket-edit-name" value="${escapeHtml(pocket.name)}" maxlength="40"></div>`:''}
            ${linkedPocket?`<div class="subpocket-linked-note">🔗 Vinculado con ${escapeHtml(linkedPocket.icon||'🐷')} <b>${escapeHtml(linkedPocket.name)}</b>. Si cambias el monto, su saldo se actualizará también.</div>`:''}
            <label>${isEdit?'Nuevo monto':isAdd?'Monto a agregar':'Monto a retirar'}</label>
            <input type="number" class="subpocket-money-input" min="0" step="100" value="${isEdit?oldAmount:''}" placeholder="0">
            <div class="subpocket-money-preview"></div>
            <div class="subpocket-money-actions"><button type="button" class="subpocket-money-cancel">Cancelar</button><button type="button" class="subpocket-money-save">Confirmar</button></div>
        </div>`;
    document.body.append(overlay);requestAnimationFrame(()=>overlay.classList.add('show'));
    const input=overlay.querySelector('.subpocket-money-input'),preview=overlay.querySelector('.subpocket-money-preview'),save=overlay.querySelector('.subpocket-money-save');
    const update=()=>{
        const value=Number(input.value);let newAmount=oldAmount,valid=Number.isFinite(value)&&value>=0;
        if(isEdit)newAmount=value;else if(isAdd)newAmount=oldAmount+value;else newAmount=oldAmount-value;
        if(isEdit)valid=valid&&value>0&&value<=oldAmount+available;
        if(isAdd)valid=valid&&value>0&&value<=available;
        if(isSubtract)valid=valid&&value>0&&value<=oldAmount;
        const availableAfter=available+oldAmount-newAmount;
        preview.className=`subpocket-money-preview ${valid?'valid':'error'}`;
        preview.innerHTML=valid?`Nuevo monto: <strong>${fmt.format(newAmount)}</strong><br>Disponible después: <strong>${fmt.format(availableAfter)}</strong>`:(isAdd?`Máximo disponible: <strong>${fmt.format(available)}</strong>`:isSubtract?`Máximo a retirar: <strong>${fmt.format(oldAmount)}</strong>`:`Máximo permitido: <strong>${fmt.format(oldAmount+available)}</strong>`);
        save.disabled=!valid;
    };
    input.addEventListener('input',update);update();
    const close=()=>{overlay.classList.remove('show');setTimeout(()=>overlay.remove(),160);};overlay.querySelector('.subpocket-money-close').onclick=close;overlay.querySelector('.subpocket-money-cancel').onclick=close;overlay.addEventListener('pointerdown',ev=>{if(ev.target===overlay)close();});
    save.onclick=async()=>{
        const value=Number(input.value);let newAmount=oldAmount;if(isEdit)newAmount=value;else if(isAdd)newAmount=oldAmount+value;else newAmount=oldAmount-value;
        if(linkedPocket&&Math.abs(newAmount-oldAmount)>.005){
            const ok=await feliosConfirm({title:'División vinculada',message:`${pocket.name} está vinculada con ${linkedPocket.name}. El saldo del bolsillo también cambiará de ${fmt.format(linkedPocket.balance)} a ${fmt.format(newAmount)}.`,confirmText:'Actualizar ambos'});if(!ok)return;
        }
        if(isEdit){const newName=overlay.querySelector('.subpocket-edit-name').value.trim();const newIcon=overlay.querySelector('.subpocket-edit-icon').value.trim()||'◈';if(!newName)return showToast('La división necesita un nombre.','var(--danger)');pocket.name=newName;pocket.icon=newIcon;}
        const old=oldAmount;pocket.amount=newAmount;
        if(linkedPocket&&typeof syncPocketFromLinkedSubPocket==='function')syncPocketFromLinkedSubPocket(acc,pocket,{reason:`Cambio desde ${acc.name} · ${pocket.name}`,recordLocal:true});
        pushCapitalHistory(isAdd?'suma':isSubtract?'resta':'edicion',`${acc.name} · ${pocket.name}: ${fmt.format(old)} → ${fmt.format(newAmount)}`);
        if(linkedPocket&&typeof annotateLatestHistoryWithPocketLink==='function')annotateLatestHistoryWithPocketLink(linkedPocket,{initiator:'capital',synced:true,pendingDelta:0});
        close();renderSubPocketInterface();renderAccounts();refreshAllExceptAccounts();refreshSubPocketAccordion();if(typeof renderPockets==='function')renderPockets();
    };
    setTimeout(()=>{input.focus();if(isEdit)input.select();},80);
}

async function handleExistingSubPocketAction(e){
    const row=e.target.closest('.subpocket-item');if(!row)return;const acc=getCapitalById(activeSubPocketCapitalId);if(!acc)return;const pocket=acc.subPockets.find(p=>String(p.id)===String(row.dataset.pocketId));if(!pocket)return;
    if(e.target.closest('.subpocket-item-menu')){row.classList.toggle('actions-open');document.querySelectorAll('.subpocket-item.actions-open').forEach(other=>{if(other!==row)other.classList.remove('actions-open');});return;}
    if(e.target.closest('.subpocket-action-edit'))return openSubPocketMoneyEditor(acc,pocket,'edit');
    if(e.target.closest('.subpocket-action-add'))return openSubPocketMoneyEditor(acc,pocket,'add');
    if(e.target.closest('.subpocket-action-subtract'))return openSubPocketMoneyEditor(acc,pocket,'subtract');
    if(e.target.closest('.subpocket-action-link')){const linked=typeof getPocketForLinkedSubPocket==='function'?getPocketForLinkedSubPocket(acc,pocket):null;if(linked&&typeof openPocketCapitalLinkModal==='function')return openPocketCapitalLinkModal(linked);}
    if(e.target.closest('.subpocket-action-delete')){
        const linked=typeof getPocketForLinkedSubPocket==='function'?getPocketForLinkedSubPocket(acc,pocket):null;
        const message=linked?`${pocket.name} está vinculada con ${linked.name}. Al eliminarla, ${linked.name} conservará su saldo y quedará desvinculado. El dinero de la división volverá a Disponible.`:`¿Eliminar ${pocket.name}? El dinero volverá a Disponible.`;
        const ok=await feliosConfirm({title:linked?'Eliminar división vinculada':'Eliminar división',message,confirmText:'Eliminar',danger:true});if(!ok)return;
        if(linked&&typeof detachLinkForSubPocket==='function')detachLinkForSubPocket(acc,pocket,{record:true});
        acc.subPockets=acc.subPockets.filter(p=>String(p.id)!==String(pocket.id));acc.subPockets.forEach((p,i)=>p.order=i);pushCapitalHistory('edicion',`División eliminada de ${acc.name}: ${pocket.name}`);renderSubPocketInterface();renderAccounts();refreshAllExceptAccounts();refreshSubPocketAccordion();if(typeof renderPockets==='function')renderPockets();
    }
}

function refreshAllExceptAccounts(){
    if(typeof calcAndRenderTotals==='function')calcAndRenderTotals();
    if(typeof renderHistory==='function')renderHistory();
}

/* =====================================================
   BOLSILLO FIJO
===================================================== */

document.body.addEventListener('click',e=>{
    const button=e.target.closest('.fixed-pocket-trigger');if(!button)return;
    document.getElementById('pockets')?.scrollIntoView({behavior:'smooth',block:'start'});
});

/* =====================================================
   CIERRES / ESC
===================================================== */

document.addEventListener('click',e=>{
    if(e.target.closest('.capital-menu')||e.target.closest('.capital-actions-menu'))return;
    closeCapitalActionsMenus();
});

document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(document.getElementById('felios-subpocket-overlay')?.classList.contains('show')){closeSubPocketInterface();return;}
    if(document.getElementById('felios-capital-organizer')?.classList.contains('show')){closeCapitalOrganizer();return;}
    closeCapitalActionsMenus();closeSubPocketAccordion();
});

window.renderAccounts=renderAccounts;
window.getCapitalById=getCapitalById;
window.getCapitalSeparated=getCapitalSeparated;
window.getCapitalAvailable=getCapitalAvailable;
window.openSubPocketInterface=openSubPocketInterface;
window.closeSubPocketInterface=closeSubPocketInterface;
