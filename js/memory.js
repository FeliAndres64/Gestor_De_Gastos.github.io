/* =====================================================
   FELIOS ECONOMY

   MEMORY SYSTEM

   Guarda evolución financiera durante la sesión.

   IMPORTANTE:
   - NO usa localStorage
   - NO guarda permanentemente
   - Se exporta mediante JSON
   - Se recupera mediante importación

===================================================== */


const FELIOS_MEMORY = (()=>{


    /*
        Estructura:

        snapshots:[
            {
                id,
                date,
                reason,

                totals:{},

                accounts:[],
                pockets:[],
                debts:{}

            }
        ]

    */


    let snapshots = [];





    // ==========================================
    // Crear snapshot
    // ==========================================


    function createSnapshot(reason="manual"){


        const snapshot = {


            id:
                Date.now(),



            date:
                new Date().toISOString(),



            reason,



            totals:
                getTotals(),



            accounts:
                getAccounts(),



            pockets:
                getPockets(),



            debts:
                getDebts()


        };



        snapshots.push(snapshot);



        return snapshot;


    }







    // ==========================================
    // Obtener totales actuales
    // ==========================================


    function getTotals(){


        let totalAccounts = 0;


        if(window.accounts){


            totalAccounts =
                accounts.reduce(
                    (sum,a)=>
                    sum + Number(a.balance || 0),
                    0
                );


        }



        let totalPockets = 0;


        if(window.pockets){


            totalPockets =
                pockets.reduce(
                    (sum,p)=>
                    sum + Number(p.balance ?? p.total ?? 0),
                    0
                );


        }



        return {


            accounts:
                totalAccounts,


            pockets:
                totalPockets,


            patrimony:
                totalAccounts + totalPockets


        };


    }







    // ==========================================
    // Copiar cuentas
    // ==========================================


    function getAccounts(){


        if(!window.accounts)
            return [];



        return accounts.map(a=>({


            id:a.id,

            name:a.name,

            balance:
                Number(a.balance || 0)


        }));


    }







    // ==========================================
    // Copiar bolsillos
    // ==========================================


    function getPockets(){


        if(!window.pockets)
            return [];



        return pockets.map(p=>({


            id:p.id,


            name:p.name,


            total:
                Number(p.balance ?? p.total ?? 0)


        }));


    }







    // ==========================================
    // Copiar deudas
    // ==========================================


    function getDebts(){


        return {


            owe:
                window.debts
                ?
                debts.length
                :
                0,



            receive:
                window.credits
                ?
                credits.length
                :
                0


        };


    }







    // ==========================================
    // Obtener todos
    // ==========================================


    function getSnapshots(){


        return snapshots;


    }







    // ==========================================
    // Último snapshot
    // ==========================================


    function getLast(){


        return snapshots.length
        ?
        snapshots[snapshots.length-1]
        :
        null;


    }







    // ==========================================
    // Importar memoria
    // ==========================================


    function load(data){


        if(!Array.isArray(data))
            return;



        snapshots = data;


    }







    // ==========================================
    // Exportar memoria
    // ==========================================


    function exportData(){


        return snapshots;


    }







    // ==========================================
    // Limpiar
    // ==========================================


    function clear(){


        snapshots=[];


    }







    return {


        createSnapshot,

        getSnapshots,

        getLast,

        load,

        exportData,

        clear


    };



})();



window.FELIOS_MEMORY = FELIOS_MEMORY;