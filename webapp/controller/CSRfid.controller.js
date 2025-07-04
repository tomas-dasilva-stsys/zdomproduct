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
    function (Controller, JSONModel, BarcodeScanner, ResourceModel, MessageToast, MessageBox,
        Fragment, Filter, FilterOperator, SearchField,
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

        let oResourceBundle;

        let sPosRFID;

        return Controller.extend("production.controller.CSRfid", {
            formatter: formatter,
            oFragments: {},

            onInit: function () {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("RouteCSRfid").attachMatched(this._onHandleRouteMatched, this);

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
                jQuery(document).off("keydown"); // Cambio 27/09

                var oDataWout = this.getInitialWout();
                oDataWout.Operario = oEvent.getParameter("arguments").Operario;
                oDataWout.Plant = oEvent.getParameter("arguments").Plant;
                oDataWout.WorkCenter = oEvent.getParameter("arguments").WorkCenter;
                let sktext = oEvent.getParameter("arguments").ktext;
                oDataWout.ktext = sktext.replace('+', '/');
                var oModelJson = new JSONModel(oDataWout);
                this.getView().setModel(oModelJson, "WoutJSON");

                var oEditView = this.getEditView();
                var oViewJson = new JSONModel(oEditView);
                this.getView().setModel(oViewJson, "ViewJSON");

                this.setImpreg();
                this.visRFID();
                this.visCustomer();
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

                    }.bind(this),
                });
            },

            visRFID: function () {
                // var sPath = "/Operario";
                // var aFilter = [];
                // var sPlant = this.getView().getModel("WoutJSON").getProperty("/Plant");
                // var sWorkCenter = this.getView().getModel("WoutJSON").getProperty("/WorkCenter");
                // aFilter.push(new sap.ui.model.Filter("Plant", sap.ui.model.FilterOperator.EQ, sPlant));
                // aFilter.push(new sap.ui.model.Filter("WorkCenter", sap.ui.model.FilterOperator.EQ, sWorkCenter));                
                var sPath = "/MultiOperario";
                var aFilter = [];
                var sPlant = this.getView().getModel("WoutJSON").getProperty("/Plant");
                var sWorkCenter = this.getView().getModel("WoutJSON").getProperty("/WorkCenter");
                var sobjek = sPlant + sWorkCenter;
                aFilter.push(new sap.ui.model.Filter("objek", sap.ui.model.FilterOperator.EQ, sobjek));

                this.getBack(sPath, aFilter).then(function (oData) {
                    var sRFID = false;

                    for (var i = 0; i < oData.results.length; i++) {
                        if (oData.results[i].atnam == 'ZPP_SCREEN_TYPE'
                            && oData.results[i].atwrt == '02') {
                            sRFID = true;
                            break;
                        }
                    }
                    this.getView().getModel("ViewJSON").setProperty("/InputRFID", sRFID);
                }.bind(this)).catch((oError) => {

                }).finally(function (info) {

                })
            },

            getBack: function (sPath, aFilter) {

                if (aFilter.length < 0) {
                    var aFilters = [];
                } else {
                    var aFilters = aFilter;
                }

                return new Promise(function (resolve, reject) {
                    this.getView().getModel().read(sPath, {
                        filters: aFilters,
                        success: resolve,
                        error: reject
                    });
                }.bind(this));
            },

            validateRFID: function (sRFID, sPos) {
                let oRFID = this.getView().getModel("WoutJSON").getProperty('/RFIDTable');

                if (oRFID.length > 1) {
                    for (var i = 0; i < oRFID.length; i++) {
                        if (i == sPos) {

                        } else {
                            if (oRFID[i].Rfid === sRFID) {
                                return false;
                            }
                        }
                    }
                }
                return true;
            },

            onScanAgregar: function (oEvent) {
                var arrayDeCadenas = oEvent.getSource().getId().split('-');
                sPosRFID = $.extend(true, {}, arrayDeCadenas[arrayDeCadenas.length - 1]);
                sap.ndc.BarcodeScanner.scan(
                    function (mResult) {
                        if (!mResult.cancelled) {
                            var sCheck = this.validateRFID(mResult.text, sPosRFID[0]);
                            if (sCheck === true) {
                                var sPathRFID = "/RFIDTable/" + sPosRFID[0] + "/Rfid";
                                var sPathCant = "/RFIDTable/" + sPosRFID[0] + "/Cantidad";
                                this.getView().getModel("WoutJSON").setProperty(sPathRFID, mResult.text);
                                this.getView().getModel("WoutJSON").setProperty(sPathCant, parseInt(sPosRFID[0]) + 1);
                            } else {
                                var sMensaje = oResourceBundle.getText("textMessageRFIDRep");
                                var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                                MessageBox.error(sMensaje, {
                                    styleClass: bCompact ? "sapUiSizeCompact" : ""
                                });
                            }
                        }
                    }.bind(this),
                    function (Error) {

                    }.bind(this)
                );
            },

            onRFIDRead: function () {
                var that = this;
                this.getFragment("RFIDDialog").then(function (oFragment) {
                    var oRFIDTable = that.getView().getModel("WoutJSON");
                    oFragment.setModel(oRFIDTable);
                    oFragment.bindElement("/");
                    oFragment.open();
                });
            },

            onAppend: function (oEvent) {
                var InitRFID = $.extend(true, {}, this.getInitRFIDTable());
                var oList = oEvent.getSource();
                var sPath = "/RFIDTable";
                var aRFIDLine = oEvent.getSource().getBindingContext().getProperty(sPath);
                aRFIDLine.push(InitRFID)

                this.getFragment("RFIDDialog").then(function (oFragment) {
                    oFragment.getModel().setProperty(sPath, aRFIDLine);
                });
            },

            onDelete: function (oEvent) {
                var sPath = "/RFIDTable";
                var aRFIDLine = oEvent.getSource().getBindingContext().getProperty(sPath);
                var oTable = this.byId("id_TableRFID");
                var aTable = oTable.getSelectedContextPaths();
                var aTableOrg = this.getView().getModel("WoutJSON").getProperty("/RFIDTable");

                if (aTableOrg.length === 1) {
                    var oFiled = aTable[0].split("/");
                    var aTableUpd = [{
                        Cantidad: 0,
                        Rfid: ""
                    }];

                    oTable.removeSelections()
                    this.getView().getModel("WoutJSON").setProperty("/RFIDTable", aTableUpd);
                    return;
                }

                if (aTableOrg.length > 0) {

                    var oFiled = aTable[0].split("/");
                    var aTableUpd = [];
                    var j = 0;

                    for (var i = 0; i < aTableOrg.length; i++) {
                        if (i != oFiled[2]) {
                            j++;
                            var oLinea = $.extend(true, {}, aTableOrg[i]);
                            oLinea.Cantidad = j;
                            aTableUpd.push(oLinea);
                        }
                    };
                    oTable.removeSelections()
                    this.getView().getModel("WoutJSON").setProperty("/RFIDTable", aTableUpd);
                };

                this.getFragment("RFIDDialog").then(function (oFragment) {

                });
            },

            onCheckMatnrRFID: function (oEvent) {
                var sId = oEvent.getParameters().id;
                var oFiled = sId.split("-");
                var sPos = oFiled[oFiled.length - 1];
                var sCheck = this.validateRFID(oEvent.getSource().getValue(), sPos);
                if (sCheck === true) {

                } else {
                    var sId = oEvent.getParameters().id;
                    var oFiled = sId.split("-");
                    var sPathRFID = "/RFIDTable/" + oFiled[oFiled.length - 1] + "/Rfid";
                    var sPathCant = "/RFIDTable/" + oFiled[oFiled.length - 1] + "/Cantidad";
                    this.getView().getModel("WoutJSON").setProperty(sPathRFID, '');
                    this.getView().getModel("WoutJSON").setProperty(sPathCant, 0);
                    var sMensaje = oResourceBundle.getText("textMessageRFIDRep");
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    MessageBox.error(sMensaje, {
                        styleClass: bCompact ? "sapUiSizeCompact" : ""
                    });

                }
            },

            onChangeMatnrRFID: function (oEvent) {
                var oList = oEvent.getSource();
                if (oEvent.getSource().getValue() != "") {
                    var sId = oEvent.getParameters().id;
                    var oFiled = sId.split("-");
                    var sPath = "/RFIDTable/" + oFiled[oFiled.length - 1];
                    var sCont = parseInt(oFiled[oFiled.length - 1]) + 1;
                    var sPathPosition = sPath + "/Cantidad"
                    this.getFragment("RFIDDialog").then(function (oFragment) {
                        oFragment.getModel().setProperty(sPathPosition, sCont);
                    });
                }
            },

            onSalirRFID: function (oEvent) {
                this.getFragment("RFIDDialog").then(function (oFragment) {
                    oFragment.close();
                });
            },

            onAceptarRFID: function (oEvent) {
                var oTable = this.byId("id_TableRFID");
                var aTable = oTable.getSelectedContextPaths();
                var oList = oEvent.getSource();

                var aTableRFID = oEvent.getSource().getBindingContext().getProperty("/RFIDTable");
                var aTableOK = [];

                if (aTableRFID.length) {

                    for (var i = 0; i < aTableRFID.length; i++) {
                        if (aTableRFID[i].Rfid) {
                            var sTableRFID = $.extend(true, {}, aTableRFID[i]);
                            aTableOK.push(sTableRFID);
                        }
                    }

                    if (aTableOK.length) {
                        var sSelect = aTableOK[aTableOK.length - 1];
                        //this.getView().getModel("WoutJSON").setProperty('/RFIDCont', sSelect.Cantidad);
                        this.getView().getModel("WoutJSON").setProperty('/RFIDCont', aTableOK.length);
                    } else {
                        this.getView().getModel("WoutJSON").setProperty('/RFIDCont', 0);
                    }
                }

                this.getFragment("RFIDDialog").then(function (oFragment) {
                    oFragment.close();
                });

                this.handleEnabledSaveBtn();
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
                let matnrInput2 = this.getView().byId('matnrInput2');
                let productionOrder = this.getView().byId('productionOrder');
                let editView = this.getEditView();
                let messageMatOrden = oResourceBundle.getText("textMessageMatOrdenNot")

                toDay.setDate(toDay.getDate() - 1);

                oFilters.push(new Filter("Matnr", FilterOperator.EQ, matnr));
                //oFilters.push(new Filter("gstrs", FilterOperator.BT, toDay, Date()));
                oFilters.push(new Filter("werks", FilterOperator.EQ, woutModel.getProperty("/Plant")));
                oFilters.push(new Filter("arbpl", FilterOperator.EQ, woutModel.getProperty("/WorkCenter")));

                oModel.read(sPath, {
                    filters: oFilters,
                    success: function (oData) {
                        if (oData.results.length === 1) {
                            let prodOrder = oData.results[0].aufnr;
                            woutModel.setProperty('/Aufnr', prodOrder);
                            //14.11.2024 Grisado de Orden Product
                            //that.getView().getModel('ViewJSON').setProperty('/InputProductionOrder', true);
                            that.getView().getModel('ViewJSON').setProperty('/InputMaterial', false);
                            that.getView().getModel('ViewJSON').setProperty('/InputKunnr', true);
                            this.getView().getModel('ViewJSON').setProperty('/InputQuantity', true);
                            that.getView().getModel('ViewJSON').setProperty('/SelectPalletType', true);
                            that.handleEnabledSaveBtn();
                            that.getQuantityTFA(prodOrder);
                            this.getViewUM();
                            this.getCustomer();
                            this.getPalletType();
                        } else if (oData.results.length === 0) {
                            that.getView().getModel('ViewJSON').setProperty('/InputProductionOrder', true);
                            that.getView().getModel("WoutJSON").setProperty('/Aufnr', '');
                            that.handleEnabledSaveBtn();
                            var sMensaje = messageMatOrden;
                            var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                            MessageBox.error(sMensaje, {
                                styleClass: bCompact ? "sapUiSizeCompact" : ""
                            });
                        } else {
                            that.getView().getModel('ViewJSON').setProperty('/InputProductionOrder', true);
                            that.getView().getModel("WoutJSON").setProperty('/Aufnr', '');
                            that.handleEnabledSaveBtn();
                            this.getCustomer();
                        }
                    }.bind(this),
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
                let messageMatNotManufact = oResourceBundle.getText("textMessageMatNotManufact")
                let sWerks = this.getView().getModel('WoutJSON').getProperty("/Plant");
                let sWorkCenter = this.getView().getModel('WoutJSON').getProperty("/WorkCenter");

                var toDay = new Date();
                var toFinDay = new Date();
                var oFilters = [];
                toDay.setDate(toDay.getDate() - 1);

                oFilters.push(new Filter("plnbez", sap.ui.model.FilterOperator.EQ, pMatnr));
                oFilters.push(new Filter("werks", FilterOperator.EQ, sWerks));
                //oFilters.push(new Filter("gstrs", FilterOperator.BT, toDay, Date()));
                oFilters.push(new Filter("arbpl", FilterOperator.EQ, sWorkCenter));

                this.getView().getModel().read(sPath, {
                    filters: oFilters,
                    success: function (oData, response) {
                        if (oData.results.length == 0) {
                            this.getView().getModel("WoutJSON").setProperty('/OrdProduct', []);
                            this.getView().getModel("ViewJSON").setProperty("/InputProductionOrder", true);
                            var sMensaje = messageMatNotManufact;
                            var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                            MessageBox.warning(sMensaje, {
                                styleClass: bCompact ? "sapUiSizeCompact" : ""
                            });
                            this.getProdOrders(pMatnr);
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

                            if (sOrdProduct.length > 0) {

                            }
                            //this.getView().getModel("WoutJSON").setProperty("/Matnr", sMatnrR);
                            this.getView().getModel("WoutJSON").setProperty("/MatnrDesc", sMaktx);
                            this.getView().getModel("WoutJSON").setProperty('/OrdProduct', aOrdProduct);
                            this.getView().getModel("ViewJSON").setProperty("/InputProductionOrder", true);
                            this.cleanNotifications();
                            //this.getPalletType(sMatnrR);
                            this.getProdOrders(sMatnrR);
                        }

                    }.bind(this),
                    error: function (oError) {

                    }.bind(this),
                });
            },

            onCustomerType: function (oEvent) {
                var sPostx = oEvent.getParameters().selectedItem.getText();
                var sKunnr = oEvent.getParameters().selectedItem.getKey();
                this.getView().getModel("WoutJSON").setProperty("/CustomerTypeValue", sPostx);
                this.getView().getModel("WoutJSON").setProperty("/CustomerTypeId", sKunnr);
            },

            onPalletType: function (oEvent) {
                //var sPackno = oEvent.getParameters().selectedItem.getText();
                //var sPacknoKey = oEvent.getParameters().selectedItem.getKey();
                //this.getView().getModel("WoutJSON").setProperty("/PalletTypeValue", sPackno);
                //this.getView().getModel("WoutJSON").setProperty("/PalletTypeId", sPacknoKey);
                var sEmbalaje = oEvent.getParameters().selectedItem.getText();
                var sPackno = oEvent.getParameters().selectedItem.getKey();

                var aPalletType = this.getView().getModel("WoutJSON").getProperty("/PalletType")

                /* for (let index = 0; index < aPalletType.length; index++) {
                    if (aPalletType[index].packnrT === sPackno) {
                        var sPacknoKey = aPalletType[index].Position;
                        var sQuantity = aPalletType[index].Quantity;
                    }
                } */

                let sPos = oEvent.getSource().getSelectedIndex();                
                var sPacknoKey = aPalletType[sPos].Position;
                var sQuantity = aPalletType[sPos].Quantity;
                var sverid = aPalletType[sPos].verid;

                this.getView().getModel("WoutJSON").setProperty("/PalletTypeValue", sPackno);
                this.getView().getModel("WoutJSON").setProperty("/PalletTypeId", sPacknoKey);
                this.getView().getModel("WoutJSON").setProperty("/Embalaje", sEmbalaje);
                this.getView().getModel("WoutJSON").setProperty("/Quantity", sQuantity);
                this.getView().getModel("WoutJSON").setProperty("/Verid", sverid);
                this.getQuantity(sPackno, sPacknoKey);
            },

            getQuantity: function (pPackno, sPacknoKey) {

                /* var sInputRFD = this.getView().getModel("ViewJSON").getProperty("/InputRFID");
                //if (sInputRFD == true) {
                var sPath = "/Quantity";
                //} else {
                //    sPath = "/QuantitySRFID";
                //}

                var oFilters = [];

                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                //var sPacknoKeyGuid = 'Guid(' + sPacknoKey + ')';
                oFilters.push(new sap.ui.model.Filter("matnr", sap.ui.model.FilterOperator.Contains, sMatnr));
                oFilters.push(new sap.ui.model.Filter("pobjid", sap.ui.model.FilterOperator.EQ, pPackno));
                //oFilters.push(new sap.ui.model.Filter("packnr2", sap.ui.model.FilterOperator.EQ, sPacknoKey));

                this.getView().getModel().read(sPath, {
                    filters: oFilters,
                    success: function (oData, response) {
                        if (oData.results.length > 0) {
                            //this.getView().getModel("WoutJSON").setProperty("/Quantity", oData.results[0].trgqty);
                            //if (sInputRFD == true) {
                            //    this.getView().getModel("WoutJSON").setProperty("/Quantity", oData.results[0].trgqty);
                            //} else {
                            this.getView().getModel("WoutJSON").setProperty("/Quantity", oData.results[0].trgqty);
                            //}

                            this.getView().getModel("ViewJSON").setProperty("/QuantityTable", oData.results);
                        } else {

                            sPath = "/QuantitySRFID";

                            this.getBack(sPath, oFilters).then(function (oData2) {
                                if (oData2.results.length > 0) {
                                    this.getView().getModel("WoutJSON").setProperty("/Quantity", oData2.results[0].trgqty);
                                }
                            }.bind(this)).catch((oError) => {

                            });
                        }
                    }.bind(this),
                    error: function (oError) {

                    }.bind(this),
                }); */
            },

            //getPalletType: function (pMatnr) {
            getPalletType: function () {
                let that = this;
                var sPath = "/PalletType";
                var oFilters = [];
                var sWerks = this.getView().getModel("WoutJSON").getProperty("/Plant");
                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                var sAufnr = this.getView().getModel("WoutJSON").getProperty("/Aufnr");
                let woutJson = this.getView().getModel("WoutJSON");

                //oFilters.push(new sap.ui.model.Filter("matnr", sap.ui.model.FilterOperator.EQ, pMatnr));
                oFilters.push(new sap.ui.model.Filter("aufnr", sap.ui.model.FilterOperator.EQ, sAufnr));
                oFilters.push(new sap.ui.model.Filter("matnr", sap.ui.model.FilterOperator.EQ, sMatnr));
                oFilters.push(new sap.ui.model.Filter("werks", sap.ui.model.FilterOperator.EQ, sWerks));

                this.getView().getModel().read(sPath, {
                    filters: oFilters,
                    success: function (oData, response) {

                        if (oData.results.length === 0) {
                            MessageBox.warning(oResourceBundle.getText('textErrorPalletNotAssigned'));
                            woutJson.setProperty('/Quantity', 0);
                            woutJson.setProperty('/PalletType', {});
                            woutJson.setProperty('/Kunnr', '');
                            return;
                        }
                        var sPalletType = $.extend(true, {}, this.getSPalletType());
                        var aPalletType = [];
                        var aPalletType_ind = [];

                        for (var i = 0; i < oData.results.length; i++) {
                            if (oData.results[i].FlagDefault === 'X') {
                                var sResutl = $.extend(true, {}, oData.results[i]);
                                sPalletType.packnrT = sResutl.pobjid;
                                sPalletType.Position = sResutl.packnrT;
                                sPalletType.Embalaje = sResutl.matnr1;
                                sPalletType.Quantity = sResutl.trgqty;
                                sPalletType.verid = sResutl.verid;                                
                                aPalletType.push($.extend(true, {}, sPalletType));
                            } else {
                                var sResutl = $.extend(true, {}, oData.results[i]);
                                sPalletType.packnrT = sResutl.pobjid;
                                sPalletType.Position = sResutl.packnrT;
                                sPalletType.Embalaje = sResutl.matnr1;
                                sPalletType.Quantity = sResutl.trgqty;
                                sPalletType.verid = sResutl.verid;
                                aPalletType_ind.push($.extend(true, {}, sPalletType));
                            }
                        };

                        for (let index = 0; index < aPalletType_ind.length; index++) {
                            var sResutl = $.extend(true, {}, aPalletType_ind[index]);
                            sPalletType.packnrT = sResutl.packnrT;
                            sPalletType.Position = sResutl.Position;
                            sPalletType.Embalaje = sResutl.Embalaje;
                            sPalletType.Quantity = sResutl.Quantity;
                            sPalletType.verid = sResutl.verid;
                            aPalletType.push($.extend(true, {}, sPalletType));
                        }

                        this.getView().getModel("WoutJSON").setProperty('/Verid', aPalletType[0]?.verid);
                        this.getView().getModel("WoutJSON").setProperty('/Embalaje', aPalletType[0]?.Embalaje);
                        this.getView().getModel("WoutJSON").setProperty('/Quantity', aPalletType[0]?.Quantity);
                        this.getView().getModel("WoutJSON").setProperty('/PalletType', aPalletType);
                        this.getView().getModel("WoutJSON").setProperty("/PalletTypeValue", aPalletType[0]?.packnrT);
                        this.getView().getModel("WoutJSON").setProperty("/PalletTypeId", aPalletType[0]?.Position);

                        if (oData.results.length > 0) {
                            this.getQuantity(oData.results[0].pobjid, oData.results[0].packnrT);
                        }
                        this.handleEnabledSaveBtn();
                        //this.getProdOrders(pMatnr);

                    }.bind(this),
                    error: function (oError) {

                    }.bind(this),
                });
            },

            visCustomer: function () {
                var sPlant = this.getView().getModel("WoutJSON").getProperty("/Plant");

                if (sPlant === 'ES10' || sPlant === 'ES20' || sPlant === 'PT10') {
                    this.getView().getModel("ViewJSON").setProperty('/InputCustomer', true);
                } else {
                    this.getView().getModel("ViewJSON").setProperty('/InputCustomer', false);
                }
            },

            getCustomer: function () {
                var sPlant = this.getView().getModel("WoutJSON").getProperty("/Plant");

                if (sPlant === 'ES10' || sPlant === 'ES20' || sPlant === 'PT10') {

                    if (sPlant === 'ES10' || sPlant === 'ES20') {
                        var sPLantfilter = 'ES10';
                    } else if (sPlant === 'PT10') {
                        sPLantfilter = sPlant;
                    }

                    var sAufnr = this.getView().getModel("WoutJSON").getProperty("/Aufnr");
                    var sPath = "/CustomerList";
                    var aFilter = [];
                    aFilter.push(new sap.ui.model.Filter("aufnr", sap.ui.model.FilterOperator.EQ, sAufnr));
                    aFilter.push(new sap.ui.model.Filter("vkorg", sap.ui.model.FilterOperator.EQ, sPLantfilter));

                    this.getBack(sPath, aFilter).then(function (oData) {
                        let aCustomer = [];
                        for (var i = 0; i < oData.results.length; i++) {
                            var sResults = $.extend(true, {}, oData.results[i]);
                            let sCustomer = $.extend(true, {}, this.getCustomerType());
                            sCustomer.Postx = sResults.postx;
                            sCustomer.Kunnr = sResults.kunnr;
                            sCustomer.Texto = sResults.kunnr + " - " + sResults.postx;
                            aCustomer.push($.extend(true, {}, sCustomer));
                        };
                        let sCustomer = $.extend(true, {}, this.getCustomerType());
                        sCustomer.Postx = '';
                        sCustomer.Kunnr = '';
                        aCustomer.push($.extend(true, {}, sCustomer));

                        let sId = this.getView().getId() + "--idCustomerList";
                        sap.ui.getCore().byId(sId).clearSelection();
                        this.getView().getModel("WoutJSON").setProperty('/Customer', aCustomer);
                        //this.getView().getModel("WoutJSON").setProperty("/CustomerTypeValue", aCustomer[0]?.Postx);
                        //this.getView().getModel("WoutJSON").setProperty("/CustomerTypeId", aCustomer[0]?.Kunnr);
                        this.getView().getModel("WoutJSON").setProperty("/CustomerTypeValue", sCustomer.Postx);
                        this.getView().getModel("WoutJSON").setProperty("/CustomerTypeId", sCustomer.Kunnr);

                    }.bind(this)).catch((oError) => {

                    });
                }
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
                let messageOrdNotReleased = oResourceBundle.getText("textMessageOrdNotReleased")

                this.getView().getModel().read(sPath, {
                    success: function (oData, response) {
                        if (oData.gstrs > oData.fecha) {
                            sMensaje = messageOrdNotReleased;
                            MessageBox.warning(sMensaje, {
                                styleClass: bCompact ? "sapUiSizeCompact" : ""
                            });
                        } else {
                            if (oData.objnr == '') {
                                sMensaje = messageOrdNotReleased;
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

                    }.bind(this)
                );
            },

            onValueHelpKunnr: function (oEvent) {
                var that = this;
                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                var oFilters = [];
                oFilters.push(new sap.ui.model.Filter("Matnr", FilterOperator.EQ, sMatnr));

                that.getFragment("CustomerDialog").then(function (oFragment) {
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
                var sWerks = this.getView().getModel("WoutJSON").getProperty("/Plant");
                var oFilters = [];
                var sMensaje;

                oFilters.push(new sap.ui.model.Filter("arbpl", FilterOperator.EQ, sArbpl));
                oFilters.push(new sap.ui.model.Filter("werks", FilterOperator.EQ, sWerks));

                this.getFragment("MatnrDialog").then(function (oFragment) {
                    oFragment.getTableAsync().then(function (oTable) {
                        sMensaje = oResourceBundle.getText("textButtonCancel");
                        oFragment.getButtons()[1].setText(sMensaje);
                        //sMensaje = oResourceBundle.getText("textBarFilter");
                        //oFragment.getFilterBar()._oToolbar.mAggregations.content[3].setText(sMensaje);
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

                let aTokens = oEvent.getParameter("tokens");
                let matDescription = aTokens[0].getCustomData()[0].getValue().maktx;

                this.getView().getModel("WoutJSON").setProperty("/MatnrDesc", matDescription);

                //this.getPalletType(sMatnr);
                this.getProdOrders(sMatnr);

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

                var sFin = toFinDay.getFullYear() + "/" + sMesFin + "/" + toFinDay.getDate();
                var sInit = toDay.getFullYear() + "/" + sMesInit + "/" + toDay.getDate();
                var SDesHasta = sInit + " - " + sFin;

                oFilters.push(new Filter("Matnr", FilterOperator.EQ, sMatnr));
                //oFilters.push(new Filter("gstrs", FilterOperator.BT, toDay, Date()));
                oFilters.push(new Filter("arbpl", FilterOperator.EQ, sWorkCenter));
                oFilters.push(new Filter("werks", FilterOperator.EQ, sPlant));

                that.getFragment("ProductionOrDialog").then(function (oFragment) {
                    let oTable = that.getView().byId('prodOrTable');
                    oTable.setModel(new JSONModel({}), 'pOrData');
                    oTable.setBusy(true);
                    //that.byId("DRS2").setValue(SDesHasta);
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
                                    sbmng: item.SBMNG,
                                    porcentaje: item.Porcentaje,
                                    objnr: item.objnr,
                                    fecha_gsuzs: item.fecha_gsuzs
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
                let that = this;
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
                var sPlant = this.getView().getModel("WoutJSON").getProperty("/Plant");
                aFilters.push(new sap.ui.model.Filter("Matnr", FilterOperator.EQ, sMatnr));
                aFilters.push(new sap.ui.model.Filter("arbpl", FilterOperator.EQ, sWorkCenter));
                aFilters.push(new sap.ui.model.Filter("werks", FilterOperator.EQ, sPlant));

                this.getFragment("ProductionOrDialog").then(function (oFragment) {
                    let oTable = that.getView().byId('prodOrTable');
                    oTable.setModel(new JSONModel({}), 'pOrData');
                    oTable.setBusy(true);
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
                                    sbmng: item.SBMNG,
                                    porcentaje: item.Porcentaje,
                                    objnr: item.objnr,
                                    fecha_gsuzs: item.fecha_gsuzs
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
                var aTokens = oEvent.getParameter("tokens")
                var sAufnr = aTokens[0].getKey();
                this.setAufnr(sAufnr);
                this.getPalletType();
            },

            onChangeAufnr: function (oEvent) {
                var sAufnr = this.getView().getModel("WoutJSON").getProperty("/Aufnr");
                this.setAufnr(sAufnr);
                this.getCustomer();
                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                this.getPalletType();
                var sPackno = this.getView().getModel("WoutJSON").getProperty("/PalletTypeValue");
                var sPacknoKey = this.getView().getModel("WoutJSON").getProperty("/PalletTypeId");
                this.getQuantity(sPackno, sPacknoKey);
            },

            setAufnr: function (sAfunr) {
                this.getView().getModel("WoutJSON").setProperty("/Aufnr", sAfunr);

                this.getOfCloseField(sAfunr);
                this.getQuantityTFA(sAfunr);
                this.getView().getModel('ViewJSON').setProperty('/InputMaterial', false);
                this.getView().getModel('ViewJSON').setProperty('/InputQuantity', true);
                this.getView().getModel('ViewJSON').setProperty('/SelectPalletType', true);
                this.getView().getModel('ViewJSON').setProperty('/InputKunnr', true);
                this.handleEnabledSaveBtn();
                this.getViewUM();
                this.getView().getModel('ViewJSON').setProperty('/InputProductionOrder', false);
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
                //24.11.2024 Grisar el campo
                this.getView().getModel('ViewJSON').setProperty('/InputProductionOrder', false);
                this.getView().getModel('ViewJSON').setProperty('/InputQuantity', true);
                this.getView().getModel('ViewJSON').setProperty('/SelectPalletType', true);
                this.getView().getModel('ViewJSON').setProperty('/InputKunnr', true);
                this.handleEnabledSaveBtn();
                this.getViewUM();
                this.getCustomer();
                this.getPalletType();
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
                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                var sAufnr = this.getView().getModel("WoutJSON").getProperty("/Aufnr");
                var sLgnum = this.getView().getModel("WoutJSON").getProperty("/Plant");

                var oParameter =
                {
                    "Sernr": sUm,
                    "Matnr": sMatnr,
                    "Aufnr": sAufnr,
                    "Lgnum": sLgnum
                };

                this.getSernrBack(sPath, oParameter).then(function (oData) {
                    this.getView().getModel("WoutJSON").setProperty("/SernrUm", oData.Sernr);
                    this.getView().getModel("WoutJSON").setProperty("/BatchUm", oData.Batch);
                    this.getView().getModel('ViewJSON').setProperty('/SaveBtnEnabled', true);
                }.bind(this)).catch((oError) => {
                    this.getView().getModel('ViewJSON').setProperty('/SaveBtnEnabled', false);
                    var JSError = JSON.parse(oError.responseText);
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    var sMensaje = JSError.error.message.value;
                    MessageBox.error(sMensaje, {
                        styleClass: bCompact ? "sapUiSizeCompact" : ""
                    });
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
                        },
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
                            "label": "{i18n>textMaterial}",
                            "template": "plnbez"
                        },
                        {
                            "label": "{i18n>textItemNameOrg}",
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
                // var sPath = "/Quantity";
                // var oFilters = [];

                // var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                // oFilters.push(new sap.ui.model.Filter("matnr", sap.ui.model.FilterOperator.Contains, sMatnr));

                // this.getView().getModel().read(sPath, {
                //     filters: oFilters,
                //     success: function (oData, response) {
                //         if (oData.results.length > 0) {
                //             this.getView().getModel("WoutJSON").setProperty("/Quantity", oData.results[0].trgqty);
                //             this.getView().getModel("ViewJSON").setProperty("/QuantityTable", oData.results);
                //         }
                //     }.bind(this),
                //     error: function (oError) {

                //     }.bind(this),
                // });
            },

            handleEnabledSaveBtn: function () {
                let viewModel = this.getView().getModel('WoutJSON');
                let matInput = viewModel.getProperty('/Matnr');
                let prodOrderInput = viewModel.getProperty('/Aufnr');
                let quantityInput = viewModel.getProperty('/Quantity');
                let palletType = viewModel.getProperty('/PalletTypeValue');
                var sInputRFD = this.getView().getModel("ViewJSON").getProperty("/InputRFID");

                if (sInputRFD === false) {
                    if (!matInput || !prodOrderInput || !palletType) {
                        this.getView().getModel('ViewJSON').setProperty('/SaveBtnEnabled', false);
                        return;
                    }
                } else {
                    var rfid = viewModel.getProperty('/RFIDTable')[0].Rfid;
                    if (!matInput || !prodOrderInput || !palletType || !rfid) {
                        this.getView().getModel('ViewJSON').setProperty('/SaveBtnEnabled', false);
                        return;
                    }
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
                var sQuantity = this.getView().getModel("WoutJSON").getObject("/Quantity");
                var sMensaje;
                var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                var that = this;
                let errorMessageQuantityExceeds = oResourceBundle.getText("textErrorMessageQuantityExceeds")

                for (var i = 0; i < oQuantity.length; i++) {
                    if (parseInt(oQuantity[i].trgqty) >= parseInt(sQuantity)) {
                        return;
                    } else {
                        sMensaje = errorMessageQuantityExceeds;
                        MessageBox.error(sMensaje, {
                            styleClass: bCompact ? "sapUiSizeCompact" : ""
                        });
                    }
                };
            },

            onCheckQuantity: function (oEvent) {
                //var sRFID = this.getView().getModel("ViewJSON").getProperty("/InputRFID")
                //if (sRFID == true) {
                var sQuantity = oEvent.getParameters().value;
                var sPalletTypeValue = this.getView().getModel("WoutJSON").getProperty("/PalletTypeId");

                this.getValQuantityPol(sPalletTypeValue, sQuantity).then(function (oData) {

                }.bind(this)).catch((oError) => {
                    var JSError = JSON.parse(oError.responseText);
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    var sMensaje = JSError.error.message.value;
                    MessageBox.error(sMensaje, {
                        styleClass: bCompact ? "sapUiSizeCompact" : ""
                    });
                })
                //}
            },

            getValQuantityPol: function (sPallet, sQuantity) {
                var sPath = "/Z_ValQuantityPal";
                var sVerid = this.getView().getModel("WoutJSON").getProperty("/Verid");
                var sPlant = this.getView().getModel("WoutJSON").getProperty("/Plant");
                var sWorkCenter = this.getView().getModel("WoutJSON").getProperty("/WorkCenter");
                var sobjek = sPlant + sWorkCenter;
                var iQuantity = parseInt(sQuantity).toFixed(3)
                //var oParameter = { "Packnr": sPallet, "Cantidad": iQuantity, "Objek": sobjek };
                var sMatnr1 = this.getView().getModel("WoutJSON").getProperty("/Embalaje");
                var sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");

                var oParameter = {
                    "Cantidad": iQuantity,
                    "Matnr": sMatnr,
                    "Matnr1": sMatnr1,
                    "Objek": sobjek,
                    "Packnr": sPallet
                };

                return new Promise(function (resolve, reject) {
                    this.getView().getModel("ZDOM_0000_SRV_01").callFunction(sPath, {
                        method: "GET",
                        urlParameters: oParameter,
                        success: resolve,
                        error: reject
                    });
                }.bind(this));
            },

            getValStock: function (sAufnr, sQuantity) {
                let errorMessageQuantMand = oResourceBundle.getText("textErrorQuantityEmpty");
                let sWerks = this.getView().getModel("WoutJSON").getProperty("/Plant");
                let sMatnr = this.getView().getModel("WoutJSON").getProperty("/Matnr");
                let sPacknr = this.getView().getModel("WoutJSON").getProperty("/PalletTypeValue");

                if (!sQuantity) {
                    MessageBox.error(errorMessageQuantMand);
                    return;
                }

                var sPath = "/ZFI_CHECK_AVAILABLE_STOCK";
                var iQuantity = parseInt(sQuantity).toFixed(3)
                var oParameter = 
                { 
                    "Aufnr": sAufnr, 
                    "Quantity": iQuantity, 
                    "Werks":  sWerks,
                    "Matnr":  sMatnr,
                    "Packnr":  sPacknr,
                };

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
                var sQuantity = this.getView().getModel("WoutJSON").getObject("/Quantity");
                var sMensaje;
                var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                var that = this;

                var sPalletTypeValue = this.getView().getModel("WoutJSON").getProperty("/PalletTypeValue");
                let erroMessagePalletMand = oResourceBundle.getText("textMessagePaletMandatory")

                if (sPalletTypeValue == '') {
                    MessageBox.error(erroMessagePalletMand);
                    return;
                }

                var sAufnr = this.getView().getModel("WoutJSON").getProperty("/Aufnr");
                var sQuantity = this.getView().getModel("WoutJSON").getProperty("/Quantity");

                this.getValStock(sAufnr, sQuantity).then(function (oData) {

                    if (oData.results.length > 0) {
                        for (var i = 0; i < oData.results.length; i++) {
                            if (oData.results[0].Type == 'E') {
                                this.getFragment("QuantityDialog").then(function (oFragment) {
                                    // var oRFIDTable = that.getView().getModel("WoutJSON");
                                    // oFragment.setModel(oRFIDTable);
                                    // oFragment.bindElement("/");
                                    oFragment.open();
                                });
                                return;
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
                let oModelEditView = this.getView().getModel('ViewJSON');
                let initialEditView = this.getEditView();

                modelData.Operario = oModelData.Operario;
                modelData.WorkCenter = oModelData.WorkCenter;
                modelData.Plant = oModelData.Plant;
                modelData.ktext = oModelData.ktext;

                oModel.setData(modelData);
                oModelEditView.setData(initialEditView);
                this.visRFID();
            },

            cleanNotifications: function () {
                this.getView().getModel('message').setProperty('/messageLength', '');
                this.getView().getModel('message').setProperty('/type', 'Default');
                oMessagePopover.getModel().setData({});

                this.getView().getModel('ViewJSON').setProperty('/InputQuantity', false);
                this.getView().getModel('ViewJSON').setProperty('/SelectPalletType', false);
                this.getView().getModel('ViewJSON').setProperty('/InputKunnr', false);
            },

            onReject: function () {
                var that = this;
                let oModel = this.getView().getModel('WoutJSON');
                let oModelData = this.getView().getModel('WoutJSON').getObject('/');
                let modelData = this.getInitialWout();

                let oModelEditView = this.getView().getModel('ViewJSON');
                let initialEditView = this.getEditView();
                let messageCancelProduction = oResourceBundle.getText("textMessageCancelProduction")
                let messageCancelOper = oResourceBundle.getText("textMessagePopUpCancel");

                modelData.Operario = oModelData.Operario;
                modelData.WorkCenter = oModelData.WorkCenter;
                modelData.Plant = oModelData.Plant;
                modelData.ktext = oModelData.ktext;

                MessageBox.show(messageCancelProduction, {
                    icon: MessageBox.Icon.WARNING,
                    title: messageCancelOper,
                    actions: ["YES", "NO"],
                    emphasizedAction: "YES",
                    onClose: async function (oAction) {
                        if (oAction === 'YES') {
                            oModel.setData(modelData);
                            oModelEditView.setData(initialEditView);
                            this.ClearMessage();
                            that.visRFID();
                        } else {
                            sap.m.MessageToast.show(messageCancelOper);
                        }
                    }.bind(this),
                })
            },

            ClearMessage: function () {
                let popModel = new JSONModel({});
                oMessagePopover.setModel(popModel);
                this.getView().getModel('message').getData().messageLength = "";
                this.getView().getModel('message').getData().type = "Default";
                this.getView().getModel('message').refresh()
                oMessagePopover.getModel().refresh(true);
            },
            // Inic. Guardar Product
            postSave: function () {
                var that = this;
                var sMensaje;
                var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                var sBusy = oResourceBundle.getText('textProcessingSave');
                var busyDialog4 = (sap.ui.getCore().byId("busy4")) ? sap.ui.getCore().byId("busy4") : new sap.m.BusyDialog('busy4', {
                    title: sBusy
                });
                this.ClearMessage();
                var oPostProduct = this.getInitPost();
                var sProduct = this.getInitProduct();

                var oWoutJSON = this.getView().getModel("WoutJSON").getObject("/");
                var oViewJSON = this.getView().getModel('ViewJSON');
                let errorMessageCancelOper = oResourceBundle.getText("textErrorQuantityEmpty")
                let errorMessageRfid = oResourceBundle.getText("textErrorMessageRfid")

                if (oWoutJSON.Quantity == 0) {
                    MessageBox.error(errorMessageCancelOper);
                    return;
                }
                //Se comenta 02/12/2024
                // if (oViewJSON.getProperty("/InputUM") == true) {
                //     if (!oWoutJSON.SernrUm) {
                //         let errorMessageSernrUm = oResourceBundle.getText("textErrorSernrUm")
                //         MessageBox.error(errorMessageSernrUm);
                //         return;
                //     }
                // }

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
                sProduct.Batch = oWoutJSON.BatchUm;
                sProduct.Um = oWoutJSON.Um;
                sProduct.SernrUm = oWoutJSON.SernrUm;
                sProduct.Lifnr = oWoutJSON.CustomerTypeId;
                sProduct.Cantidad = parseInt(oWoutJSON.Quantity).toFixed(3);
                sProduct.Impregpart = oWoutJSON.Impregpart;
                sProduct.ConfText = oWoutJSON.Reason;
                sProduct.FlagUM = oWoutJSON.FlagUM;
                oPostProduct.ProductionDeclarationSet.push($.extend(true, {}, sProduct));

                var sInputRFD = this.getView().getModel("ViewJSON").getProperty("/InputRFID");
                if (sInputRFD == true) {
                    if (oWoutJSON.RFIDTable[0].Rfid === '') {
                        // No carga la tabla 
                        MessageBox.error(errorMessageRfid);
                        return
                    } else {
                        for (var i = 0; i < oWoutJSON.RFIDTable.length; i++) {
                            var sRfid = $.extend(true, {}, oWoutJSON.RFIDTable[i]);
                            var sSRfid = $.extend(true, {}, this.getSRfid());
                            sSRfid.Rfid = sRfid.Rfid;
                            oPostProduct.SRfidSet.push(sSRfid);
                        }
                    }
                }

                busyDialog4.open();

                var sMensaje;
                var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                let errorMessageUnexpected = oResourceBundle.getText("textMessageUnexpected")

                this.getView().getModel("ZDOM_0000_SRV_01").create('/HeaderSet', oPostProduct, {
                    success: function (oData, oResponse) {
                        if (oData.ReturnSet.results.length === 0) {
                            MessageBox.error(errorMessageUnexpected);
                            busyDialog4.close();
                            that.getView().getModel('ViewJSON').setProperty('/InputProductionOrder', true);
                            that.getView().getModel('ViewJSON').setProperty('/InputMaterial', true);

                            return;
                        }

                        if (oData.ReturnSet.results.length > 0) {
                            for (var i = 0; i < oData.ReturnSet.results.length; i++) {
                                if (oData.ReturnSet.results[i].Type == 'E'
                                    || oData.ReturnSet.results[i].Type == 'W') {
                                    errorMessageUnexpected = oResourceBundle.getText("textMessagePostSave");
                                    MessageBox.warning(errorMessageUnexpected);
                                    break;
                                }
                            }
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
                                //oViewJSON.setProperty('/InputProductionOrder', false);
                                that.cleanScreen();
                            }
                        })

                        busyDialog4.close();
                    }.bind(this),
                    error: function (oError, oResponse) {

                        var oMessage = JSON.parse(oError.responseText).error.message.value;
                        //MessageBox.error(oMessage);
                        let msgsArr = [];
                        msgsArr.push({
                            T: this.setMessageType('E'),
                            S: oMessage
                        })

                        let prevMsgs = Array.from(oMessagePopover.getModel().getData());
                        let upDatedMsgs = [...prevMsgs, ...msgsArr];
                        oMessagePopover.getModel().setData(upDatedMsgs);
                        oMessagePopover.getModel().refresh(true);
                        that.getView().getModel('message').getData().messageLength = upDatedMsgs.length;
                        that.getView().getModel('message').getData().type = "Emphasized";
                        that.getView().getModel('message').refresh(true);
                        busyDialog4.close();
                        errorMessageUnexpected = oResourceBundle.getText("textMessagePostSave");
                        MessageBox.warning(errorMessageUnexpected);

                    }.bind(this),
                });
            },

            onSave: function (oEvent) {
                //this.validateQuantity();

                //var sRFID = this.getView().getModel("ViewJSON").getProperty("/InputRFID")
                //if (sRFID == true) {
                var sQuantity = this.getView().getModel("WoutJSON").getProperty("/Quantity");
                var sPalletTypeValue = this.getView().getModel("WoutJSON").getProperty("/PalletTypeId");


                this.getValQuantityPol(sPalletTypeValue, sQuantity).then(function (oData) {
                    this.validateQuantity();
                }.bind(this)).catch((oError) => {
                    var JSError = JSON.parse(oError.responseText);
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    var sMensaje = JSError.error.message.value;
                    MessageBox.error(sMensaje, {
                        styleClass: bCompact ? "sapUiSizeCompact" : ""
                    });
                })
                //}
            },
            // Fin Guardar Product

            handleMessagePopoverPress: function (oEvent) {
                oMessagePopover.toggle(oEvent.getSource());
            },

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
                    Embalaje: " ",
                    Quantity: " ",
                    verid: " ",
                }
            },

            getCustomerType: function () {
                return {
                    Kunnr: "",
                    Postx: "",
                    Texto: ""
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
                    SaveBtnEnabled: false,
                    InputRFID: false,
                }
            },

            getInitialWout: function () {
                return {
                    Operario: "",
                    Plant: "",
                    WorkCenter: "",
                    Matnr: "",
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
                    BatchUm: "",
                    Name_org1: "",
                    PalletTypeValue: "",
                    PalletTypeId: "",
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
                    RFIDTable: [this.getInitRFIDTable()],
                    ReturnSet: [

                    ]
                }
            },

            getSRfid: function () {
                return {
                    Rfid: ""
                }
            },

            getInitRFIDTable: function () {
                return {
                    Cantidad: 0,
                    Rfid: "",
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
                    SernrUm: "",
                    Um: "",
                    Declarquantity: false,
                    Ofclosing: false,
                    Impregpart: false,
                    Unidad: "",
                    FlagUM: false
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
            }

        });
    });
