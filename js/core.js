/* =====================================================
   FELIOS ECONOMY

   CORE ENGINE

   Funciones:
   - Formatos
   - IDs
   - Cálculos globales
   - Validaciones
   - Refresh general

===================================================== */



// =====================================================
// FORMATO MONEDA
// =====================================================


const fmt = new Intl.NumberFormat(
    'es-CO',
    {
        style:'currency',
        currency:'COP',
        minimumFractionDigits:2
    }
);





// =====================================================
// TOAST GLOBAL
// =====================================================


const showToast = (
    text,
    bg = 'var(--success)'
)=>{


    Toastify({

        text,

        duration:3000,


        gravity:"top",

        position:"right",


        style:{

            background:bg

        }


    }).showToast();


};






// =====================================================
// GENERADOR ID
// =====================================================


const genId = arr => {


    if(!arr.length)
        return 1;



    return Math.max(
        ...arr.map(
            item=>item.id
        )
    ) + 1;


};







// =====================================================
// ESTADO GLOBAL COMPATIBILIDAD
// =====================================================
//
// Mientras migramos módulos antiguos
// mantenemos referencias.
//
// =====================================================



let lastSalaryAdded = 0;







// =====================================================
// CÁLCULOS NUEVO MODELO
// =====================================================



// Total dinero en capital


function getCapitalTotal(){


    if(!window.capital)
        return 0;



    return capital.reduce(

        (sum,c)=>

        sum +
        Number(c.balance || 0),

        0

    );


}






// Total ahorro


function getSavingTotal(){


    if(!window.saving)
        return 0;



    return Number(
        saving.total || 0
    );


}






// Total categorías distribución


function getCategoriesTotal(){


    if(!window.categories)
        return 0;



    return categories.reduce(

        (sum,c)=>

        sum +
        Number(c.total || 0),

        0

    );


}







// Patrimonio estimado


function getPatrimony(){


    return {


        capital:

            getCapitalTotal(),


        ahorro:

            getSavingTotal(),


        distribucion:

            getCategoriesTotal(),



        total:

            getCapitalTotal()
            +
            getSavingTotal()


    };


}







// =====================================================
// VALIDACIÓN PORCENTAJES
// =====================================================


function validatePercentages(){


    if(!window.incomeConfig)
        return false;



    const total =


        Number(
            incomeConfig.savingPercent
        )


        +

        Number(
            incomeConfig.distributionPercent
        );



    return total <= 100;



}






// Ajustar porcentajes


function updateIncomePercent(
    savingPercent
){



    const savingValue =
        Number(
            savingPercent
        );



    const distribution =
        100 - savingValue;



    if(
        savingValue < 0 ||
        savingValue > 100
    ){


        showToast(
            "El porcentaje debe estar entre 0 y 100",
            "var(--danger)"
        );


        return false;


    }



    incomeConfig.savingPercent =
        savingValue;



    incomeConfig.distributionPercent =
        distribution;



    return true;


}







// =====================================================
// COMPATIBILIDAD SISTEMA ANTIGUO
// =====================================================



function getAccountsTotal(){


    if(!window.accounts)
        return 0;



    return accounts.reduce(

        (sum,a)=>

        sum +
        Number(a.balance || 0),

        0

    );


}






function getDebtsTotal(){


    return debts.reduce(

        (sum,d)=>

        sum +
        Number(d.amount || 0),

        0

    );


}






function getCreditsTotal(){


    return credits.reduce(

        (sum,c)=>

        sum +
        Number(c.amount || 0),

        0

    );


}








// =====================================================
// REFRESH GENERAL
// =====================================================



function refreshAll(){

    if(typeof repairPocketCapitalLinks === 'function'){
        repairPocketCapitalLinks({silent:true});
    }

    if(
        typeof renderAccounts === "function"
    ){

        renderAccounts();

    }




    if(
        typeof renderList === "function"
    ){

        renderList('debt');

        renderList('credit');

    }




    if(
        typeof calcAndRenderTotals === "function"
    ){

        calcAndRenderTotals();

    }




    if(
        typeof renderPockets === "function"
    ){

        renderPockets();

    }




    if(
        typeof renderHistory === "function"
    ){

        renderHistory();

    }


    if(
        typeof renderFinancialDashboard === "function"
    ){

        renderFinancialDashboard();

    }


}





// =====================================================
// INICIALIZACIÓN
// =====================================================


window.addEventListener(
'DOMContentLoaded',
()=>{


    refreshAll();


});






// =====================================================
// EXPORTAR FUNCIONES
// =====================================================


window.feliosCore = {


    getCapitalTotal,

    getSavingTotal,

    getCategoriesTotal,

    getPatrimony,

    validatePercentages,

    updateIncomePercent,

    getAccountsTotal,

    getDebtsTotal,

    getCreditsTotal


};