sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    'sap/ndc/BarcodeScanner',
    "sap/ui/model/resource/ResourceModel",
    "sap/ui/core/Fragment",
    'sap/ui/model/Filter',
    'sap/ui/model/FilterOperator',
    "sap/m/MessagePopover",
    "sap/m/MessagePopoverItem",
    "sap/m/MessageBox"
],
    function (Controller, JSONModel, BarcodeScanner, ResourceModel, Fragment, Filter, FilterOperator, MessagePopover, MessagePopoverItem, MessageBox) {
        "use strict";

        let oResourceBundle;
        let temporalMovements = [];

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

        return Controller.extend("production.controller.Protos", {
            oFragments: {},

            onInit: function () {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("RouteProtos").attachMatched(this._onHandleRouteMatched, this);

                //Set i18n Model Main View
                const i18nModel = new ResourceModel({
                    bundleName: "production.i18n.i18n"
                });
                this.getView().setModel(i18nModel, "i18n");

                oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

                let GoodMovements = new JSONModel();
                this.getView().setModel(GoodMovements, 'GoodMovements');

                let temporalMovements = new JSONModel();
                this.getView().setModel(temporalMovements, 'TemporalMovements');

                let message = new JSONModel({
                    messageLength: "",
                    type: "Default"
                });

                this.getView().setModel(message, "message");
                let popModel = new JSONModel({});
                oMessagePopover.setModel(popModel);
            },

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

            getProdOrder: function (oEvent) {
                this.cleanViewData();
                let that = this;
                let pOrder = oEvent.getParameters().value;
                let matnrInput = this.getView().byId('Matnr');
                let prodOrds = this.getView().getModel("WoutJSON").getProperty("/OrdProduct");
                let oModel = this.getView().getModel();
                let oModelEditView = this.getView().getModel('ViewJSON');
                let oFilters = [new Filter('aufnr', FilterOperator.EQ, `000${pOrder}`)];

                if (prodOrds.length === 1) {
                    oModel.read('/MaterialOperation', {
                        filters: oFilters,
                        success: function (oData) {
                            if (oData.results.length === 0) {
                                MessageBox.error(oResourceBundle.getText('texterrorProductionForLine'));
                                that.getView().getModel("WoutJSON").setProperty('/Matnr', '');
                                that.getView().getModel("WoutJSON").setProperty('/MaterialDescription', '');
                                that.cleanNotifications();
                                return;
                            }

                            matnrInput.setValue(oData.results[0]?.plnbez);
                            that.getView().getModel("WoutJSON").setProperty('/MaterialDescription', oData.results[0]?.maktx);
                            oModelEditView.setProperty('/InputOperation', true);
                            oModelEditView.setProperty('/OperationScanBtn', true);
                            that.cleanNotifications();
                        },
                        error: function (error) {
                            MessageBox.error(oResourceBundle.getText('texterrorProductionForLine'));
                        }
                    })
                }
            },

            getMatnrData: function (oMatnr) {
                let that = this;
                let matnrInput = this.getView().byId('Matnr');
                let prodOrds = this.getView().getModel("WoutJSON").getProperty("/OrdProduct");
                let oModel = this.getView().getModel();
                let oFilters = [new Filter('aufnr', FilterOperator.EQ, `000${oMatnr}`)];

                if (prodOrds.length === 1) {
                    oModel.read('/MaterialOperation', {
                        filters: oFilters,
                        success: function (oData) {
                            //console.log(oData)
                            matnrInput.setValue(oData.results[0]?.plnbez);
                            that.getView().getModel("WoutJSON").setProperty('/MaterialDescription', oData.results[0]?.maktx);
                            that.cleanNotifications();
                        },
                        error: function (error) {
                            //console.log(error)
                        }
                    })
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

            checkOperationSt: function (operation) {
                let oModel = this.getView().getModel();
                let orderId = this.getView().getModel('WoutJSON').getProperty('/Aufnr');
                let oFilters = [new Filter('OrderId', FilterOperator.EQ, orderId), new Filter('OperationCode', FilterOperator.EQ, operation)];

                return new Promise(function (resolve, reject) {
                    oModel.read('/OperationSt', {
                        filters: oFilters,
                        success: function (oData) {
                            if (oData.results.length === 0) {
                                resolve(false); // Matnr no existe
                            } else {
                                resolve(true);  // Matnr existe
                            }
                        },
                        error: function (oError) {
                            reject(oError);
                        }
                    });
                });
            },

            getGoodMovements: function () {
                let that = this;
                let prodOrder = this.getView().getModel('WoutJSON').getProperty('/Aufnr');
                let operationCode = this.getView().getModel('WoutJSON').getProperty('/Operation');
                let quantityToDecInput = this.getView().byId('quantityToDec')
                let quantityToDecInputValue = this.getView().byId('quantityToDec').getValue();
                let oModel = this.getView().getModel('ZDOM_0000_SRV_01');
                let goodMovementsModel = this.getView().getModel('GoodMovements');
                let oModelEditView = this.getView().getModel('ViewJSON');
                let oTable = this.getView().byId('consumptionTable');
                temporalMovements = [];

                this.checkOperationSt(operationCode).then(operationExist => {
                    if (!operationExist) {
                        MessageBox.error(oResourceBundle.getText('texterrorLineForProduction'));
                        return;
                    }

                    oTable.setBusy(true);
                    let aFilters = [new Filter('Orderid', FilterOperator.EQ, prodOrder), new Filter('Operation', FilterOperator.EQ, operationCode)];
                    aFilters.push(new Filter('Yield', FilterOperator.EQ, !quantityToDecInputValue ? 0 : quantityToDecInputValue));
                    let oParameters = {
                        urlParameters: {
                            "$expand": "GoodMovementsSet"
                        }
                    };

                    oModel.read('/ProductOperationsSet', {
                        urlParameters: oParameters.urlParameters,
                        filters: aFilters,
                        success: function (oData) {
                            if (oData.results.length === 0) {
                                oTable.setBusy(false);
                                return;
                            }

                            let goodMovementsData = [];
                            let { Yield, WorkCntr, ConfQuanUnitIso, ConfQuanUnit, GoodMovementsSet, MoveType } = oData.results[0];

                            that.getView().getModel('WoutJSON').setProperty('/OperationWorkCenter', WorkCntr);
                            that.getView().getModel('WoutJSON').setProperty('/CantDecl', parseInt(Yield));
                            that.getView().getModel('WoutJSON').setProperty('/ConfQuanUnit', ConfQuanUnitIso);
                            quantityToDecInput.setEnabled(true);

                            GoodMovementsSet.results.forEach(gMovement => {
                                let movementData = {
                                    Material: gMovement.Material,
                                    Quantity: parseInt(gMovement.EntryQnt),
                                    Batch: gMovement.Batch,
                                    StgeLoc: gMovement.StgeLoc,
                                    MoveType: gMovement.MoveType
                                }

                                goodMovementsData.push(movementData);
                                temporalMovements.push(movementData);
                            });

                            goodMovementsModel.setData(goodMovementsData);
                            goodMovementsModel.refresh();
                            that.handleEnabledSaveBtn();
                            oModelEditView.setProperty('/InputProductionOrder', false);
                            oModelEditView.setProperty('/InputOperation', false);
                            oModelEditView.setProperty('/OperationScanBtn', false);
                            oModelEditView.setProperty('/ProductionScanBtn', false);
                            oModelEditView.setProperty('/AddBtnEnabled', true);
                            oTable.setBusy(false);
                        },
                        error: function (error) {
                            let errorMsg = JSON.parse(error.responseText);

                            sap.m.MessageBox.error(`Code: ${errorMsg.error.code}, Message: ${errorMsg.error.message.value}`);
                            oModelEditView.setProperty('/InputProductionOrder', true);
                            oModelEditView.setProperty('/InputOperation', true);
                            oModelEditView.setProperty('/OperationScanBtn', true);
                            oModelEditView.setProperty('/ProductionScanBtn', true);
                            oTable.setBusy(false);
                        }
                    })
                })

            },

            onValueHelpAufnr: function (oEvent) {
                var that = this;
                var sAufnr = this.getView().getModel("WoutJSON").getProperty("/Aufnr");
                var oFilters = [];                
                var sPlant = this.getView().getModel("WoutJSON").getProperty("/Plant");
                oFilters.push(new sap.ui.model.Filter("Plant", FilterOperator.EQ, sPlant));

                var toDay = new Date();
                toDay.setDate(toDay.getDate() - 1);

                that.getFragment("ProdOrDialog").then(function (oFragment) {
                    oFragment.getTableAsync().then(function (oTable) {
                        oTable.setModel(that.getView().getModel());
                        var oInitAufnr = that.getInitAufnr();
                        var oAufnrJSON = new JSONModel(oInitAufnr);
                        oTable.setModel(oAufnrJSON, "columns");

                        if (oTable.bindRows) {
                            oTable.bindAggregation("rows", {
                                path: "/ProductionOrderSt",
                                filters: oFilters
                            });
                        }
                        oFragment.update();
                    });
                    oFragment.open();
                });
            },

            onValueHelpAufpl: function () {
                var that = this;
                var sAufnr = this.getView().getModel("WoutJSON").getProperty("/Aufnr");
                var oFilters = [];
                oFilters.push(new sap.ui.model.Filter("OrderId", FilterOperator.EQ, sAufnr));

                that.getFragment("AufplDialog").then(function (oFragment) {
                    oFragment.getTableAsync().then(function (oTable) {
                        oTable.setModel(that.getView().getModel());
                        var oInitOperation = that.getInitOperation();
                        var operationJSON = new JSONModel(oInitOperation);
                        oTable.setModel(operationJSON, "columns");

                        if (oTable.bindRows) {
                            oTable.bindAggregation("rows", {
                                path: "/OperationSt",
                                filters: oFilters
                            });
                        }
                        oFragment.update();
                    });
                    oFragment.open();
                });
            },

            cleanViewData: function () {
                let { CantDecl, ConfQuanUnit, Operation, OperationDesc, OperationWorkCenter } = this.getInitialWout();
                let oGoodMovementsModel = this.getView().getModel('GoodMovements');

                this.getView().getModel('WoutJSON').setProperty('/Operation', Operation);
                this.getView().getModel('WoutJSON').setProperty('/OperationDesc', OperationDesc);
                this.getView().getModel('WoutJSON').setProperty('/OperationWorkCenter', OperationWorkCenter);
                this.getView().getModel('WoutJSON').setProperty('/CantDecl', CantDecl);
                this.getView().getModel('WoutJSON').setProperty('/ConfQuanUnit', ConfQuanUnit);
                oGoodMovementsModel.setData({});
            },

            onValueHelpOkPressAufnr: function (oEvent) {
                this.cleanViewData();
                let oModelEditView = this.getView().getModel('ViewJSON');
                let aTokens = oEvent.getParameter("tokens");
                let currentPOrder = aTokens[0].getCustomData()[0].getValue().ProductionOrder;
                let matnrOrder = aTokens[0].getCustomData()[0].getValue().Material;
                let materialDescription = aTokens[0].getCustomData()[0].getValue().MaterialDescription;

                this.getView().getModel("WoutJSON").setProperty("/Aufnr", currentPOrder);
                this.getView().getModel("WoutJSON").setProperty("/Matnr", matnrOrder);
                this.getView().getModel("WoutJSON").setProperty("/MaterialDescription", materialDescription);
                this.getFragment("ProdOrDialog").then(function (oFragment) {
                    oFragment.close();
                });
                oModelEditView.setProperty('/InputOperation', true);
                oModelEditView.setProperty('/OperationScanBtn', true);
                this.cleanNotifications();
            },

            onValueHelpOkPressAufpl: function (oEvent) {
                let oModelEditView = this.getView().getModel('ViewJSON');
                let aTokens = oEvent.getParameter("tokens");
                let operation = aTokens[0].getCustomData()[0].getValue().OperationCode;
                let operationDesc = aTokens[0].getCustomData()[0].getValue().OperationDescription;
                let workCenter = aTokens[0].getCustomData()[0].getValue().Workcenter;
                this.getView().getModel("WoutJSON").setProperty("/Operation", operation);
                this.getView().getModel("WoutJSON").setProperty("/OperationDesc", operationDesc);
                this.getView().getModel("WoutJSON").setProperty("/OperationWorkCenter", workCenter);
                this.getGoodMovements();
                this.getFragment("AufplDialog").then(function (oFragment) {
                    oFragment.close();
                });

                oModelEditView.setProperty('/InputProductionOrder', false);
                oModelEditView.setProperty('/InputOperation', false);
                oModelEditView.setProperty('/OperationScanBtn', false);
                oModelEditView.setProperty('/ProductionScanBtn', false);
            },

            onFilterBarSearch: function (oEvent) {
                let aSelectionSet = oEvent.getParameter("selectionSet");
                let aFilters = aSelectionSet.reduce(function (aResult, oControl) {
                    if (oControl.getName() === 'EndDate') {
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

                let sPlant = this.getView().getModel("WoutJSON").getProperty("/Plant");
                aFilters.push(new sap.ui.model.Filter("Plant", FilterOperator.EQ, sPlant));

                this.getFragment("ProdOrDialog").then(function (oFragment) {
                    let oBindingInfo = oFragment.getTable().getBinding("rows");
                    let oFilters = new Filter({
                        filters: aFilters,
                        and: true // false
                    });

                    oBindingInfo.filter(oFilters);
                    oFragment.update();
                });
            },

            onFilterBarSearchAufpl: function (oEvent) {
                var aSelectionSet = oEvent.getParameter("selectionSet");

                var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
                    if (oControl.getValue()) {
                        aResult.push(new sap.ui.model.Filter('OperationCode', FilterOperator.EQ, oControl.getValue()));
                    }
                    return aResult;
                }, []);

                this.getFragment("AufplDialog").then(function (oFragment) {
                    var oBindingInfo = oFragment.getTable().getBinding("rows");
                    var oFilters = new Filter({
                        filters: aFilters,
                        and: false
                    });
                    oBindingInfo.filter(oFilters);
                    oFragment.update();
                });
            },

            onBarcode: function () {
                sap.ndc.BarcodeScanner.scan(
                    function (mResult) {
                        if (!mResult.cancelled) {
                            this.getView().getModel("WoutJSON").setProperty("/Aufnr", mResult.text);
                            this.getMatnrData(mResult.text);
                            this.getView().getModel('WoutJSON').setProperty('/Operation', '');
                            this.getView().getModel('WoutJSON').setProperty('/OperationDesc', '');
                            this.getView().getModel('WoutJSON').setProperty('/OperationWorkCenter', '');
                        }
                    }.bind(this),
                    function (Error) {

                    }.bind(this)
                );
            },

            onBarcodeMaterial: function (oEvent) {
                let consumptionTable = this.getView().byId('consumptionTable');
                let currentId = oEvent.getParameters().id.split('-')[oEvent.getParameters().id.split('-').length - 1];
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

            onBarcodeConsumption: function (oEvent) {
                let that = this;
                let consumptionTable = this.getView().byId('consumptionTable');
                let currentId = oEvent.getParameters().id.split('-')[oEvent.getParameters().id.split('-').length - 1];

                sap.ndc.BarcodeScanner.scan(
                    function (mResult) {
                        if (!mResult.cancelled) {
                            consumptionTable.getItems()[currentId].getCells()[0].getItems()[1].setValue(mResult.text);
                            that.onCheckMatnrBarCode(mResult.text, currentId);
                        }
                    }.bind(this),
                    function (Error) {

                    }.bind(this)
                );
            },

            onBarcodeOperation: function () {
                sap.ndc.BarcodeScanner.scan(
                    function (mResult) {
                        if (!mResult.cancelled) {
                            this.getView().getModel("WoutJSON").setProperty("/Operation", mResult.text);
                            this.getGoodMovements();
                        }
                    }.bind(this),
                    function (Error) {
                        var a = 2;
                    }.bind(this)
                );
            },

            onBarcodeSerie: function () {
                sap.ndc.BarcodeScanner.scan(
                    function (mResult) {
                        if (!mResult.cancelled) {
                            this.getView().getModel("WoutJSON").setProperty("/Sernr", mResult.text);
                        }
                    }.bind(this),
                    function (Error) {

                    }.bind(this)
                );
            },

            onExitAufnr: function () {
                this.getFragment("ProdOrDialog").then(function (oFragment) {
                    oFragment.close();
                });
            },

            onExitAufpl: function () {
                this.getFragment("AufplDialog").then(function (oFragment) {
                    oFragment.close();
                });
            },

            onSelectionChange: function () {
                let deleteBtn = this.getView().byId('deleteBtn');
                let editBtn = this.getView().byId('editBtn');
                let currebtDeleteBtnState = deleteBtn.getEnabled();
                let currebtEditBtnState = editBtn.getEnabled();

                let oTable = this.getView().byId('consumptionTable');
                let selectedItems = oTable.getSelectedItems();

                if (selectedItems.length === 0) {
                    deleteBtn.setEnabled(false);
                    editBtn.setEnabled(false);
                    return;
                }

                if (!currebtDeleteBtnState) {
                    deleteBtn.setEnabled(!currebtDeleteBtnState);
                }

                if (!currebtEditBtnState) {
                    editBtn.setEnabled(!currebtEditBtnState);
                }
            },

            onConfirmConsumption: function () {
                let oTable = this.getView().byId('consumptionTable')
                let oModel = this.getView().getModel('GoodMovements');
                let aData = oModel.getProperty('/');
                let materialConsumption = this.getView().byId('materialConsumption');
                let quantityConsumption = this.getView().byId('quantityConsumption');
                let storeConsumption = this.getView().byId('storeConsumption');
                let batchConsumption = this.getView().byId('batchConsumption');

                let goodMovementsData = {
                    Material: materialConsumption.getValue(),
                    Quantity: quantityConsumption.getValue(),
                    Batch: batchConsumption.getValue(),
                    StgeLoc: storeConsumption.getValue(),
                    MoveType: '261'
                }

                temporalMovements.push(goodMovementsData);

                if (!materialConsumption.getValue().trim()) {
                    materialConsumption.setValueState('Error');
                    return;
                }

                if (!quantityConsumption.getValue()) {
                    quantityConsumption.setValueState('Error');
                    return;
                }

                if (Object.keys(aData).length > 0) {
                    let updatedData = [...aData, { ...goodMovementsData }];
                    oModel.setProperty('/', updatedData);
                    this.onCloseConsumptionDialog();
                    oTable.removeSelections();
                    return;
                }

                oModel.setProperty('/', [{ ...goodMovementsData }]);
                this.onCloseConsumptionDialog();
                oTable.removeSelections();
            },

            checkMatnr: function (matnr) {
                let messageCheckMatnr = oResourceBundle.getText("textCheckMatnr");
                let aufnr = this.getView().getModel('WoutJSON').getProperty('/Aufnr');

                if (!matnr.trim()) {
                    MessageBox.information(messageCheckMatnr);
                    return -1;
                }

                let oModel = this.getView().getModel();
                let oFilters = [new Filter('matnr', FilterOperator.EQ, matnr)]

                return new Promise(function (resolve, reject) {
                    oModel.read('/MaterialQuantityP', {
                        filters: oFilters,
                        success: function (oData) {
                            if (oData.results.length === 0) {
                                resolve(false); // Matnr no existe
                            } else {
                                resolve(true);  // Matnr existe
                            }
                        },
                        error: function (oError) {
                            reject(oError);
                        }
                    });
                });
            },

            checkMatnrAndComponentOrder: function (matnr) {
                let messageCheckMatnr = oResourceBundle.getText("textCheckMatnr");
                let aufnr = this.getView().getModel('WoutJSON').getProperty('/Aufnr');

                if (!matnr.trim()) {
                    return -1;
                }

                let oModel = this.getView().getModel();
                let oFilters = [new Filter('matnr', FilterOperator.EQ, matnr), new Filter('aufnr', FilterOperator.EQ, aufnr)];

                return new Promise(function (resolve, reject) {
                    oModel.read('/MaterialQuantityP', {
                        filters: oFilters,
                        success: function (oData) {
                            if (oData.results.length === 0) {
                                resolve(false); // Matnr no existe
                            } else {
                                resolve(true);  // Matnr existe
                            }
                        },
                        error: function (oError) {
                            reject(oError);
                        }
                    });
                });
            },

            onChangeConsumption: function () {
                let that = this;
                let materialConsumption = this.getView().byId('materialConsumption');
                let quantityConsumption = this.getView().byId('quantityConsumption');
                let prodOrder = this.getView().getModel('WoutJSON').getProperty('/Aufnr');

                if(!materialConsumption.getValue().trim()) {
                    return;
                }

                if (materialConsumption.getValue()) {
                    materialConsumption.setValueState('None');
                }

                if (quantityConsumption.getValue()) {
                    quantityConsumption.setValueState('None');
                }

                this.checkMatnr(materialConsumption.getValue()).then(matnrExists => {
                    if (!matnrExists) {
                        MessageBox.error(oResourceBundle.getText('texterrorMessageMatNotExist'));
                        materialConsumption.setValue('');
                        return;
                    }

                    that.checkMatnrAndComponentOrder(materialConsumption.getValue()).then(matnrExists => {
                        if (!matnrExists) {
                            MessageBox.error(oResourceBundle.getText('texterrorReferenceNotPlanned'));
                            materialConsumption.setValue('');
                            return;
                        }

                        let oFilters = [new Filter('ProductionOrder', FilterOperator.EQ, prodOrder), new Filter('Material', FilterOperator.EQ, materialConsumption.getValue())];

                        that.getView().getModel().read('/BatchLgortP', {
                            filters: oFilters,
                            success: function (oData) {
                                if (oData.results.length === 0) {
                                    return;
                                }
                                let { Batch, StorageLocation } = oData.results[0];
                                that.getView().byId('batchConsumption').setValue(Batch);
                                that.getView().byId('storeConsumption').setValue(StorageLocation);
                                return;
                            },
                            error: function (oError) {
                                //console.log(oError);
                            }
                        })
                    })
                }).catch(oError => {
                    //console.log(oError);
                })
            },

            onEditConsumption: function () {
                let oTable = this.getView().byId('consumptionTable');
                let selectedItems = oTable.getSelectedItems();
                let editBtn = this.getView().byId('editBtn');
                let editSaveBtn = this.getView().byId('editSaveBtn');

                editBtn.setVisible(false);
                editSaveBtn.setVisible(true);

                if (selectedItems.length === 1) {
                    oTable.getItems()[selectedItems[0].getId().slice(-1)].getCells()[0].getItems()[0].setEnabled(true);
                } else {
                    selectedItems.forEach(item => {
                        item.getCells()[0].getItems()[0].setEnabled(true);
                    })
                }

                for (let i = 0; i < selectedItems.length; i++) {
                    for (let j = 0; j < selectedItems[i].getCells().length; j++) {
                        if (j === 0) {
                            selectedItems[i].getCells()[j].getItems()[1].setEditable(true);
                            continue;
                        }

                        if (j === 2 || j === 3 || j === 4) continue;
                        selectedItems[i].getCells()[j].setEditable(true);
                    }
                }

                oTable.removeSelections();
                this.getView().byId('deleteBtn').setEnabled(false);
            },

            onSaveEdit: function () {
                let oTable = this.getView().byId('consumptionTable');                
                let selectedItems = oTable.getSelectedItems();
                let items = oTable.getItems();

                for (let i = 0; i < items.length; i++) {
                    for (let j = 0; j < items[i].getCells().length; j++) {
                        if (j === 0) {
                            items[i].getCells()[j].getItems()[1].setEditable(false);
                            continue;
                        }

                        if (j === 2 || j === 3 || j === 4) continue;
                        items[i].getCells()[j].setEditable(false);
                    }
                }

                this.getView().byId('editBtn').setVisible(true);
                this.getView().byId('editBtn').setEnabled(false);
                this.getView().byId('deleteBtn').setEnabled(false);
                this.getView().byId('editSaveBtn').setVisible(false);

                if (items.length === 1) {
                    oTable.getItems()[items[0].getId().slice(-1)].getCells()[0].getItems()[0].setEnabled(false);
                } else {
                    items.forEach(item => {
                        item.getCells()[0].getItems()[0].setEnabled(false);
                    })
                }
                oTable.removeSelections();
            },

            onCheckMatnrBarCode: function (matnr, currentId) {
                let that = this;
                let goodMovementsModelData = this.getView().getModel('GoodMovements').getData();

                this.checkMatnr(matnr).then(matnrExists => {
                    if (!matnrExists) {
                        MessageBox.error(oResourceBundle.getText('texterrorMessageMatNotExist'));
                        goodMovementsModelData[currentId].Material = temporalMovements[currentId].Material;
                        that.getView().getModel('GoodMovements').refresh();
                        return;
                    }

                    that.checkMatnrAndComponentOrder(matnr).then(matnrExists => {
                        if (!matnrExists) {
                            MessageBox.error(oResourceBundle.getText('texterrorReferenceNotPlanned'));
                            goodMovementsModelData[currentId].Material = temporalMovements[currentId].Material;
                            that.getView().getModel('GoodMovements').refresh();
                            return;
                        }
                    })
                })
            },

            onCheckMatnr: function (oEvent) {
                let that = this;
                let goodMovementsModelData = this.getView().getModel('GoodMovements').getData();
                let currentMatnr = oEvent.getParameters().value;
                let orgId = oEvent.getSource().getId().split('-');
                let selectedId = orgId[orgId.length - 1];

                this.checkMatnr(currentMatnr).then(matnrExists => {
                    if (!matnrExists) {
                        MessageBox.error(oResourceBundle.getText('texterrorMessageMatNotExist'));
                        goodMovementsModelData[selectedId].Material = temporalMovements[selectedId].Material;
                        that.getView().getModel('GoodMovements').refresh();
                        return;
                    }

                    that.checkMatnrAndComponentOrder(currentMatnr).then(matnrExists => {
                        if (!matnrExists) {
                            MessageBox.error(oResourceBundle.getText('texterrorReferenceNotPlanned'));
                            goodMovementsModelData[selectedId].Material = temporalMovements[selectedId].Material;
                            that.getView().getModel('GoodMovements').refresh();
                            return;
                        }
                    })
                })
            },

            onDeleteConsumption: function (oEvent) {
                let oModel = this.getView().getModel('GoodMovements');
                let aData = oModel.getProperty('/');
                let oTable = this.getView().byId('consumptionTable');
                let selectedItems = oTable.getSelectedItems();
                let indexToRemove = [];

                selectedItems.forEach(item => {
                    let sPath = item.getBindingContextPath();
                    let idx = parseInt(sPath.split('/')[1]);
                    indexToRemove.push(idx);
                })

                indexToRemove.sort(function (a, b) { return b - a; });
                indexToRemove.forEach(function (index) {
                    aData.splice(index, 1);
                });

                oModel.setProperty("/", aData);
                oTable.removeSelections();
                this.getView().byId('editBtn').setEnabled(false);
                this.getView().byId('deleteBtn').setEnabled(false);
            },

            onCancelar: function () {
                this.getFragment("QuantityDialog").then(function (oFragment) {
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

            cleanScreen: function () {
                let oModel = this.getView().getModel('WoutJSON');
                let oModelData = this.getView().getModel('WoutJSON').getObject('/');
                let oEditView = this.getView().getModel('ViewJSON');
                let initialEditView = this.getEditView();
                let oModelGoodMovements = this.getView().getModel('GoodMovements');
                let modelData = this.getInitialWout();

                modelData.Operario = oModelData.Operario;
                modelData.WorkCenter = oModelData.WorkCenter;
                modelData.Plant = oModelData.Plant;

                oModel.setData(modelData);
                oModelGoodMovements.setData({});
                oEditView.setData(initialEditView);
            },

            cleanNotifications: function () {
                this.getView().getModel('message').setProperty('/messageLength', '');
                this.getView().getModel('message').setProperty('/type', 'Default');
                oMessagePopover.getModel().setData({});
            },

            onAgregarConsumo: function () {
                this.getFragment("ConsumptionsDialog").then(function (oFragment) {
                    oFragment.open();
                });
            },

            onCloseConsumptionDialog: function () {
                let materialConsumption = this.getView().byId('materialConsumption');
                let quantityConsumption = this.getView().byId('quantityConsumption');
                let batchConsumption = this.getView().byId('batchConsumption');
                let storeConsumption = this.getView().byId('storeConsumption');

                materialConsumption.setValue("");
                quantityConsumption.setValue("");
                batchConsumption.setValue("");
                storeConsumption.setValue("");

                materialConsumption.setValueState("None");
                quantityConsumption.setValueState("None");

                this.getFragment("ConsumptionsDialog").then(function (oFragment) {
                    oFragment.close();
                });
            },

            onReject: function () {
                let oModel = this.getView().getModel('WoutJSON');
                let oModelData = this.getView().getModel('WoutJSON').getObject('/');
                let oModelGoodMovements = this.getView().getModel('GoodMovements');
                let oModelEditView = this.getView().getModel('ViewJSON');
                let initialEditView = this.getEditView();
                let initialModelData = this.getInitialWout();
                let messageCancelProduction = oResourceBundle.getText("textMessageCancelProduction")
                let messageCancelAction = oResourceBundle.getText("textMessagePopUpCancel")
                initialModelData.Operario = oModelData.Operario;
                initialModelData.WorkCenter = oModelData.WorkCenter;
                initialModelData.Plant = oModelData.Plant;

                MessageBox.show(messageCancelProduction, {
                    icon: MessageBox.Icon.WARNING,
                    title: messageCancelAction,
                    actions: ["YES", "NO"],
                    emphasizedAction: "YES",
                    onClose: async function (oAction) {
                        if (oAction === 'YES') {
                            oModel.setData(initialModelData);
                            oModelGoodMovements.setData({});
                            oModelEditView.setData(initialEditView);
                            temporalMovements = [];
                        } else {
                            sap.m.MessageToast.show(messageCancelAction);
                        }
                    }
                })
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

            handleEnabledSaveBtn: function () {
                let viewModel = this.getView().getModel('WoutJSON');

                let prodOrderInput = viewModel.getProperty('/Aufnr');
                let operation = viewModel.getProperty('/Operation');
                let quantityToDeclare = viewModel.getProperty('/CantDecl')

                if (!prodOrderInput || !operation) {
                    this.getView().getModel('ViewJSON').setProperty('/SaveBtnEnabled', false);
                    return;
                }

                this.getView().getModel('ViewJSON').setProperty('/SaveBtnEnabled', true);
            },

            onSave: function (oEvent) {
                let that = this;
                var oGoodMovements = this.getView().getModel('GoodMovements').getProperty("/");
                var oWoutJSON = this.getView().getModel("WoutJSON").getProperty("/");
                var sBusy = oResourceBundle.getText('textProcessingSave');
                var oPostProduct = this.getInitPost();
                var sProduct = this.getInitProduct();
                var sGoodMovements = this.getInitGood();
                var busyDialog4 = (sap.ui.getCore().byId("busy4")) ? sap.ui.getCore().byId("busy4") : new sap.m.BusyDialog('busy4', {
                    title: sBusy
                });

                if (!String(oWoutJSON.CantDecl).trim() || oWoutJSON.CantDecl === 0) {
                    MessageBox.warning(oResourceBundle.getText('textErrorQuantityRequired'));
                    return;
                }

                oPostProduct.Linea = oWoutJSON.WorkCenter;
                oPostProduct.Operario = oWoutJSON.Operario;
                oPostProduct.Werks = oWoutJSON.Plant;
                sProduct.Operario = oWoutJSON.Operario;
                sProduct.Werks = oWoutJSON.Plant;
                sProduct.Aufnr = oWoutJSON.Aufnr;
                sProduct.Matnr = oWoutJSON.Matnr;
                sProduct.Operation = oWoutJSON.Operation;
                sProduct.Cantidad = parseInt(oWoutJSON.CantDecl).toFixed(3);
                oPostProduct.ProductionDeclarationSet.push($.extend(true, {}, sProduct));

                for (var i = 0; i < oGoodMovements.length; i++) {
                    sGoodMovements.Material = oGoodMovements[i].Material;
                    sGoodMovements.EntryQnt = parseInt(oGoodMovements[i].Quantity).toFixed(3);
                    sGoodMovements.StgeLoc = oGoodMovements[i].StgeLoc;
                    sGoodMovements.Batch = oGoodMovements[i].Batch;
                    oPostProduct.GoodMovementsSet.push($.extend(true, {}, sGoodMovements));
                }

                busyDialog4.open();

                this.getView().getModel("ZDOM_0000_SRV_01").create('/HeaderSet', oPostProduct, {
                    success: function (oData, oResponse) {
                        let errorMessasgeUnexpected = oResourceBundle.getText("textMessageUnexpected")

                        if (oData.ReturnSet.results.length === 0) {
                            MessageBox.error(errorMessasgeUnexpected);
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

                        let oViewJSON = that.getView().getModel('ViewJSON');

                        msgsArr.forEach(msg => {
                            if (msg.T === 'Error') {
                                oViewJSON.setProperty('/InputMaterial', true);
                                oViewJSON.setProperty('/InputProductionOrder', true);
                                oViewJSON.setProperty('/ProductionScanBtn', true);
                                oViewJSON.setProperty('/InputCantDecl', false);
                            } else {
                                //Set Edit
                                oViewJSON.setProperty('/InputKunnr', false);
                                oViewJSON.setProperty('/InputMaterial', true);
                                oViewJSON.setProperty('/InputQuantity', false);
                                oViewJSON.setProperty('/SelectPalletType', false);
                                oViewJSON.setProperty('/InputProductionOrder', false);                                
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

            getInitGood: function () {
                return {
                    ConfNo: "",
                    Orderid: "",
                    Sequence: "",
                    Operation: "",
                    Material: "",
                    Plant: "",
                    StgeLoc: "",
                    Batch: "",
                    MoveType: "",
                    StckType: "",
                    SpecStock: "",
                    Vendor: "",
                    Customer: "",
                    SalesOrd: "",
                    SOrdItem: "",
                    SchedLine: "",
                    ValType: "",
                    EntryQnt: 0.000,
                    EntryUom: "",
                    EntryUomIso: "",
                    Operario: "",
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
                    SRfidSet: [],
                    GoodMovementsSet: [],
                }
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
            },

            getCreateProduct: function () {
                return {
                    ConfNo: "",
                    Orderid: "",
                    Sequence: "",
                    Operation: "",
                    SubOper: "",
                    CapaCategory: "",
                    Split: 0,
                    FinConf: "",
                    ClearRes: "",
                    PostgDate: new Date(),
                    DevReason: "",
                    ConfText: "",
                    Plant: "",
                    WorkCntr: "",
                    Recordtype: "",
                    ConfQuanUnit: "",
                    ConfQuanUnitIso: "",
                    Yield: null,
                    Scrap: null,
                    Rework: null,
                    ConfActiUnit1: "",
                    ConfActiUnit1Iso: "",
                    GoodMovementsSet: []
                }
            },

            getInitGoodMovements: function () {
                return {
                    ConfNo: "",
                    Orderid: "",
                    Sequence: "",
                    Operation: "",
                    Material: "",
                    Plant: "",
                    StgeLoc: "",
                    Batch: "",
                    MoveType: "",
                    StckType: "",
                    SpecStock: "",
                    Vendor: "",
                    Customer: "",
                    SalesOrd: "",
                    SOrdItem: "",
                    SchedLine: "",
                    ValType: "",
                    EntryQnt: null,
                    EntryUom: "",
                    EntryUomIso: "",
                }
            },

            getInitialWout: function () {
                return {
                    Operario: "",
                    Plant: "",
                    WorkCenter: "",
                    Matnr: "",
                    MaterialDescription: "",
                    CantTeo: "",
                    CantDecl: "",
                    ConfQuanUnit: "",
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
                    Operation: "",
                    OperationDesc: "",
                    OperationWorkCenter: "",
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

            getInitAufnr: function () {
                return {
                    "cols": [
                        {
                            "label": "{i18n>textFilterLabelAufnr}",
                            "template": "ProductionOrder"
                        },
                        {
                            "label": "{i18n>textFilterLabelDate}",
                            "template": "EndDate"
                        },
                        {
                            "label": "{i18n>textMaterial}",
                            "template": "Material"
                        },
                        {
                            "label": "{i18n>textItemNameOrg}",
                            "template": "MaterialDescription"
                        }
                    ]
                }
            },

            getInitOperation: function () {
                return {
                    "cols": [
                        {
                            "label": "{i18n>textLabelOperation}",
                            "template": "OperationCode"
                        },
                        {
                            "label": "{i18n>textItemNameOrg}",
                            "template": "OperationDescription"
                        },
                    ]
                }
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
                }
            },

            getEditView: function () {
                return {
                    InputProductionOrder: true,
                    InputOperation: false,
                    InputCantDecl: false,
                    OperationScanBtn: false,
                    ProductionScanBtn: true,
                    SaveBtnEnabled: false,
                    AddBtnEnabled: false
                }
            },

            handleMessagePopoverPress: function (oEvent) {
                oMessagePopover.toggle(oEvent.getSource());
            }
        });
    });
