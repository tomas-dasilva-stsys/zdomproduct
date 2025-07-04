sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/resource/ResourceModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    'sap/ui/model/FilterOperator',
    'sap/ui/model/Filter',
],
    function (Controller, UIComponent, JSONModel, ResourceModel, MessageToast,
        MessageBox, FilterOperator, Filter) {
        "use strict";
        //Deploy Automatico
        var oResourceBundle;

        return Controller.extend("production.controller.Main", {
            onInit: function () {
                var oModelJson = new JSONModel(this.getInitialWout());
                this.getView().setModel(oModelJson, "MainJSON");

                var oViewJson = new JSONModel(this.getInitButton());
                this.getView().setModel(oViewJson, "ViewJSON");

                let i18nModel = this.getOwnerComponent().getModel("i18n");
                this.getView().setModel(i18nModel, "i18n")
                oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

                this.getLine();
            },

            getRead: function (sPath) {
                return new Promise(function (resolve, reject) {
                    this.getView().getModel().read(sPath, {
                        success: resolve,
                        error: reject
                    });
                }.bind(this));
            },

            getReadFilter: function (sPath, aFilter) {
                return new Promise(function (resolve, reject) {
                    this.getOwnerComponent().getModel().read(sPath, {
                        filters: aFilter,
                        success: resolve,
                        error: reject
                    });
                }.bind(this));
            },

            getLine: function () {
                var sPath = "/Operario";
                //comentar en Deploy
                //this.getView().getModel().setHeaders({ 'sap-client': '130' });
                //this.getView().setHeaders({ 'sap-client': '130' });
                this.getReadFilter(sPath).then(function (oData) {

                    if (oData.results.length > 0) {
                        var aSelect = [];
                        var lv_linea = false;
                        var oModel;
                        var sMulti = false;
                        for (var i = 0; i < oData.results.length; i++) {
                            if (i == 0) {
                                var sNewLine = true;
                            } else if (oData.results[i - 1].atnam == oData.results[i].atnam &&
                                oData.results[i - 1].atwrt == oData.results[i].atwrt
                            ) {
                                sNewLine = false;
                            } else {
                                sNewLine = true;
                            }
                            if (oData.results[i].atnam === "ZPP_DECLARATION_LINE"
                                && sNewLine == true) {
                                var lv_linea = true;
                                oModel = $.extend(true, {}, this.getSelect());
                                oModel.WorkCenter = oData.results[i].atwrt;
                                oModel.Position = oData.results[i].atwrt;
                                oModel.ktext = oData.results[i].ktext;
                                aSelect.push($.extend(true, {}, oModel));
                                sMulti = true;
                            } else if (oData.results[i].atnam === "ZPP_SCREEN_TYPE"
                                && sNewLine == true && sMulti == false) {
                                var lv_linea = true;
                                oModel = $.extend(true, {}, this.getSelect());
                                oModel.WorkCenter = oData.results[i].WorkCenter;
                                oModel.Position = oData.results[i].atwrt;
                                oModel.ktext = oData.results[i].ktext;
                                aSelect.push($.extend(true, {}, oModel));
                                this.getView().getModel("MainJSON").setProperty('/atwrt', oData.results[i].atwrt);
                            }
                        }

                        if (lv_linea == false) {
                            oModel = $.extend(true, {}, this.getSelect());
                            oModel.WorkCenter = oData.results[0].WorkCenter;
                            oModel.Position = oData.results[0].WorkCenter;
                            oModel.ktext = oData.results[0].ktext;
                            aSelect.push($.extend(true, {}, oModel));
                            this.getView().getModel("MainJSON").setProperty('/atwrt', oData.results[0].atwrt);
                        }

                        this.getView().getModel("MainJSON").setProperty('/cuobj', oData.results[0].cuobj);
                        this.getView().getModel("MainJSON").setProperty('/Plant', oData.results[0].Plant);
                        this.getView().getModel("MainJSON").setProperty('/WorkCenter', oData.results[0].WorkCenter);
                        this.getView().getModel("MainJSON").setProperty('/ktext', oData.results[0].ktext);
                        this.getView().getModel("MainJSON").setProperty('/SelectLinea', aSelect);
                    } else {
                        let oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                        let errorNotWorker = oResourceBundle.getText("textErrorOperario");
                        var sMensaje = (errorNotWorker);
                        var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                        MessageBox.error(sMensaje, {
                            styleClass: bCompact ? "sapUiSizeCompact" : ""
                        });
                    };
                }.bind(this)).catch((oError) => {

                });
            },

            onOperario: function (oEvent) {
                this.getView().getModel("ViewJSON").setProperty('/LoginBtnEnabled', false);
                var sPlant = this.getView().getModel("MainJSON").getProperty('/Plant')
                var vOperario = oEvent.getSource().getValue();
                var aFilters = [];
                var sPath = "/CheckPernr";

                if (sPlant == 'PT10') {
                    aFilters.push(new Filter("empl_code2", FilterOperator.EQ, vOperario));
                } else {
                    aFilters.push(new Filter("empl_code", FilterOperator.EQ, vOperario));
                }

                //var sPathEntity = "/CheckPernr('" + vOperario + "')";
                //this.getRead(sPathEntity).then(function (oData) {
                //this.getReadFilter(sPath, aFilters).then(function (oData) {
                this.getReadFilter(sPath, aFilters).then(function (oData) {
                    if (oData.results.length > 0) {
                        this.getView().getModel("ViewJSON").setProperty('/LoginBtnEnabled', true);
                    } else {
                        let oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                        let errorNotWorker = oResourceBundle.getText("textErrorWorkerNotFound");
                        var sMensaje = (errorNotWorker);
                        var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                        MessageBox.warning(sMensaje, {
                            styleClass: bCompact ? "sapUiSizeCompact" : ""
                        });
                    }
                }.bind(this)).catch((oError) => {
                    let oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                    let errorNotWorker = oResourceBundle.getText("textErrorWorkerNotFound");
                    var sMensaje = (errorNotWorker);
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    MessageBox.warning(sMensaje, {
                        styleClass: bCompact ? "sapUiSizeCompact" : ""
                    });
                });
            },

            evetNav: function (sLinea) {
                var sNav;
                if (sLinea.Plant == '') {
                    sMensaje = oResourceBundle.getText("textMessageMainPlant"); //'No tiene centro asignado';
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    MessageBox.warning(sMensaje, {
                        styleClass: bCompact ? "sapUiSizeCompact" : ""
                    });
                } else if (sLinea.WorkCenter == '') {
                    var sMensaje = oResourceBundle.getText("textMessageMainWorkCenter"); //'No hay linea asignada';
                    bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    MessageBox.warning(sMensaje, {
                        styleClass: bCompact ? "sapUiSizeCompact" : ""
                    });
                } else if (sLinea.atwrt == '') {
                    var sMensaje = oResourceBundle.getText("textMessageMainAtwrt"); //'Valor de pantalla de la línea en blanco';
                    bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    MessageBox.warning(sMensaje, {
                        styleClass: bCompact ? "sapUiSizeCompact" : ""
                    });
                } else {
                    switch (sLinea.atwrt) {
                        case "01": //Sin RFID
                            sNav = "RouteCSRfid";
                            break;
                        case '02': //RFID
                            sNav = "RouteCSRfid";
                            break;
                        case '03': //HORNOS
                            sNav = "RouteOvens";
                            break;
                        case '04': //Prototipos
                            sNav = "RouteProtos";
                            break;
                    }
                    const oRouter = UIComponent.getRouterFor(this);

                    let sktext = sLinea.ktext.replace('/', '+');
                    sLinea.ktext = sktext;

                    oRouter.navTo(sNav, {
                        Operario: sLinea.Operario,
                        Plant: sLinea.Plant,
                        WorkCenter: sLinea.WorkCenter,
                        ktext: sLinea.ktext,
                    });
                }
            },

            onLoginPress: function (oEvent) {

                var oSelect = this.getView().byId('id_SelectLinea');
                var aSelect = this.getView().getModel("MainJSON").getProperty('/SelectLinea');
                var sLinea = this.getView().getModel("MainJSON").getProperty("/");

                if (aSelect.length == 1) {
                    this.evetNav(sLinea);
                } else {
                    var sPath = '/MultiOperario';
                    let aFilters = [];
                    var satwrt = oSelect.getSelectedKey();
                    var sobjek = sLinea.Plant + satwrt;
                    aFilters.push(new Filter("objek", FilterOperator.EQ, sobjek));
                    aFilters.push(new Filter("atnam", FilterOperator.EQ, 'ZPP_SCREEN_TYPE'));

                    this.getReadFilter(sPath, aFilters).then(function (oData) {

                        if (oData.results.length == 0) {
                            var sMensaje = oResourceBundle.getText("textMessageMainPlant"); //'No tiene centro asignado';
                            var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                            MessageBox.warning(sMensaje, {
                                styleClass: bCompact ? "sapUiSizeCompact" : ""
                            });
                        } else {
                            for (let index = 0; index < aSelect.length; index++) {
                                if (aSelect[index].Position == satwrt) {
                                    sLinea.ktext = aSelect[index].ktext;
                                    break;
                                }
                            }

                            sLinea.atwrt = oData.results[0].atwrt;
                            sLinea.WorkCenter = satwrt;
                            this.evetNav(sLinea);
                        }
                    }.bind(this)).catch((oError) => {

                    });
                }
            },

            getInitialWout: function () {
                return {
                    Operario: "",
                    Plant: "",
                    WorkCenter: "",
                    atwrt: "",
                    cuobj: "",
                    SelectLinea: []
                }
            },

            getInitButton: function () {
                return {
                    LoginBtnEnabled: false
                }
            },

            getSelect: function () {
                return {
                    Position: " ",
                    WorkCenter: " ",
                    ktext: ""
                }
            },
        });
    });
