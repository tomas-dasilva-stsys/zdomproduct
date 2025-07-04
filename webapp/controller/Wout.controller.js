let oResourceBundle;

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    'sap/ndc/BarcodeScanner',
    "sap/ui/model/resource/ResourceModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    'sap/ui/model/Filter',
    'sap/ui/model/FilterOperator',
    'sap/m/SearchField',
    "sap/m/MessagePopover",
    "sap/m/MessagePopoverItem",
    "production/model/formatter"
],
    function (Controller, JSONModel, BarcodeScanner, ResourceModel, MessageToast,
        MessageBox, Fragment, Filter, FilterOperator, SearchField,
        MessagePopover, MessagePopoverItem, formatter) {
        "use strict";

        let oMessageTemplate = new MessagePopoverItem({
            type: '{T}',
            title: '{S}'
        });

        let oMessagePopover = new MessagePopover({
            items: {
                path: '/',
                template: oMessageTemplate
            }
        });

        return Controller.extend("production.controller.Wout", {
            formatter: formatter,
            oFragments: {},

            onInit: function () {

                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("RouteWout").attachMatched(this._onHandleRouteMatched, this);

                const i18nModel = new ResourceModel({
                    bundleName: "production.i18n.i18n"
                });
                this.getView().setModel(i18nModel, "i18n");

                oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

                let message = new JSONModel({
                    messageLength: "",
                    type: "Default"
                });

                this.getView().setModel(message, "message");
                let popModel = new JSONModel({});
                oMessagePopover.setModel(popModel);
            },

            _onHandleRouteMatched: function (oEvent) {
                jQuery(document).off("keydown");

                var oDataWout = this.getInitialWout();
                oDataWout.Operario = oEvent.getParameter("arguments").Operario;
                oDataWout.Plant = oEvent.getParameter("arguments").Plant;
                oDataWout.WorkCenter = oEvent.getParameter("arguments").WorkCenter;
                var oModelJson = new JSONModel(oDataWout);
                this.getView().setModel(oModelJson, "WoutJSON");

                var oEditView = this.getEditView();
                var oViewJson = new JSONModel(oEditView);
                this.getView().setModel(oViewJson, "ViewJSON");

                this.setImpreg();
            },

            setImpreg: function () {
                var sOperario = this.getView().getModel("WoutJSON").getProperty('/');
                var sPath = "/Operario";
                let oFilters = [];
                oFilters.push(new sap.ui.model.Filter("bname", FilterOperator.EQ, sOperario.Operario));
                oFilters.push(new sap.ui.model.Filter("atnam", FilterOperator.EQ, "ZPP_IMPREGNATION"));

                this.getView().getModel().read(sPath, {
                    filters: oFilters,
                    success: function (oData, response) {
                        if (oData.results.length > 0) {
                            this.getView().getModel("ViewJSON").setProperty('/ImpregnationPart', true);
                        }
                    }.bind(this),
                    error: function (oError) {
                        // if (oError.statusCode == '404') {
                        //     var sMensaje = 'No se encuentra operario';
                        //     var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                        //     MessageBox.warning(sMensaje, {
                        //         styleClass: bCompact ? "sapUiSizeCompact" : ""
                        //     });
                        // }
                    }.bind(this),
                });
            },

            // Inic. Fragmentos
            onExit: function () {
                this.destroyFragments();
            },

            destroyFragments: function () {
                if (this.oFragments) {
                    Object.keys(this.oFragments).forEach(function (sKey) {
                        this.oFragments[sKey].destroy();
                        delete this.oFragments[sKey];
                    }, this);
                }
            },

            getFragment: function (sFragmentName) {
                if (!this.oFragments[sFragmentName]) {
                    this.oFragments[sFragmentName] = sap.ui.xmlfragment(this.getView().getId(), "production.view.fragments." +
                        sFragmentName, this);
                    this.getView().addDependent(this.oFragments[sFragmentName]);
                }
                return Promise.resolve(this.oFragments[sFragmentName]);
            },
            // Fin Fragmentos

            getProdOrders: function (matnr) {
                let that = this;
                let sPath = '/ProductionOrder';
                let oModel = this.getView().getModel();
                let woutModel = this.getView().getModel('WoutJSON');
                let toDay = new Date();
                let oFilters = [];

                toDay.setDate(toDay.getDate() - 1);

                oFilters.push(new sap.ui.model.Filter("Matnr", FilterOperator.EQ, matnr));
                //oFilters.push(new sap.ui.model.Filter("gstrp", FilterOperator.BT, toDay, Date()));
                oFilters.push(new sap.ui.model.Filter("gstrs", FilterOperator.BT, toDay, Date()));

                oModel.read(sPath, {
                    filters: oFilters,
                    success: function (oData) {
                        if (oData.results.length === 1) {
                            let prodOrder = oData.results[0].aufnr;
                            woutModel.setProperty('/Aufnr', prodOrder);
                            that.getView().getModel('ViewJSON').setProperty('/InputMaterial', false);
                            that.getView().getModel('ViewJSON').setProperty('/InputKunnr', true);
                            that.getView().getModel('ViewJSON').setProperty('/SelectPalletType', true);
                            that.handleEnabledSaveBtn();
                            that.getQuantityTFA(prodOrder);
                        } else {
                            that.getView().getModel('ViewJSON').setProperty('/InputProductionOrder', true);
                            that.getView().getModel("WoutJSON").setProperty('/Aufnr', '');
                            that.handleEnabledSaveBtn();
                            // that.getView().getModel('ViewJSON').setProperty('/InputKunnr', true);
                            // that.getView().getModel('ViewJSON').setProperty('/SelectPalletType', true);
                        }
                    },
                    error: function (error) {
                        //console.log(error);
                    }
                })
            },

            getMatnr: function (pMatnr) {
                if (!pMatnr) return;
                var sPath = "/MaterialOperation";
                var oFilters = [];
                var toDay = new Date();
                let oResourceBundle = this.getView().getModel("i18n").getResourceBundle();


                // toDay.setDate(toDay.getDate() - 1);
                // oFilters.push(new sap.ui.model.Filter("gstrp", FilterOperator.BT, toDay, Date()));

                oFilters.push(new sap.ui.model.Filter("plnbez", sap.ui.model.FilterOperator.EQ, pMatnr));

                this.getView().getModel().read(sPath, {
                    filters: oFilters,
                    success: function (oData, response) {

                        let errorMaterialNotManufactured = oResourceBundle.getText("textErrorMaterialNoManufactured");

                        if (oData.results.length == 0) {
                            this.getView().getModel("WoutJSON").setProperty('/OrdProduct', []);
                            var sMensaje = (errorMaterialNotManufactured);
                            var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                            MessageBox.warning(sMensaje, {
                                styleClass: bCompact ? "sapUiSizeCompact" : ""
                            });
                        } else {
                            var sOrdProduct = $.extend(true, {}, this.getInitOrdProduct());
                            var aOrdProduct = [];

                            for (var i = 0; i < oData.results.length; i++) {
                                var sResutl = $.extend(true, {}, oData.results[i]);
                                var sMatnrR = sResutl.plnbez;
                                var sMaktx = sResutl.maktx;

                                sOrdProduct.Aufnr = sResutl.aufnr;
                                sOrdProduct.Position = i;
                                aOrdProduct.push($.extend(true, {}, sOrdProduct));
                            };
                            this.getView().getModel("WoutJSON").setProperty("/Matnr", sMatnrR);
                            this.getView().getModel("WoutJSON").setProperty("/MatnrDesc", sMaktx);
                            this.getView().getModel("WoutJSON").setProperty('/OrdProduct', aOrdProduct);
                            this.cleanNotifications(); // Cambio 27/09
                            this.getPalletType(sMatnrR);
                            this.getProdOrders(sMatnrR);
                        }
                    }.bind(this),
                    error: function (oError) {

                    }.bind(this),
                });
            },

            onPalletType: function (oEvent) {
                var sPackno = oEvent.getParameters().selectedItem.getText();
                this.getView().getModel("WoutJSON").setProperty("/PalletTypeValue", oEvent.getParameters().selectedItem.getText());
                this.getQuantity(sPackno);
            },

            getQuantity: function (pPackno) {
                var sPath = "/Quantity";
                var oFilters = [];

                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                //var sWerks = this.getView().getModel("WoutJSON").getProperty("/Plant");
                oFilters.push(new sap.ui.model.Filter("matnr", sap.ui.model.FilterOperator.Contains, sMatnr));
                //oFilters.push(new sap.ui.model.Filter("werks", sap.ui.model.FilterOperator.EQ, sWerks));
                oFilters.push(new sap.ui.model.Filter("pobjid", sap.ui.model.FilterOperator.EQ, pPackno));

                this.getView().getModel().read(sPath, {
                    filters: oFilters,
                    success: function (oData, response) {
                        // this.getView().getModel("ViewJSON").setProperty("/InputQuantity", true);                        
                        if (oData.results.length > 0) {
                            this.getView().getModel("WoutJSON").setProperty("/Quantity", oData.results[0].trgqty);
                            this.getView().getModel("ViewJSON").setProperty("/QuantityTable", oData.results);
                        }
                    }.bind(this),
                    error: function (oError) {

                    }.bind(this),
                });
            },

            getPalletType: function (pMatnr) {
                let that = this;
                var sPath = "/PalletType";
                var oFilters = [];
                var sWerks = this.getView().getModel("WoutJSON").getProperty("/Plant");
                let woutJson = this.getView().getModel("WoutJSON");

                oFilters.push(new sap.ui.model.Filter("matnr", sap.ui.model.FilterOperator.EQ, pMatnr));
                oFilters.push(new sap.ui.model.Filter("werks", sap.ui.model.FilterOperator.EQ, sWerks));

                this.getView().getModel().read(sPath, {
                    filters: oFilters,
                    success: function (oData, response) {
                        if (oData.results.length === 0) {
                            MessageBox.warning(oResourceBundle.getText('textErrorPalletNotAssigned'));
                            that.getView().getModel('ViewJSON').setProperty('/InputProductionOrder', false);
                            woutJson.setProperty('/Quantity', 0);
                            woutJson.setProperty('/PalletType', {});
                            woutJson.setProperty('/Kunnr', '');
                            return;
                        }
                        //packnrT
                        var sPalletType = $.extend(true, {}, this.getSPalletType());
                        var aPalletType = [];

                        for (var i = 0; i < oData.results.length; i++) {
                            var sResutl = $.extend(true, {}, oData.results[i]);

                            //sPalletType.packnrT = sResutl.packnrT;
                            sPalletType.packnrT = sResutl.pobjid;
                            sPalletType.Position = sResutl.packnrT;
                            aPalletType.push($.extend(true, {}, sPalletType));
                        };
                        this.getView().getModel("WoutJSON").setProperty('/PalletType', aPalletType);
                        this.getView().getModel("WoutJSON").setProperty("/PalletTypeValue", aPalletType[0]?.packnrT);

                        if (oData.results.length > 0) {
                            this.getQuantity(oData.results[0].pobjid);
                        }

                        this.getProdOrders(pMatnr);

                    }.bind(this),
                    error: function (oError) {

                    }.bind(this),
                });
            },

            onGetMatnr: function (oEvent) {
                var sMatnr = oEvent.getParameters().value;
                this.getMatnr(sMatnr);
            },

            onAufnr: function (oEvent) {
                var vAufnr = oEvent.getSource().getSelectedItem().getText();
                var sMensaje;
                var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                var sPath = "/ProductionOrder(aufnr='" + vAufnr + "')";
                //let oResourceBundleAufnr = this.getView().getModel("i18n").getResourceBundle();



                this.getView().getModel().read(sPath, {
                    success: function (oData, response) {

                        let errorNoOrderReleased = oResourceBundle.getText("textErrorNoOrderReleased");
                        //if (oData.gstrp > oData.fecha) {
                        if (oData.gstrs > oData.fecha) {
                            sMensaje = (errorNoOrderReleased);
                            MessageBox.warning(sMensaje, {
                                styleClass: bCompact ? "sapUiSizeCompact" : ""
                            });
                        } else {
                            if (oData.objnr == '') {
                                sMensaje = (errorNoOrderReleased);
                                MessageBox.warning(sMensaje, {
                                    styleClass: bCompact ? "sapUiSizeCompact" : ""
                                });
                            } else {
                                this.getOfCloseField(oData.aufnr);
                                this.getQuantityTFA(oData.aufnr);
                            }
                        }
                    }.bind(this),
                    error: function (oError) {

                    }.bind(this),
                });
            },

            getQuantityTFA: function (pAufnr) {
                var sPath = "/QuantityTFA(OrderNumber='" + pAufnr + "')";

                this.getView().getModel().read(sPath, {
                    success: function (oData, response) {
                        this.getView().getModel("WoutJSON").setProperty("/CantTeo", oData.gamng);
                        this.getView().getModel("WoutJSON").setProperty("/CantDecl", oData.SBMNG);
                        this.getView().getModel("WoutJSON").setProperty("/Avance", oData.Porcentaje);
                    }.bind(this),
                    error: function (oError) {

                    }.bind(this),
                });
            },

            getOfCloseField: function (pAufnr) {

            },

            onBarcode: function () {

                sap.ndc.BarcodeScanner.scan(
                    function (mResult) {
                        if (!mResult.cancelled) {
                            this.getView().getModel("WoutJSON").setProperty("/Matnr", mResult.text);
                            this.getMatnr(mResult.text);
                        }
                    }.bind(this),
                    function (Error) {
                        var a = 2;
                    }.bind(this)
                );
            },

            onValueHelpKunnr: function (oEvent) {
                var that = this;
                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                var oFilters = [];
                oFilters.push(new sap.ui.model.Filter("Matnr", FilterOperator.EQ, sMatnr));

                that.getFragment("CustomerDialog").then(function (oFragment) {
                    //that.valuehelp = oFragment;
                    oFragment.getTableAsync().then(function (oTable) {
                        oTable.setModel(that.getView().getModel());
                        var oInitKunrr = that.getInitKunnr();
                        var oAufnrJSON = new JSONModel(oInitKunrr);
                        oTable.setModel(oAufnrJSON, "columns");

                        if (oTable.bindRows) {
                            oTable.bindAggregation("rows", {
                                path: "/Customer",
                                filters: oFilters
                            });
                        }
                        oFragment.update();
                    });
                    oFragment.open();
                });
            },

            onFilterBarSearchKunnr: function (oEvent) {
                var aSelectionSet = oEvent.getParameter("selectionSet");

                var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
                    if (oControl.getValue()) {
                        aResult.push(new sap.ui.model.Filter(oControl.getName(), FilterOperator.Contains, oControl.getValue()));
                    }
                    return aResult;
                }, []);

                this.getFragment("CustomerDialog").then(function (oFragment) {
                    var oBindingInfo = oFragment.getTable().getBinding("rows");
                    var oFilters = new Filter({
                        filters: aFilters,
                        and: false
                    });
                    oBindingInfo.filter(oFilters);
                    oFragment.update();
                });
            },

            onValueHelpOkPressKunnr: function (oEvent) {
                var aTokens = oEvent.getParameter("tokens");
                this.getView().getModel("WoutJSON").setProperty("/Kunnr", aTokens[0].getKey());
                this.getView().getModel("WoutJSON").setProperty("/Name_org1", aTokens[0].getText());

                this.getFragment("CustomerDialog").then(function (oFragment) {
                    oFragment.close();
                });
                //this.getOfCloseField(aTokens[0].getKey());
                //this.getQuantityTFA(aTokens[0].getKey());
            },

            onExitKunnr: function () {
                this.getFragment("CustomerDialog").then(function (oFragment) {
                    oFragment.close();
                });
            },

            getInitKunnr: function () {
                return {
                    "cols": [
                        {
                            "label": "{i18n>textItemlKunnr}",
                            "template": "Kunnr"
                            //"width": "5rem"
                        },
                        {
                            "label": "{i18n>textItemVbeln}",
                            "template": "Vbeln"
                        },
                        {
                            "label": "{i18n>textItemPosnr}",
                            "template": "Posnr"
                        },
                        {
                            "label": "{i18n>textItemNameOrg}",
                            "template": "Name_org1"
                        },
                        {
                            "label": "{i18n>textItemBstkd}",
                            "template": "Bstkd"
                        }
                    ]
                }
            },



            onValueHelpMatnr: function (oEvent) {
                var that = this;
                var sArbpl = this.getView().getModel("WoutJSON").getProperty("/WorkCenter");
                //var matnrInput = this.getView().byId('matnrInput');

                // if (!sMatnr) {
                //     matnrInput.setValueState('Error');
                //     matnrInput.setValueStateText('Campo Matnr no puede estar vacío.');
                //     return;
                // }

                var oFilters = [];
                // var toDay = new Date();
                // toDay.setDate(toDay.getDate() - 1);


                //const birthday = new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDay());

                oFilters.push(new sap.ui.model.Filter("arbpl", FilterOperator.EQ, sArbpl));
                //oFilters.push(new sap.ui.model.Filter("gstrp", FilterOperator.BT, toDay, Date()));

                this.getFragment("MatnrDialog").then(function (oFragment) {
                    //that.valuehelp = oFragment;
                    oFragment.getTableAsync().then(function (oTable) {
                        oTable.setModel(that.getView().getModel());
                        var oInitMatnr = that.getInitMatnr();
                        var oMatnrJSON = new JSONModel(oInitMatnr);
                        oTable.setModel(oMatnrJSON, "columns");

                        if (oTable.bindRows) {
                            oTable.bindAggregation("rows", {
                                path: "/MaterialMatch",
                                filters: oFilters
                            });
                        }
                        oFragment.update();
                    });
                    oFragment.open();
                });
            },

            onFilterBarSearchMatnr: function (oEvent) {
                var aSelectionSet = oEvent.getParameter("selectionSet");
                let daysBefore = new Date();
                let daysAfter = new Date();

                var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
                    if (oControl.getName() === 'plnbez' || oControl.getName() === 'maktx') {
                        if (oControl.getValue()) {
                            aResult.push(new sap.ui.model.Filter(oControl.getName(), FilterOperator.Contains, oControl.getValue()));
                        }
                        return aResult
                    }
                    return aResult;
                }, []);

                var sArbpl = this.getView().getModel("WoutJSON").getProperty("/WorkCenter");
                aFilters.push(new sap.ui.model.Filter("arbpl", FilterOperator.EQ, sArbpl));

                this.getFragment("MatnrDialog").then(function (oFragment) {
                    oFragment.getTableAsync().then(function (oTable) {
                        if (oTable.bindRows) {
                            oTable.bindAggregation("rows", {
                                path: "/MaterialMatch",
                                filters: aFilters
                            });
                        }
                        oFragment.update();
                    });
                });
            },

            onValueHelpOkPressMatnr: function (oEvent) {
                var sMatnr = oEvent.getParameter("tokens")[0].getKey();
                this.getView().getModel("WoutJSON").setProperty("/Matnr", sMatnr);

                var sPos = oEvent.getSource().getTable().getSelectedIndex();
                var sMaktx = oEvent.getSource().getTable().getRows()[sPos].getBindingContext().getProperty("maktx");
                this.getView().getModel("WoutJSON").setProperty("/MatnrDesc", sMaktx);

                this.getPalletType(sMatnr);
                // this.getProdOrders(sMatnr);

                this.getFragment("MatnrDialog").then(function (oFragment) {
                    oFragment.close();
                });
                this.cleanNotifications(); // Cambio 27/09
            },

            onExitMatnr: function (oEvent) {
                this.getFragment("MatnrDialog").then(function (oFragment) {
                    oFragment.close();
                });
            },

            onValueHelpAufnr: function (oEvent) {
                var that = this;
                var oModel = this.getView().getModel();
                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                var sWorkCenter = this.getView().getModel("WoutJSON").getProperty("/WorkCenter");
                var sPlant = this.getView().getModel("WoutJSON").getProperty("/Plant");
                var toDay = new Date();
                var toFinDay = new Date();
                var oFilters = [];
                toDay.setDate(toDay.getDate() - 1);
                var sMesInit = toDay.getMonth() + 1;
                var sMesFin = toFinDay.getMonth() + 1;

                var sFin = toFinDay.getFullYear() + "/" + sMesInit + "/" + toFinDay.getDate();
                var sInit = toDay.getFullYear() + "/" + sMesFin + "/" + toDay.getDate();
                var SDesHasta = sInit + " - " + sFin;

                oFilters.push(new Filter("Matnr", FilterOperator.EQ, sMatnr));
                oFilters.push(new Filter("gstrs", FilterOperator.BT, toDay, Date()));
                oFilters.push(new Filter("arbpl", FilterOperator.EQ, sWorkCenter));
                oFilters.push(new Filter("werks", FilterOperator.EQ, sPlant));

                // that.getFragment("AufnrDialog").then(function (oFragment) {
                //     that.byId("DRS1").setValue(SDesHasta);
                //     oFragment.getTableAsync().then(function (oTable) {
                //         oTable.setModel(that.getView().getModel());
                //         var oInitAufnr = that.getInitAufnr();
                //         var oAufnrJSON = new JSONModel(oInitAufnr);
                //         oTable.setModel(oAufnrJSON, "columns");

                //         if (oTable.bindRows) {
                //             oTable.bindAggregation("rows", {
                //                 path: "/ProductionOrder",
                //                 filters: oFilters
                //             });
                //         }
                //         oFragment.update();
                //     });
                //     oFragment.open();
                // });

                that.getFragment("ProductionOrDialog").then(function (oFragment) {
                    let oTable = that.getView().byId('prodOrTable');
                    oTable.setModel(new JSONModel({}), 'pOrData');
                    oTable.setBusy(true);
                    that.byId("DRS2").setValue(SDesHasta);
                    oModel.read('/ProductionOrder', {
                        filters: oFilters,
                        success: function (oData) {
                            let pOrderData = [];
                            let pOrderModel = oTable.getModel('pOrData');

                            oData.results.forEach(item => {
                                let data = {
                                    aufnr: item.aufnr,
                                    gstrs: item.gstrs,
                                    dat_tim: item.dat_tim,
                                    objnr: item.objnr
                                }

                                pOrderData.push(data);
                            })

                            pOrderModel.setData(pOrderData);
                            oTable.setBusy(false);
                        },
                        error: function (oError) {
                            //console.log(oError);
                        }

                    })
                    oFragment.open();
                });
            },

            onFilterBarSearch: function (oEvent) {
                var that = this;
                var aSelectionSet = oEvent.getParameter("selectionSet");
                var oList = oEvent.getSource();

                var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
                    if (oControl.getName() === 'gstrs') {

                        if (oControl.getDateValue() != null) {
                            aResult.push(new sap.ui.model.Filter(oControl.getName(), FilterOperator.BT, oControl.getFrom(), oControl.getTo()));
                            return aResult;
                        }
                    }

                    if (oControl.getValue()) {
                        aResult.push(new sap.ui.model.Filter(oControl.getName(), FilterOperator.Contains, oControl.getValue()));
                    }
                    return aResult;
                }, []);

                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                var sWorkCenter = this.getView().getModel("WoutJSON").getProperty("/WorkCenter");
                aFilters.push(new sap.ui.model.Filter("Matnr", FilterOperator.EQ, sMatnr));
                aFilters.push(new sap.ui.model.Filter("arbpl", FilterOperator.EQ, sWorkCenter));

                // this.getFragment("AufnrDialog").then(function (oFragment) {
                //     oFragment.getTableAsync().then(function (oTable) {
                //         if (oTable.bindRows) {
                //             oTable.bindAggregation("rows", {
                //                 path: "/ProductionOrder",
                //                 filters: aFilters
                //             });
                //         }
                //         oFragment.update();
                //     });

                // });

                this.getFragment("ProductionOrDialog").then(function (oFragment) {
                    let oTable = that.getView().byId('prodOrTable');
                    oTable.setModel(new JSONModel({}), 'pOrData');
                    oTable.setBusy(true);
                    // that.byId("DRS2").setValue(SDesHasta);
                    that.getView().getModel().read('/ProductionOrder', {
                        filters: aFilters,
                        success: function (oData) {
                            let pOrderData = [];
                            let pOrderModel = oTable.getModel('pOrData');

                            oData.results.forEach(item => {
                                let data = {
                                    aufnr: item.aufnr,
                                    gstrs: item.gstrs,
                                    dat_tim: item.dat_tim,
                                    objnr: item.objnr
                                }

                                pOrderData.push(data);
                            })

                            pOrderModel.setData(pOrderData);
                            oTable.setBusy(false);
                        },
                        error: function (oError) {
                            //console.log(oError);
                        }

                    })

                    oFragment.open();
                });
            },

            onValueHelpOkPressAufnr: function (oEvent) {
                var aTokens = oEvent.getParameter("tokens");
                this.getView().getModel("WoutJSON").setProperty("/Aufnr", aTokens[0].getKey());
                this.getFragment("AufnrDialog").then(function (oFragment) {
                    oFragment.close();
                });
                this.getOfCloseField(aTokens[0].getKey());
                this.getQuantityTFA(aTokens[0].getKey());
                this.getView().getModel('ViewJSON').setProperty('/InputMaterial', false);
                this.getView().getModel('ViewJSON').setProperty('/InputProductionOrder', false);
                this.getView().getModel('ViewJSON').setProperty('/InputQuantity', true);
                this.getView().getModel('ViewJSON').setProperty('/SelectPalletType', true);
                this.getView().getModel('ViewJSON').setProperty('/InputKunnr', true);
                this.handleEnabledSaveBtn();
                this.getViewUM();
            },

            onCellClick: function (oEvent) {
                let rowIndex = oEvent.getParameters().rowIndex;
                let currentAufnr = oEvent.getParameters().rowBindingContext.getModel().getData()[rowIndex].aufnr;
                this.getView().getModel("WoutJSON").setProperty("/Aufnr", currentAufnr);
                this.getFragment("ProductionOrDialog").then(function (oFragment) {
                    oFragment.close();
                });

                this.getOfCloseField(currentAufnr);
                this.getQuantityTFA(currentAufnr);
                this.getView().getModel('ViewJSON').setProperty('/InputMaterial', false);
                this.getView().getModel('ViewJSON').setProperty('/InputProductionOrder', false);
                this.getView().getModel('ViewJSON').setProperty('/InputQuantity', true);
                this.getView().getModel('ViewJSON').setProperty('/SelectPalletType', true);
                this.getView().getModel('ViewJSON').setProperty('/InputKunnr', true);
                this.handleEnabledSaveBtn();
                this.getViewUM();
            },

            onBarcodeSerieUm: function (oEvent) {
                sap.ndc.BarcodeScanner.scan(
                    function (mResult) {
                        if (!mResult.cancelled) {
                            this.getView().getModel("WoutJSON").setProperty("/Um", mResult.text);
                            //this.getMatnr(mResult.text);
                            this.GetSernr(mResult.text);
                        }
                    }.bind(this),
                    function (Error) {

                    }.bind(this)
                );
            },

            onGetSernr: function (oEvent) {
                var sUm = oEvent.getParameters().value;
                this.GetSernr(sUm);
            },

            GetSernr: function (sUm) {
                var sPath = "/Z_getSernUm";
                var oParameter = { "Sernr": sUm };

                this.getSernrBack(sPath, oParameter).then(function (oData) {
                    this.getView().getModel("WoutJSON").setProperty("/SernrUm", oData.Sernr);
                }.bind(this)).catch((oError) => {

                }).finally(function (info) {

                })
            },

            getSernrBack: function (sPath, oParameter) {
                return new Promise(function (resolve, reject) {
                    this.getView().getModel("ZDOM_0000_SRV_01").callFunction(sPath, {
                        method: "GET",
                        urlParameters: oParameter,
                        success: resolve,
                        error: reject
                    });
                }.bind(this));
            },

            getViewUM: function () {
                var sPath = "/SerialNumberUM";
                var oFilters = [];
                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                var sAufnr = this.getView().getModel("WoutJSON").getProperty("/Aufnr");

                oFilters.push(new sap.ui.model.Filter("matnr", sap.ui.model.FilterOperator.EQ, sMatnr));
                oFilters.push(new sap.ui.model.Filter("aufnr", sap.ui.model.FilterOperator.EQ, sAufnr));

                this.getView().getModel().read(sPath, {
                    filters: oFilters,
                    success: function (oData, response) {
                        if (oData.results.length > 0) {
                            this.getView().getModel("ViewJSON").setProperty("/InputUM", true);
                        } else {
                            this.getView().getModel("ViewJSON").setProperty("/InputUM", false);
                        }

                    }.bind(this),
                    error: function (oError) {

                    }.bind(this),
                });
            },

            getInitAufnr: function () {
                return {
                    "cols": [
                        {
                            "label": "{i18n>textItemlAufnr}",
                            "template": "aufnr"
                            //"width": "5rem"
                        },
                        // {
                        //     "label": "{i18n>textItemgstrp}",
                        //     "template": "gstrp"
                        // },
                        {
                            "label": "{i18n>textItemgstrp}",
                            "template": "gstrs"
                        },
                        {
                            "label": "{i18n>textItemobjnr}",
                            "template": "objnr"
                        }
                    ]
                }
            },

            getInitMatnr: function () {
                return {
                    "cols": [
                        {
                            "label": "Material",
                            "template": "plnbez"
                        },
                        {
                            "label": "Descripcion",
                            "template": "maktx"
                        }
                    ]
                }
            },

            onExitAufnr: function () {
                this.getFragment("AufnrDialog").then(function (oFragment) {
                    oFragment.close();
                });
            },

            handleChange: function (oEvent) {
                var sPath = "/Quantity";
                var oFilters = [];

                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                //var sWerks = this.getView().getModel("WoutJSON").getProperty("/Plant");
                oFilters.push(new sap.ui.model.Filter("matnr", sap.ui.model.FilterOperator.Contains, sMatnr));
                //oFilters.push(new sap.ui.model.Filter("werks", sap.ui.model.FilterOperator.EQ, sWerks));
                //oFilters.push(new sap.ui.model.Filter("pobjid", sap.ui.model.FilterOperator.EQ, pPackno));

                this.getView().getModel().read(sPath, {
                    filters: oFilters,
                    success: function (oData, response) {
                        // if (oData.results.length === 0) {
                        //     sap.m.MessageBox.warning(`No quantity found for material ${sMatnr}`);
                        //     return;
                        // }

                        // this.getView().getModel("ViewJSON").setProperty("/InputQuantity", true); //Cambio 29/09
                        this.getView().getModel("ViewJSON").setProperty("/QuantityTable", oData.results);

                        if (oData.results.length > 0) {
                            this.getView().getModel("WoutJSON").setProperty("/Quantity", oData.results[0].trgqty);
                        }

                    }.bind(this),
                    error: function (oError) {

                    }.bind(this),
                });
            },

            handleEnabledSaveBtn: function () {
                let viewModel = this.getView().getModel('WoutJSON');
                let matInput = viewModel.getProperty('/Matnr');
                let prodOrderInput = viewModel.getProperty('/Aufnr');
                let quantityInput = viewModel.getProperty('/Quantity');
                let palletType = viewModel.getProperty('/PalletTypeValue');

                if (!matInput || !prodOrderInput || !palletType) {
                    this.getView().getModel('ViewJSON').setProperty('/SaveBtnEnabled', false);
                    return;
                }

                this.getView().getModel('ViewJSON').setProperty('/SaveBtnEnabled', true);
            },

            onImpregpart: function () {

            },

            onQuantityToDeclareChange: function () {
                this.validateQuantityToDeclare();
            },
            // Inic. QuantityDialog
            validateQuantityToDeclare: function () {
                var oQuantity = this.getView().getModel("ViewJSON").getProperty("/QuantityTable");
                //var sQuantity = oEvent.getParameters().value;
                var sQuantity = this.getView().getModel("WoutJSON").getObject("/Quantity");
                var sMensaje;
                var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                var that = this;
                //let oResourceBundleQuantDeclare = this.getView().getModel("i18n").getResourceBundle();
                let errorQuantityDeclare = oResourceBundle.getText("textErrorQuantityEmpty");

                for (var i = 0; i < oQuantity.length; i++) {
                    if (parseInt(oQuantity[i].trgqty) >= parseInt(sQuantity)) {
                        return;
                    } else {
                        sMensaje = (errorQuantityDeclare);
                        MessageBox.error(sMensaje, {
                            styleClass: bCompact ? "sapUiSizeCompact" : ""
                        });
                    }
                };
            },

            getValStock: function (sAufnr, sQuantity) {
                //  let oResourceBundleValStock = this.getView().getModel("i18n").getResourceBundle();
                let errorQuantityEmpty = oResourceBundle.getText("textErrorQuantityEmpty");


                if (!sQuantity) {
                    MessageBox.error(errorQuantityEmpty);
                    return;
                }

                var sPath = "/ZFI_CHECK_AVAILABLE_STOCK";

                var iQuantity = parseInt(sQuantity).toFixed(3)

                var oParameter = { "Aufnr": sAufnr, "Quantity": iQuantity };

                return new Promise(function (resolve, reject) {
                    this.getView().getModel("ZDOM_0000_SRV_01").callFunction(sPath, {
                        method: "GET",
                        urlParameters: oParameter,
                        success: resolve,
                        error: reject
                    });
                }.bind(this));
            },

            validateQuantity: function () {
                var oQuantity = this.getView().getModel("ViewJSON").getProperty("/QuantityTable");
                //var sQuantity = oEvent.getParameters().value;
                var sQuantity = this.getView().getModel("WoutJSON").getObject("/Quantity");
                var sMensaje;
                var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                var that = this;
                var sPalletTypeValue = this.getView().getModel("WoutJSON").getProperty("/PalletTypeValue");
                let messageValidateQuant = oResourceBundle.getText("textMessagePaletMandatory")

                if (sPalletTypeValue == '') {
                    MessageBox.error(messageValidateQuant);
                    return;
                }

                var sAufnr = this.getView().getModel("WoutJSON").getProperty("/Aufnr");
                var sQuantity = this.getView().getModel("WoutJSON").getProperty("/Quantity");

                this.getValStock(sAufnr, sQuantity).then(function (oData) {

                    if (oData.results.length > 0) {
                        for (var i = 0; i < oData.results.length; i++) {
                            if (oData.results[0].Type == 'E') {
                                this.getFragment("QuantityDialog").then(function (oFragment) {
                                    var oRFIDTable = that.getView().getModel("WoutJSON");
                                    oFragment.setModel(oRFIDTable);
                                    oFragment.bindElement("/");
                                    oFragment.open();
                                });
                                return;
                                // MessageBox.error(sMensaje, {
                                //     styleClass: bCompact ? "sapUiSizeCompact" : ""
                                // });
                            } else {
                                this.postSave();
                                return;
                            }
                        }
                    } else {
                        this.postSave();
                    }

                }.bind(this)).catch((oError) => {

                }).finally(function (info) {

                })

                //Validar Cantidad
                //manufacturing + cantidad declearra tiene que ser menor iguala  teorica.
                // var iCantDecl = this.getView().getModel("WoutJSON").getProperty("/CantDecl");
                // var iCantTeo = this.getView().getModel("WoutJSON").getProperty("/CantTeo");
                // var iQuantity = this.getView().getModel("WoutJSON").getProperty("/Quantity");
                // var iTotal = iCantDecl + iQuantity;

                // if (iTotal > iCantTeo) {
                //     sMensaje = 'Quantity exceeds packing quantity';
                //     MessageBox.error(sMensaje, {
                //         styleClass: bCompact ? "sapUiSizeCompact" : ""
                //     });
                // } else {
                //if (oQuantity) {
                // for (var i = 0; i < oQuantity.length; i++) {
                //     if (oQuantity[i].trgqty >= sQuantity) {

                // this.getFragment("QuantityDialog").then(function (oFragment) {
                //     var oRFIDTable = that.getView().getModel("WoutJSON");
                //     oFragment.setModel(oRFIDTable);
                //     oFragment.bindElement("/");
                //     oFragment.open();
                // });

                // } else {
                //     this.postSave();
                // }
                //}
                // } else {
                //     sMensaje = 'Quantity exceeds packing quantity';
                //     MessageBox.error(sMensaje, {
                //         styleClass: bCompact ? "sapUiSizeCompact" : ""
                //     });
                // }
                //}
            },

            onCancelar: function () {
                this.getFragment("QuantityDialog").then(function (oFragment) {
                    oFragment.close();
                });
            },

            onClose: function () {
                this.getFragment("ProductionOrDialog").then(function (oFragment) {
                    oFragment.close();
                });
            },

            onAceptar: function (oEvent) {
                var that = this;
                this.getFragment("QuantityDialog").then(function (oFragment) {
                    oFragment.close();
                });
                this.postSave();
            },
            //Fin QuantityDialog
            cleanScreen: function () {
                let oModel = this.getView().getModel('WoutJSON');
                let oModelData = this.getView().getModel('WoutJSON').getObject('/');
                let modelData = this.getInitialWout();

                modelData.Operario = oModelData.Operario;
                modelData.WorkCenter = oModelData.WorkCenter;
                modelData.Plant = oModelData.Plant;
                this.getView().getModel("ViewJSON").setProperty("/InputQuantity", false);

                oModel.setData(modelData);
                oModel.refresh();
                this.getView().byId('matnrInput').setEnabled(true);
                this.getView().byId('productionOrderInput').setEnabled(true);
            },

            cleanNotifications: function () {
                this.getView().getModel('message').setProperty('/messageLength', ''); // Cambio 27/09
                this.getView().getModel('message').setProperty('/type', 'Default'); // Cambio 27/09
                oMessagePopover.getModel().setData({}); // Cambio 27/09

                this.getView().getModel('ViewJSON').setProperty('/InputQuantity', false);
                this.getView().getModel('ViewJSON').setProperty('/SelectPalletType', false);
                this.getView().getModel('ViewJSON').setProperty('/InputKunnr', false);
            }, // Cambio 27/09

            onReject: function () {
                let oModel = this.getView().getModel('WoutJSON');
                let oModelData = this.getView().getModel('WoutJSON').getObject('/');
                let modelData = this.getInitialWout();

                let oModelEditView = this.getView().getModel('ViewJSON');
                let initialEditView = this.getEditView();
                //let oResourceBundleReject = this.getView().getModel("i18n").getResourceBundle();
                let errorQuantityEmpty = oResourceBundle.getText("textMessageCancelProduction");
                let errorPopUpCancel = oResourceBundle.getText("textMessagePopUpCancel");


                modelData.Operario = oModelData.Operario;
                modelData.WorkCenter = oModelData.WorkCenter;
                modelData.Plant = oModelData.Plant;

                MessageBox.show(errorQuantityEmpty, {
                    icon: MessageBox.Icon.WARNING,
                    title: errorPopUpCancel,
                    actions: ["YES", "NO"],
                    emphasizedAction: "YES",
                    onClose: async function (oAction) {
                        if (oAction === 'YES') {
                            oModel.setData(modelData);
                            oModelEditView.setData(initialEditView);
                        } else {
                            sap.m.MessageToast.show(errorPopUpCancel);
                        }
                    }
                })
            },
            // Inic. Guardar Product
            postSave: function () {
                var that = this;
                var sMensaje;
                var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                var sBusy = "Procesando..";
                var busyDialog4 = (sap.ui.getCore().byId("busy4")) ? sap.ui.getCore().byId("busy4") : new sap.m.BusyDialog('busy4', {
                    title: sBusy


                });
                var oPostProduct = this.getInitPost();
                var sProduct = this.getInitProduct();
                var oWoutJSON = this.getView().getModel("WoutJSON").getObject("/");
                let messagePalletMandat = oResourceBundle.getText("textMessagePaletMandatory");
                let messageQuantityMandt = oResourceBundle.getText("textErrorQuantityEmpty")


                if (oWoutJSON.Quantity == 0) {//Cammbio 26/09
                    MessageBox.error(messageQuantityMandt);//Cammbio 26/09
                    return//Cammbio 26/09
                }//Cammbio 26/09

                if (oWoutJSON.PalletTypeValue == null) {
                    MessageBox.error(messagePalletMandat);
                    return
                }

                oPostProduct.Linea = oWoutJSON.WorkCenter;
                oPostProduct.Operario = oWoutJSON.Operario;
                oPostProduct.Werks = oWoutJSON.Plant;
                sProduct.Operario = oWoutJSON.Operario;
                sProduct.Werks = oWoutJSON.Plant;
                sProduct.Aufnr = oWoutJSON.Aufnr;
                sProduct.Matnr = oWoutJSON.Matnr;
                sProduct.Declarquantity = oWoutJSON.DeclarQuantity;
                sProduct.Ofclosing = oWoutJSON.OfClosing;
                sProduct.Packnr = oWoutJSON.PalletTypeValue;
                sProduct.Sernr = oWoutJSON.Sernr;
                sProduct.Um = oWoutJSON.Um;
                sProduct.Lifnr = oWoutJSON.Kunnr;
                sProduct.Cantidad = parseInt(oWoutJSON.Quantity).toFixed(3);
                sProduct.Impregpart = oWoutJSON.Impregpart;
                sProduct.ConfText = oWoutJSON.Reason;
                oPostProduct.ProductionDeclarationSet.push($.extend(true, {}, sProduct));

                var oViewJSON = this.getView().getModel("ViewJSON").getObject("/");
                oViewJSON.InputKunnr = false;
                oViewJSON.InputMaterial = true;
                oViewJSON.InputQuantity = false;
                oViewJSON.SelectPalletType = false;
                oViewJSON.InputProductionOrder = false;
                this.getView().getModel("ViewJSON").setProperty("/", oViewJSON);

                busyDialog4.open();

                var sMensaje;
                var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                let errorUnexpected = oResourceBundle.getText("textMessageUnexpected")
                this.getView().getModel("ZDOM_0000_SRV_01").create('/HeaderSet', oPostProduct, {
                    success: function (oData, oResponse) {
                        //this.viewMessage(oData.ReturnSet, this);
                        if (oData.ReturnSet.results.length === 0) {
                            MessageBox.error(errorUnexpected);
                            that.getView().getModel('ViewJSON').setProperty('/InputProductionOrder', true);
                            busyDialog4.close();
                            return
                        }

                        let mensajes = oData.ReturnSet.results.map(msg => msg);
                        let msgsArr = [];

                        mensajes.forEach(msg => {
                            msgsArr.push({
                                T: that.setMessageType(msg.Type),
                                S: msg.Message
                            })
                        })

                        let prevMsgs = Array.from(oMessagePopover.getModel().getData());
                        let upDatedMsgs = [...prevMsgs, ...msgsArr];
                        oMessagePopover.getModel().setData(upDatedMsgs);
                        oMessagePopover.getModel().refresh(true);
                        that.getView().getModel('message').getData().messageLength = upDatedMsgs.length;
                        that.getView().getModel('message').getData().type = "Emphasized";
                        that.getView().getModel('message').refresh(true);

                        var oViewJSON = that.getView().getModel('ViewJSON');

                        msgsArr.forEach(msg => {
                            if (msg.T === 'Error') {
                                oViewJSON.setProperty('/InputMaterial', true);
                                oViewJSON.setProperty('/InputProductionOrder', true);
                                oViewJSON.setProperty('/InputKunnr', true);
                                oViewJSON.setProperty('/InputQuantity', true);
                                oViewJSON.setProperty('/SelectPalletType', true);
                            } else {
                                //Set Edit
                                oViewJSON.setProperty('/InputKunnr', false);
                                oViewJSON.setProperty('/InputMaterial', true);
                                oViewJSON.setProperty('/InputQuantity', false);
                                oViewJSON.setProperty('/SelectPalletType', false);
                                oViewJSON.setProperty('/InputProductionOrder', false);
                                // that.getView().getModel("ViewJSON").setProperty(oViewJSON);
                                that.cleanScreen();
                            }
                        })

                        busyDialog4.close();
                    }.bind(this),
                    error: function (oError, oResponse) {
                        busyDialog4.close();
                    }.bind(this),
                });
            },

            onSave: function (oEvent) {
                this.validateQuantity();
            },
            // Fin Guardar Product

            setMessageType: function (oMessage) {
                switch (oMessage) {
                    case 'S':
                        return 'Success'
                    case 'E':
                        return 'Error'
                    case 'W':
                        return 'Warning'
                    case 'I':
                        return 'Information'
                    case 'A':
                        return 'Abort'

                }
            },

            viewMessage: function (oReturnSet) {
                this.getFragment("MessageDialog").then(function (oFragment) {
                    oFragment.open();
                });
            },

            // Inic. Definicion de estructuras
            getInitOrdProduct: function () {
                return {
                    Position: "",
                    Aufnr: " ",
                }
            },

            getSPalletType: function () {
                return {
                    Position: "",
                    packnrT: " ",
                }
            },

            getEditView: function () {
                return {
                    InputQuantity: false,
                    ImpregnationPart: false,
                    InputUM: false,
                    InputMaterial: true,
                    InputProductionOrder: false,
                    InputKunnr: false,
                    SelectPalletType: false,
                    SaveBtnEnabled: false
                }
            },

            getInitialWout: function () {
                return {
                    Operario: "",
                    Plant: "",
                    WorkCenter: "",
                    Matnr: "",
                    MatnrDesc: "",
                    CantTeo: "",
                    CantDecl: "",
                    Avance: "",
                    Quantity: 0.000,
                    OfClosing: false,
                    DeclarQuantity: true,
                    Impregpart: false,
                    CompNum: "",
                    Reason: "",
                    Kunnr: "",
                    Name_org1: "",
                    PalletTypeValue: "",
                    Sernr: "",
                    Um: "",
                    OrdProduct: [
                        {
                            Position: "0",
                            Aufnr: " ",
                        }
                    ],
                    PalletType: [
                        {
                            Position: " ",
                            packnrT: " "
                        }
                    ],
                    QuantityTable: [

                    ],
                    ReturnSet: [

                    ]
                }
            },

            getInitProduct: function () {
                return {
                    Operario: "",
                    Werks: "",
                    Aufnr: "",
                    Matnr: "",
                    Packnr: "",
                    Proces: "",
                    Cantidad: 0.000,
                    Lifnr: "",
                    Sernr: "",
                    Um: "",
                    Declarquantity: false,
                    Ofclosing: false,
                    Impregpart: false,
                    Unidad: ""
                }
            },

            getInitPost: function () {
                return {
                    Linea: "",
                    Werks: "",
                    Operario: "",
                    ProductionDeclarationSet: [],
                    ReturnSet: [],
                    SRfidSet: []
                }
            },

            getClearObject: function () {
                return {
                    Operario: "",
                    Plant: "",
                    WorkCenter: "",
                    Matnr: "",
                    MatnrDesc: "",
                    CantTeo: "",
                    CantDecl: "",
                    Avance: "",
                    Quantity: 0.000,
                    OfClosing: false,
                    DeclarQuantity: true,
                    Impregpart: false,
                    CompNum: "",
                    Reason: "",
                    Kunnr: "",
                    Name_org1: "",
                    PalletTypeValue: "",
                    Sernr: "",
                    Um: "",
                    OrdProduct: [
                        {
                            Position: "0",
                            Aufnr: " ",
                        }
                    ],
                    PalletType: [
                        {
                            Position: " ",
                            packnrT: " "
                        }
                    ],
                    QuantityTable: [

                    ],
                    ReturnSet: [

                    ]
                }
            },
            // Fin Definicion de estructuras
            handleMessagePopoverPress: function (oEvent) {
                oMessagePopover.toggle(oEvent.getSource());
            }

        });
    });
