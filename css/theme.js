/* =====================================================
   FELIOS ECONOMY
   THEME ENGINE

   Controla:
   - Tema
   - Modo claro/oscuro
   - Guardado local
===================================================== */


const FELIOS_THEME = (()=>{


    const STORAGE = "felios-theme-config";


    let config = {


        theme:"home",

        mode:"light"


    };





    function save(){


        localStorage.setItem(

            STORAGE,

            JSON.stringify(config)

        );


    }





    function load(){


        const saved =
            localStorage.getItem(STORAGE);



        if(saved){


            try{


                config =
                    JSON.parse(saved);


            }

            catch{


                console.warn(
                    "Configuración de tema inválida"
                );


            }


        }



        apply();


    }







    function apply(){



        const root =
            document.documentElement;



        root.dataset.theme =
            config.theme;



        root.dataset.mode =
            config.mode;



        updateIcon();


    }







    function updateIcon(){



        const icon =
            document.getElementById(
                "theme-icon"
            );


        if(!icon)
            return;



        icon.textContent =
            config.mode==="dark"
            ?
            "☀️"
            :
            "🌙";


    }









    function setTheme(id){



        if(
            !window.FELIOS_THEMES ||
            !FELIOS_THEMES[id]
        )
            return;



        config.theme=id;


        save();


        apply();


    }







    function toggleMode(){



        config.mode =

            config.mode==="dark"

            ?

            "light"

            :

            "dark";



        save();


        apply();


    }






    function getConfig(){


        return config;


    }






    return {


        load,

        setTheme,

        toggleMode,

        getConfig


    };


})();


document.addEventListener(
    "DOMContentLoaded",
    ()=>{


        const modeBtn =
            document.getElementById(
                "mode-toggle"
            );


        if(modeBtn){


            modeBtn.addEventListener(
                "click",
                ()=>{


                    FELIOS_THEME.toggleMode();


                }
            );


        }


    }
);
window.FELIOS_THEME = FELIOS_THEME;