sap.ui.define(["sap/ui/core/format/DateFormat"], function (DateFormat) {
    "use strict";

    return {
        formatDate: function (dateString) {
            if (!dateString) return;

            let sLanguage = sap.ui.getCore().getConfiguration().getLanguage();
            let date = new Date(dateString);
            let options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
            let finalDate = date.toLocaleDateString(sLanguage, options);
            //console.log(finalDate);
            return finalDate;
        },


        formatTime: function (sDateString) {
            if (!sDateString) return;

            // let sYear = sDateString.substring(0, 4);
            // let sMonth = sDateString.substring(4, 6) - 1; // Mes empieza en 0 en JS
            // let sDay = sDateString.substring(6, 8);
            // let sHour = sDateString.substring(8, 10);
            // let sMinute = sDateString.substring(10, 12);
            // let sSecond = sDateString.substring(12, 14);




            //let oDate = new Date(sYear, sMonth, sDay, sHour, sMinute, sSecond);
            // let oTimeFormat = DateFormat.getTimeInstance({
            //     pattern: "HH:mm"
            // });

            //return oTimeFormat.format(oDate);

            // if (sDateString === '0') {
            //     var sReturnHora = '24:00';
            // } else {
            //     var oDate = new Date(sDateString.replace(
            //         /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,
            //         '$4:$5:$6 $2/$3/$1'
            //     ));

            //     var sHora = oDate.getHours() + 2;

            //     sReturnHora = sHora + ':' + sDateString.substring(10, 12);
            // }

            var sReturnHora = sDateString.substr(0,2)
                          + ':' 
                          + sDateString.substr(2,2)
                          + ':' 
                          + sDateString.substr(4,2);

            return sReturnHora;
        },
    };
});
