/* =====================================================
   FELIOS ECONOMY — TOTALES GENERALES v2
   Capital libre · Patrimonio neto · Patrimonio total
   Evita duplicar Bolsillos vinculados a un Capital.
===================================================== */
function feliosOutstanding(list){
    return (Array.isArray(list)?list:[]).reduce((sum,group)=>{
        if(Array.isArray(group?.entries)){
            return sum+group.entries.reduce((s,entry)=>s+Math.max(0,Number(entry?.remaining ?? entry?.amount ?? 0)),0);
        }
        return sum+Math.max(0,Number(group?.total ?? group?.amount ?? 0));
    },0);
}

function feliosPocketAssetValue(p){
    const balance=Math.max(0,Number(p?.balance ?? p?.total ?? 0));
    const reserved=(Array.isArray(p?.desires)?p.desires:[]).reduce((s,d)=>s+Math.max(0,Number(d?.reserved||0)),0);
    return balance+reserved;
}

function calcAndRenderTotals(){
    const sumD=feliosOutstanding(window.debts||debts);
    const sumC=feliosOutstanding(window.credits||credits);
    const capitalTotal=(window.capital||capital||[]).reduce((sum,c)=>sum+Math.max(0,Number(c?.balance||0)),0);
    const savingBalance=Math.max(0,Number(window.pocketSystem?.saving?.balance||0));

    // Un bolsillo vinculado ya está físicamente representado dentro del Capital.
    // Solo los bolsillos independientes se agregan al patrimonio total.
    const independentPocketAssets=(window.pockets||pockets||[]).reduce((sum,p)=>{
        const linked=typeof getPocketCapitalPair==='function' && !!getPocketCapitalPair(p);
        return sum+(linked?0:feliosPocketAssetValue(p));
    },0);

    const capitalLibre=capitalTotal;
    const patrimonioNeto=capitalLibre+savingBalance+sumC-sumD;
    const patrimonioTotal=patrimonioNeto+independentPocketAssets;

    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.innerText=fmt.format(value);};
    set('sum-deudas',sumD);
    set('sum-credits',sumC);
    set('total-sin-p',capitalLibre);
    set('total-deseado',patrimonioNeto);
    set('total-real',patrimonioTotal);
}
