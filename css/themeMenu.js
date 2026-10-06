/* =====================================================
   FELIOS ECONOMY
   THEME MENU
===================================================== */


const FELIOS_THEME_MENU = (()=>{


    let menu = null;


    let outsideActive = false;



    function create(){


        if(menu)
            return;


        menu = document.createElement("div");

        menu.id = "felios-theme-menu";

        menu.className = "theme-menu";


        document.body.appendChild(menu);


        render();


    }








    function render(){


        if(!menu)
            return;



        const current =
            FELIOS_THEME.getConfig();



        const mode =
            current.mode === "dark"
            ?
            "dark"
            :
            "light";




        menu.innerHTML = `


        <div class="theme-header">

            <h3>
                🎨 Temas FeliOS
            </h3>

        </div>




        <div class="theme-list">


        ${
            Object.entries(FELIOS_THEMES)

            .map(([id,t])=>{


                const preview =
                    t[mode] || t.light;



                return `


                <div

                class="
                    theme-item
                    ${current.theme===id ? "active" : ""}
                "

                data-theme="${id}"

                style="
                    --theme-color:${preview.border};
                    --theme-bg:${preview.bg};
                "

                >



                    <div class="theme-icon">

                        ${t.icon}

                    </div>




                    <div class="theme-info">


                        <strong>

                            ${t.name}

                        </strong>




                        <p>

                        ${
                            current.theme===id

                            ?

                            "🎨 Tema actual"

                            :

                            t.description

                        }

                        </p>



                    </div>



                </div>


                `;


            }).join("")

        }


        </div>


        `;



        bind();


    }









    function bind(){


        menu
        .querySelectorAll(".theme-item")

        .forEach(item=>{


            item.onclick = (e)=>{


                e.stopPropagation();



                const theme =
                    item.dataset.theme;



                FELIOS_THEME.setTheme(theme);



                render();



            };


        });



    }









    function open(){


        create();


        render();


        menu.classList.add("show");



        if(!outsideActive){


            setTimeout(()=>{


                document.addEventListener(
                    "click",
                    outside
                );


                outsideActive=true;



            },50);


        }


    }










    function close(){


        if(!menu)
            return;



        menu.classList.remove("show");



        document.removeEventListener(
            "click",
            outside
        );



        outsideActive=false;



    }









    function outside(e){


        const btn =
            document.getElementById(
                "themes-button"
            );




        if(

            menu.contains(e.target)

            ||

            btn?.contains(e.target)

        )

            return;




        close();


    }









    return {


        open,

        close


    };



})();









document.addEventListener(
"DOMContentLoaded",
()=>{


    const btn =
        document.getElementById(
            "themes-button"
        );



    if(!btn){

        console.warn(
            "No existe themes-button"
        );

        return;

    }






    btn.addEventListener(
        "click",
        (e)=>{


            e.preventDefault();

            e.stopPropagation();



            FELIOS_THEME_MENU.open();



        }

    );



});