sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ndc/BarcodeScanner",
    "sap/m/Dialog",
    "sap/ui/layout/form/SimpleForm",
    "sap/ui/model/resource/ResourceModel",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/DatePicker",
    "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    "sap/m/SearchField",
    "sap/m/MessageBox",
    "sap/ui/model/FilterOperator",
    "sap/m/MessagePopover",
    "sap/m/MessagePopoverItem",
    "production/model/formatter"
  ],
  function (
    Controller,
    JSONModel,
    BarcodeScanner,
    Dialog,
    SimpleForm,
    ResourceModel,
    Label,
    Input,
    Button,
    DatePicker,
    ValueHelpDialog,
    SearchField,
    MessageBox,
    FilterOperator,
    MessagePopover,
    MessagePopoverItem,
    formatter
  ) {
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

    var lblUm;
    var inpUm;
    var lblAufnr;
    var inpAufnr;
    var lblMatnr;
    var inpMatnr;
    var lblComponent;
    var inpComponent;
    var lblBatch;
    var inpBatch;
    //var lblAvance;
    //var inpAvance;
    var lblQuantity;
    var inpQuantity;
    var lblStartDate;
    var dtpStartDate;
    var lblStartTime;
    var dtpStartTime;
    var lblEndDate;
    var dtpEndDate;
    var lblEndTime;
    var dtpEndTime;
    var oMultiInput;
    var btnBarcodeScan;
    var inpDescription;
    var inpUnit;
    var inpGamng;
    var inpCantRest;

    var oGlobalBusyDialog = new sap.m.BusyDialog();
    var me;

    return Controller.extend("production.controller.Ovens", {
      formatter: formatter,
      onInit: function () {
        var oRouter = this.getOwnerComponent().getRouter();
        oRouter
          .getRoute("RouteOvens")
          .attachMatched(this._onHandleRouteMatched, this);

        this.instanceOfDialogUm();
        me = this;

        let message = new JSONModel({
          messageLength: "",
          type: "Default"
        });

        this.getView().setModel(message, "message");
        let popModel = new JSONModel({});
        oMessagePopover.setModel(popModel);

        const i18nModel = new ResourceModel({
          bundleName: "production.i18n.i18n"
        });
        this.getView().setModel(i18nModel, "i18n");

        oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
      },

      _onHandleRouteMatched: function (oEvent) {

        var oDataOperario = {
          Operario: oEvent.getParameter("arguments").Operario,
          Plant: oEvent.getParameter("arguments").Plant,
          WorkCenter: oEvent.getParameter("arguments").WorkCenter,
        };

        var oModelJson = new JSONModel(oDataOperario);
        this.getView().setModel(oModelJson, "modelOperario");
        this.getFicticiousMat(this.getView());
        this.getOvensRecords();
      },

      onAfterRendering: function () {
        //this.getOvensRecords();
      },

      onExit: function () {
        // Elimina el detector de eventos cuando se destruya el controlador
      },

      constructor: function () {
        //1.- Unidad de Manipulación
        lblUm = new sap.m.Label({
          text: "{i18n>textOvenstitle}",
        });
        inpUm = new sap.m.Input({
          //id: "inpUm", 
          showValueHelp: true,
          valueHelpIconSrc: "sap-icon://search",
          valueHelpRequest: this.onInpUmSearch.bind(this),
          change: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            if (sValue != "") {
              if (this._debounceTimer) {
                clearTimeout(this._debounceTimer);
              }

              this._debounceTimer = setTimeout(function () {
                me.getUm(sValue);
              }, 2000);
            }
          }.bind(this),
          // liveChange: function (oEvent) {
          //   var sValue = oEvent.getParameter("value");
          //   if (sValue != "") {
          //     if (this._debounceTimer) {
          //       clearTimeout(this._debounceTimer);
          //     }

          //     this._debounceTimer = setTimeout(function () {
          //       me.getUm(sValue);
          //     }, 2000);
          //   }
          // }.bind(this),
        });

        //2.- Orden Producción
        lblAufnr = new sap.m.Label({
          text: "{i18n>textOvensOrProd}",
        });
        inpAufnr = new sap.m.Input({
          //id: "inpAufnr",
          showValueHelp: true,
          valueHelpRequest: this.onValueHelpRequestedAufnr.bind(this),
        });

        //3.- Material
        lblMatnr = new sap.m.Label({
          text: "{i18n>textOvensMat}",
        });
        inpMatnr = new sap.m.Input({
          //id: "inpMatnr",
          showValueHelp: true,
          valueHelpRequest: this.onValueHelpRequested.bind(this),
          change: "onGetMatnr",
        });

        //4.- Component
        lblComponent = new sap.m.Label({
          text: "{i18n>textOvensComp}",
        });
        inpComponent = new sap.m.Input({
          //id: "inpComponent",
          editable: false
        });

        //5.- Lote
        lblBatch = new sap.m.Label({
          text: "{i18n>textOvensLote}",
        });
        inpBatch = new sap.m.Input({
          //id: "inpBatch",
          editable: false
        });

        //5.- Porcentaje
        //lblAvance = new sap.m.Label({
        //  text: "{i18n>textProgress}",
        //});
        //inpAvance = new sap.m.Input({
        //  editable: false
        //});

        //3.- Cantidad
        lblQuantity = new sap.m.Label({
          text: "{i18n>textOvensCant}",
        });
        inpQuantity = new sap.m.Input({
          //id: "inpQuantity",
          editable: false
        });

        //4.- Fecha de Inicio
        lblStartDate = new sap.m.Label({
          text: "{i18n>textOvensFech}",
        });
        dtpStartDate = new sap.m.DatePicker({
          //id: "dtpStartDate",
          value: "",
          placeholder: "Seleccione una Fecha valida",
          displayFormat: "dd/MM/yyyy",
          valueFormat: "dd/MM/yyyy",
          editable: false
        });
        //5.- Hora Inicio
        lblStartTime = new sap.m.Label({
          text: "{i18n>textOvensHoraI}",
        });
        dtpStartTime = new sap.m.DateTimePicker({
          //id: "dtpStartTime",
          editable: false
        });
        //6.- Fecha de Fin
        lblEndDate = new sap.m.Label({
          text: "{i18n>textOvensFechF}",
        });
        dtpEndDate = new sap.m.DatePicker({
          //id: "dtpEndDate",
          value: "",
          placeholder: "Seleccione una Fecha valida",
          displayFormat: "dd/MM/yyyy",
          valueFormat: "dd/MM/yyyy",
          editable: false
        });
        //7.- Hora Fin
        lblEndTime = new sap.m.Label({
          text: "{i18n>textOvensHoraF}",
        });
        dtpEndTime = new sap.m.DateTimePicker({
          //id: "dtpEndTime",
          editable: false
        });

        btnBarcodeScan = new sap.m.Button({
          icon: "sap-icon://bar-code",
          press: this.onBarcode.bind(this),
          ariaDescribedBy: "defaultButtonDescription genericButtonDescription",
          width: "auto",
          text: "ScanBar",
        });

        inpDescription = new sap.m.Input({
          //id: "inpDescription",
          visible: false,
        });

        inpUnit = new sap.m.Input({
          //id: "inpUnit",
          visible: false,
        });
      },
      onInpUmSearch: function () {
        if (inpUm.getValue() != "") {
          this.getUm(inpUm.getValue());
        } else {
          sap.m.MessageToast.show(oResourceBundle.getText('textFragmentAddUnit'));
        }

      },
      loadPopUp: function (oData) {
        // Refresh Popup
        me.onClean(false);
        if (
          oData &&
          oData.ProductionDeclarationSet &&
          Array.isArray(oData.ProductionDeclarationSet.results) &&
          oData.ProductionDeclarationSet.results.length > 0
        ) {
          if (oData.ProductionDeclarationSet.results.length == 1) {
            inpUm.setValue(oData.Um);
            inpMatnr.setValue(oData.ProductionDeclarationSet.results[0].Matnr);
            inpQuantity.setValue(
              oData.ProductionDeclarationSet.results[0].Cantidad
            );
            inpAufnr.setValue(oData.ProductionDeclarationSet.results[0].Aufnr);
            inpBatch.setValue(oData.ProductionDeclarationSet.results[0].Batch);
            inpComponent.setValue(
              oData.ProductionDeclarationSet.results[0].Component
            );
            dtpStartDate.setValue(
              oData.ProductionDeclarationSet.results[0].BeginDate
            );

            //inpAvance.setValue(
            //  oData.ProductionDeclarationSet.results[0].Porcentaje
            //);

            dtpStartTime.setValue(
              me.msToTime(
                oData.ProductionDeclarationSet.results[0].BeginTime.ms
              )
            );

            dtpEndDate.setValue(
              oData.ProductionDeclarationSet.results[0].EndDate
            );
            dtpEndTime.setValue(
              me.msToTime(oData.ProductionDeclarationSet.results[0].EndTime.ms)
            );

            inpUnit.setValue(oData.ProductionDeclarationSet.results[0].Unidad);
            inpDescription.setValue(
              oData.ProductionDeclarationSet.results[0].Description
            );

            // Obtengo las ordenes asociadas a la HU
            let aAufnrs = oData.ProductionDeclarationSet.results;

            // Inicializo el Modelo
            let oAufnrsModel = new sap.ui.model.json.JSONModel();

            // Seteo la data de Ordenes al modelo
            oAufnrsModel.setData({ aufnrs: aAufnrs });

            // Establecer el modelo a la vista
            this.getView().setModel(oAufnrsModel, "aufnrsModel");
          } else if (oData.ProductionDeclarationSet.results.length > 1) {
            sap.m.MessageToast.show(oResourceBundle.getText('textMessageMultipleUm'));

            // Obtengo las ordenes asociadas a la Orden
            let aAufnrs = oData.ProductionDeclarationSet.results;

            // Inicializo el Modelo
            let oAufnrsModel = new sap.ui.model.json.JSONModel();

            // Seteo la data de Ordenes al modelo
            oAufnrsModel.setData({ aufnrs: aAufnrs });

            // Establecer el modelo a la vista
            this.getView().setModel(oAufnrsModel, "aufnrsModel");
          }
        } else {
          sap.m.MessageToast.show(
            "¡Error! La Unidad de Manipulación consultada no existe."
          );
          console.error(
            "¡Error! ProductionDeclarationSet no tiene resultados o está indefinido."
          );
        }
      },

      onCreateModelOvens: function (data) {
        // Transformo las fechas
        for (var i = 0; i < data.results.length; i++) {
          data.results[i].BeginTime = me.msToTime(data.results[i].BeginTime.ms);
          data.results[i].EndTime = me.msToTime(data.results[i].EndTime.ms);
          //data.results[i].Quantity = parseInt(data.results[i].Quantity);
          data.results[i].Quantity = data.results[i].Quantity;
        }

        var arrayUm = data.results;
        var oModelUm = new sap.ui.model.json.JSONModel();
        oModelUm.setData(arrayUm);

        this.getView().setModel(oModelUm, "UmModel");
      },

      onLoadUm: function () {
        this._dialog.open();
      },

      getFicticiousMat: function (view) {
        var oModelOperario = view.getModel("modelOperario");
        var oDataOperario = oModelOperario.getData();
        var centro = oDataOperario.Plant;

        // Ruta del servicio OData
        var sPath = "/FicticiousMat";
        var oFilters = [];

        oFilters.push(
          new sap.ui.model.Filter("plant", FilterOperator.EQ, centro)
        );

        // Establecer el cliente
        //view.getModel().setHeaders({ "sap-client": "130" });

        // Llamada al servicio OData
        view.getModel().read(sPath, {
          filters: oFilters,
          success: function (oData, response) {
            // Filtramos por centro
            var filteredData = oData.results.filter(function (item) {
              return item.plant === centro;
            });
            // Suponiendo que oData.results contiene un array de objetos con los datos de materiales
            var aMaterials = filteredData;
            // Crear modelo temporal con los datos de materiales
            var oMaterialsModel = new sap.ui.model.json.JSONModel();
            oMaterialsModel.setData({ materials: aMaterials });

            // Establecer el modelo a la vista
            this.getView().setModel(oMaterialsModel, "materialsModel");

            // Vincular los datos al MultiInput
          }.bind(this), // Usamos 'this' para acceder al controlador actual
          error: function (oError) {
            //console.log("Error al obtener datos: ", oError);
          }.bind(this),
        });
      },

      onValueHelpRequested: function (oEvent) {
        var oView = this.getView();
        var oModel = oView.getModel("materialsModel");

        // Crear la FilterBar
        var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
          advancedMode: true,
          filterGroupItems: [
            new sap.ui.comp.filterbar.FilterGroupItem({
              groupName: "Basic",
              name: "MaterialNumber",
              label: oResourceBundle.getText('textLabelMatnr'),
              control: new sap.m.Input({
                placeholder: oResourceBundle.getText('textPlaceHolderMatnr'),
              }),
              visibleInAdvancedArea: true,
            }),
            new sap.ui.comp.filterbar.FilterGroupItem({
              groupName: "Basic",
              name: "Description",
              label: oResourceBundle.getText('textLabelDescription'),
              control: new sap.m.Input({
                placeholder: oResourceBundle.getText('textPlaceHolderDescription'),
              }),
              visibleInAdvancedArea: true,
            }),
          ],
          search: function (oEvent) {
            var aFilters = [];
            var oMaterialFilter = oFilterBar.getFilterGroupItems()[0].getControl().getValue();
            var oDescriptionFilter = oFilterBar.getFilterGroupItems()[1].getControl().getValue();

            if (oMaterialFilter) {
              aFilters.push(
                new sap.ui.model.Filter(
                  "material",
                  sap.ui.model.FilterOperator.Contains,
                  oMaterialFilter
                )
              );
            }
            if (oDescriptionFilter) {
              aFilters.push(
                new sap.ui.model.Filter(
                  "description",
                  sap.ui.model.FilterOperator.Contains,
                  oDescriptionFilter
                )
              );
            }

            var oTable = oValueHelpDialog.getTable();
            var oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            oBinding.filter(aFilters);
          },
        });

        // Crear el ValueHelpDialog
        var oValueHelpDialog = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
          title: oResourceBundle.getText('textTitleMatnr'),
          supportMultiselect: false,
          key: "material",
          descriptionKey: "description",
          filterBar: oFilterBar, // Añadir la FilterBar al diálogo
          ok: function (oEvent) {
            me.cleanNotifications();
            var aTokens = oEvent.getParameter("tokens");

            // Si hay un token seleccionado
            if (aTokens.length > 0) {
              var oSelectedToken = aTokens[0]; // Tomar el primer y único token
              var sKey = oSelectedToken.getKey(); // Obtener el valor de la clave (aufnr)
              inpMatnr.setValue(sKey);
            }

            var aMaterials = oModel.getData();

            for (var i = 0; i < aMaterials.materials.length; i++) {
              if (aMaterials.materials[i].material === sKey) {
                inpMatnr.setValue(aMaterials.materials[i].material);

                inpUm.setValue("");
                inpQuantity.setValue("");
                inpAufnr.setValue("");
                inpBatch.setValue("");
                inpComponent.setValue("");

                dtpStartDate.setValue(aMaterials.materials[i].start_date);
                dtpStartTime.setValue(
                  me.msToTime(aMaterials.materials[i].start_time.ms)
                );
                dtpEndDate.setValue(aMaterials.materials[i].finish_date);
                dtpEndTime.setValue(
                  me.msToTime(aMaterials.materials[i].finish_time.ms)
                );

                inpDescription.setValue(aMaterials.materials[i].description);
              }
            }

            oValueHelpDialog.close();
          },
          cancel: function () {
            oValueHelpDialog.close();
          },
        });

        // Asignar el modelo al ValueHelpDialog
        oValueHelpDialog.setModel(oModel, "materialsModel");

        // Obtener la tabla interna del ValueHelpDialog
        var oTable = oValueHelpDialog.getTable();

        // Verificar si la tabla es de tipo sap.ui.table.Table o sap.m.Table
        if (oTable instanceof sap.ui.table.Table) {
          oTable.addColumn(
            new sap.ui.table.Column({
              label: new sap.m.Label({ text: oResourceBundle.getText('textLabelMatnrCode') }),
              template: new sap.m.Text({ text: "{materialsModel>material}" }),
            })
          );

          oTable.addColumn(
            new sap.ui.table.Column({
              label: new sap.m.Label({ text: oResourceBundle.getText('textLabelDescription') }),
              template: new sap.m.Text({
                text: "{materialsModel>description}",
              }),
            })
          );

          oTable.bindRows({
            path: "materialsModel>/materials",
          });
        } else if (oTable instanceof sap.m.Table) {
          oTable.addColumn(
            new sap.m.Column({
              header: new sap.m.Label({ text: "Codigó de Material" }),
            })
          );

          oTable.addColumn(
            new sap.m.Column({
              header: new sap.m.Label({ text: "Descripción" }),
            })
          );

          var oTemplate = new sap.m.ColumnListItem({
            cells: [
              new sap.m.Text({ text: "{materialsModel>material}" }),
              new sap.m.Text({ text: "{materialsModel>description}" }),
            ],
          });

          oTable.bindItems({
            path: "materialsModel>/materials",
            template: oTemplate,
          });
        }

        // Abrir el diálogo
        oValueHelpDialog.open();

        // Esperar un pequeño tiempo para asegurar que el contenido esté renderizado
        setTimeout(function () {
          var aButtons = oValueHelpDialog.getButtons();
          aButtons.forEach(function (oButton) {
            if (oButton && oButton.getId().split('-').pop() === 'cancel') {
              oButton.setText(oResourceBundle.getText("textButtonCancel"));
            }
          });
        }, 0);
      },

      onValueHelpRequestedAufnr: function () {
        var oView = this.getView();
        var oModel = oView.getModel("aufnrsModel");

        // Crear la FilterBar
        var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
          advancedMode: true,
          filterGroupItems: [
            new sap.ui.comp.filterbar.FilterGroupItem({
              groupName: "Basic",
              name: "Aufnr",
              label: oResourceBundle.getText('textLabelAufnr'),
              control: new sap.m.Input({
                placeholder: oResourceBundle.getText('textPlaceHolderAufnr'),
              }),
              visibleInAdvancedArea: true,
            }),
            new sap.ui.comp.filterbar.FilterGroupItem({
              groupName: "Basic",
              name: "Description",
              label: oResourceBundle.getText('textLabelDescription'),
              control: new sap.m.Input({
                placeholder: oResourceBundle.getText('textPlaceHolderDescription'),
              }),
              visibleInAdvancedArea: true,
            }),
          ],
          search: function (oEvent) {
            var aFilters = [];

            var oAufnrFilter = oFilterBar.getFilterGroupItems()[0].getControl().getValue();
            var oAufnrDescriptionFilter = oFilterBar.getFilterGroupItems()[1].getControl().getValue();

            if (oAufnrFilter) {
              aFilters.push(
                new sap.ui.model.Filter(
                  "Aufnr",
                  sap.ui.model.FilterOperator.Contains,
                  oAufnrFilter
                )
              );
            }
            if (oAufnrDescriptionFilter) {
              aFilters.push(
                new sap.ui.model.Filter(
                  "Description",
                  sap.ui.model.FilterOperator.Contains,
                  oAufnrDescriptionFilter
                )
              );
            }

            var oTable = oValueHelpDialog.getTable();
            var oBinding =
              oTable.getBinding("rows") || oTable.getBinding("items");
            oBinding.filter(aFilters);
          },
        });

        // Crear el ValueHelpDialog
        var oValueHelpDialog = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
          title: oResourceBundle.getText('textTitleAufnr'),
          supportMultiselect: false,
          key: "Aufnr",
          descriptionKey: "Description",
          filterBar: oFilterBar, // Añadir la FilterBar al diálogo
          ok: function (oEvent) {
            // Obtener los tokens seleccionados
            var aTokens = oEvent.getParameter("tokens");

            // Si hay un token seleccionado
            if (aTokens.length > 0) {
              var oSelectedToken = aTokens[0]; // Tomar el primer y único token
              var sKey = oSelectedToken.getKey(); // Obtener el valor de la clave (aufnr)
              // Aquí puedes manejar la clave seleccionada (aufnr)
              inpAufnr.setValue(sKey);
            }

            var aAufnrs = oModel.getData();

            for (var i = 0; i < aAufnrs.aufnrs.length; i++) {
              if (aAufnrs.aufnrs[i].Aufnr === sKey) {
                inpMatnr.setValue(aAufnrs.aufnrs[i].Matnr);
                inpQuantity.setValue(aAufnrs.aufnrs[i].Cantidad);
                inpAufnr.setValue(aAufnrs.aufnrs[i].Aufnr);
                inpBatch.setValue(aAufnrs.aufnrs[i].Batch);
                //inpAvance.setValue(aAufnrs.aufnrs[i].Porcentaje);
                inpComponent.setValue(aAufnrs.aufnrs[i].Component);
                dtpStartDate.setValue(aAufnrs.aufnrs[i].BeginDate);
                dtpStartTime.setValue(
                  me.msToTime(aAufnrs.aufnrs[i].BeginTime.ms)
                );
                dtpEndDate.setValue(aAufnrs.aufnrs[i].EndDate);
                dtpEndTime.setValue(me.msToTime(aAufnrs.aufnrs[i].EndTime.ms));

                //inpGamng.setValue(parseInt(aAufnrs.aufnrs[i].Gamng).toFixed(3));
                inpGamng = aAufnrs.aufnrs[i].Gamng;
                inpCantRest = aAufnrs.aufnrs[i].CantRest;
              }
            }

            oValueHelpDialog.close();
          },
          cancel: function () {
            oValueHelpDialog.close();
          },
        });

        // Asignar el modelo al ValueHelpDialog
        oValueHelpDialog.setModel(oModel, "aufnrsModel");

        // Obtener la tabla interna del ValueHelpDialog
        var oTable = oValueHelpDialog.getTable();

        // Verificar si la tabla es de tipo sap.ui.table.Table o sap.m.Table
        if (oTable instanceof sap.ui.table.Table) {
          oTable.addColumn(
            new sap.ui.table.Column({
              label: new sap.m.Label({ text: "{i18n>textLabelAufnr}" }),
              template: new sap.m.Text({ text: "{aufnrsModel>Aufnr}" }),
            })
          );

          oTable.addColumn(
            new sap.ui.table.Column({
              label: new sap.m.Label({ text: "{i18n>textManufacQuantPlan}" }),
              template: new sap.m.Text({ text: "{aufnrsModel>Gamng}" }),
            })
          );

          oTable.addColumn(
            new sap.ui.table.Column({
              label: new sap.m.Label({ text: "{i18n>textManufacQuant}" }),
              template: new sap.m.Text({ text: "{aufnrsModel>Sbmng}" }),
            })
          );

          oTable.addColumn(
            new sap.ui.table.Column({
              label: new sap.m.Label({ text: "{i18n>textManufacQuantRest}" }),
              template: new sap.m.Text({ text: "{aufnrsModel>CantRest}" }),
            })
          );

          //oTable.addColumn(
          //  new sap.ui.table.Column({
          //    label: new sap.m.Label({ text: "{i18n>textProgress}" }),
          //    template: new sap.m.Text({ text: "{aufnrsModel>Porcentaje}" }),
          //  })
          //);

          oTable.addColumn(
            new sap.ui.table.Column({
              label: new sap.m.Label({ text: "{i18n>textLabelDescription}" }),
              template: new sap.m.Text({ text: "{aufnrsModel>Description}" }),
            })
          );

          oTable.bindRows({
            path: "aufnrsModel>/aufnrs",
          });
        } else if (oTable instanceof sap.m.Table) {
          oTable.addColumn(
            new sap.m.Column({
              header: new sap.m.Label({ text: "Ordenes de Fabricación" }),
            })
          );

          oTable.addColumn(
            new sap.m.Column({
              header: new sap.m.Label({ text: "Descripción" }),
            })
          );

          var oTemplate = new sap.m.ColumnListItem({
            cells: [
              new sap.m.Text({ text: "{aufnrsModel>Aufnr}" }),
              new sap.m.Text({ text: "{aufnrsModel>Description}" }),
            ],
          });

          oTable.bindItems({
            path: "aufnrsModel>/aufnrs",
            template: oTemplate,
          });
        }

        const i18nModel = new ResourceModel({
          bundleName: "production.i18n.i18n"
        });

        oValueHelpDialog.setModel(i18nModel, "i18n");

        // Abrir el diálogo
        oValueHelpDialog.open();

        // Esperar un pequeño tiempo para asegurar que el contenido esté renderizado
        setTimeout(function () {
          var aButtons = oValueHelpDialog.getButtons();
          aButtons.forEach(function (oButton) {
            if (oButton && oButton.getId().split('-').pop() === 'cancel') {
              oButton.setText(oResourceBundle.getText("textButtonCancel"));
            }
          });
        }, 0);
      },

      instanceOfDialogUm: function () {

        const i18nModel = new ResourceModel({
          bundleName: "production.i18n.i18n"
        });        

        this._dialog = new Dialog({
          //title: "Ingresar Unidad de Manipulación",
          title: "{i18n>textOvensTitleFrag}",
          content: [
            new SimpleForm({
              content: [
                lblUm,
                inpUm,
                btnBarcodeScan,
                lblAufnr,
                inpAufnr,
                lblMatnr,
                inpMatnr,
                lblComponent,
                inpComponent,
                lblBatch,
                inpBatch,
                //lblAvance,
                //inpAvance,
                lblQuantity,
                inpQuantity,
                lblStartDate,
                dtpStartDate,
                lblStartTime,
                dtpStartTime,
                lblEndDate,
                dtpEndDate,
                lblEndTime,
                dtpEndTime,
                inpDescription,
                inpUnit,
              ],
            }),
          ],
          buttons: [
            new Button({
              //text: "Aceptar",
              text: "{i18n>textOvensAcep}",
              press: function () {
                //****** RECORDING POP UP DATA TO Z TABLE ZTDOM_0027
                me.cleanNotifications();

                if (this.checkQuantity() == true) {
                  this.onCreateOvens();
                } else {
                  sap.m.MessageToast.show(oResourceBundle.getText('textCheckQuantity'));
                }

              }.bind(this),
            }),
            new Button({
              //text: "Cancelar",
              text: "{i18n>textOvensCanc}",
              press: function () {
                me.onClean(true);
                this._dialog.close();
              }.bind(this),
            }),
          ],
        });

        //const i18nModel = new ResourceModel({
        //  bundleName: "production.i18n.i18n"
        //});

        this._dialog.setModel(i18nModel, "i18n");
      },

      loadModelUm: function (oData) {
        var data = me.getView().getModel("UmModel").getData();
        var newEntry = new Object();

        newEntry.Um = oData.Um;
        newEntry.Aufnr = oData.Aufnr;
        newEntry.Matnr = oData.Matnr;
        newEntry.Component = oData.Component;
        newEntry.Batchid = oData.Batchid;
        newEntry.Quantity = oData.Quantity;
        newEntry.BeginDate = oData.BeginDate;
        newEntry.BeginTime = this.msToTime(oData.BeginTime.ms);
        newEntry.EndDate = oData.EndDate;
        newEntry.EndTime = this.msToTime(oData.EndTime.ms);
        newEntry.Description = oData.Description;
        newEntry.inpUnit = oData.Unit;
        newEntry.DesComponent = oData.DesComponent;
        newEntry.Guid = oData.Guid;

        data.push(newEntry);
        me.getView().setModel("UmModel", data);
        me.getView().getModel("UmModel").refresh();
      },

      // SERVICE GET HANDLING UNIT
      getUm: function (pHandlingUnit) {
        oGlobalBusyDialog.open();

        var oModel = this.getView().getModel("ZDOM_0000_SRV_01");
        // Desactiva el modo batch
        oModel.setUseBatch(false);

        var oModelOperario = me.getView().getModel("modelOperario");
        var oDataOperario = oModelOperario.getData();

        var oPayload = {
          Werks: oDataOperario.Plant,
          Um: pHandlingUnit,
          WorkCtr: oDataOperario.WorkCenter,
          ProductionDeclarationSet: [],
          ReturnSet: [],
        };
        // Configurar encabezados si es necesario
        oModel.setHeaders({
          //"sap-client": "130",
          "Content-Type": "application/json",
        });
        // Nombre de la entidad o ruta a la que se va a hacer el POST
        var sPath = "/HeaderSet";
        // Llamada al método "create" para hacer la solicitud POST
        oModel.create(sPath, oPayload, {
          method: "POST", // Método POST
          success: function (oData, response) {
            oGlobalBusyDialog.close();

            if (oData.ReturnSet.results.length > 0) {
              if (oData.ReturnSet.results[0].Type == "E") {
                sap.m.MessageToast.show(
                  oData.ReturnSet.results[0].Message
                );
                return;
              } else {

                sap.m.MessageToast.show(oResourceBundle.getText('textSuccessMsg'));
                this.loadPopUp(oData);

              }
            } else {
              sap.m.MessageToast.show(oResourceBundle.getText('textSuccessMsg'));

              this.loadPopUp(oData);
            }
          }.bind(this),
          error: function (oError) {
            oGlobalBusyDialog.close();
            sap.m.MessageToast.show(oResourceBundle.getText('textErrorCodeNotFound'));
          },
        });
      },

      onClean: function (param) {
        if (param) {
          inpUm.setValue("");
          inpAufnr.setValue("");
          inpMatnr.setValue("");
          inpComponent.setValue("");
          inpBatch.setValue("");
          //inpAvance.setValue("");
          inpQuantity.setValue("");
          dtpStartDate.setValue("");
          dtpStartTime.setValue("");
          dtpEndDate.setValue("");
          dtpEndTime.setValue("");
          inpDescription.setValue("");
          inpUnit.setValue("");
          // Obtengo las ordenes asociadas a la HU
          let aAufnrs = [];
          // Inicializo el Modelo
          let oAufnrsModel = new sap.ui.model.json.JSONModel();
          // Seteo la data de Ordenes al modelo
          oAufnrsModel.setData({ aufnrs: aAufnrs });
          me.getView().setModel(oAufnrsModel, "aufnrsModel");
        } else {
          //          inpUm.setValue("");
          inpAufnr.setValue("");
          inpMatnr.setValue("");
          inpComponent.setValue("");
          inpBatch.setValue("");
          //inpAvance.setValue("");
          inpQuantity.setValue("");
          dtpStartDate.setValue("");
          dtpStartTime.setValue("");
          dtpEndDate.setValue("");
          dtpEndTime.setValue("");
          inpDescription.setValue("");
          inpUnit.setValue("");

          // reset Aufnrs models

          // Obtengo las ordenes asociadas a la HU
          let aAufnrs = [];

          // Inicializo el Modelo
          let oAufnrsModel = new sap.ui.model.json.JSONModel();

          // Seteo la data de Ordenes al modelo
          oAufnrsModel.setData({ aufnrs: aAufnrs });

          me.getView().setModel(oAufnrsModel, "aufnrsModel");
        }
      },

      onAddLine: function (oEvent) {
        var oTable = me.getView().byId("idTableOvens");
        var aSelectedIndices = oTable.getSelectedIndices();
        var aTabUm = this.getView().getModel("UmModel").getProperty("/");
        var sMensaje;

        if (aSelectedIndices.length == 0) {
          sMensaje = oResourceBundle.getText("textOvensSelectLine");
          sap.m.MessageToast.show(sMensaje);
          return;
        }

        var sPos = oTable.getSelectedIndex();
        var sTabUm = $.extend(true, {}, aTabUm[sPos]);
        sTabUm.BeginTime = this.formatTime(sTabUm.BeginTime);
        sTabUm.EndTime = this.formatTime(sTabUm.EndTime);
        oGlobalBusyDialog.open();

        this.getView()
          .getModel("ZDOM_0000_SRV_01")
          .create("/OvenRecordsSet", sTabUm, {
            method: "POST",
            success: function (data) {
              //me.loadModelUm(data);
              this.getOvensRecords();
              oGlobalBusyDialog.close();
            }.bind(this),
            error: function (data) {
              oGlobalBusyDialog.close();
            },
          });
      },

      onDelete: async function (oEvent) {
        var oModel = me.getView().getModel("UmModel");
        var data = oModel.getData();

        var oTable = me.getView().byId("idTableOvens");
        var aSelectedIndices = oTable.getSelectedIndices();
        var oDataForProcess = [];
        var sMensaje;

        // Mostrar los registros seleccionados en la consola
        aSelectedIndices.forEach(function (iIndex) {
          var oContext = oTable.getContextByIndex(iIndex);
          var oSelectedData = oContext.getObject();
          oDataForProcess.push(oSelectedData);
        });

        if (aSelectedIndices.length == 0) {
          sMensaje = oResourceBundle.getText("textOvensSelectLine");
          sap.m.MessageToast.show(sMensaje);
          return;
        }

        // Confirmar antes de eliminar los registros
        MessageBox.show(oResourceBundle.getText('textConfirmDelete'),
          {
            icon: MessageBox.Icon.INFORMATION,
            title: oResourceBundle.getText('textTitleDeleteLine'),
            actions: ["YES", "NO"],
            emphasizedAction: "YES",
            onClose: async function (oAction) {
              if (oAction === "YES") {
                me.cleanNotifications();

                // Si el usuario confirma, proceder a eliminar los registros seleccionados
                aSelectedIndices.sort(function (a, b) {
                  return b - a; // Ordenar los índices de forma descendente para evitar conflictos al eliminar
                });

                aSelectedIndices.forEach(function (iIndex) {
                  // Eliminar el registro del array de datos
                  data.splice(iIndex, 1);
                });

                oModel.setData(data);
                oModel.refresh(true);

                let outcome = await me.onUpdateOvenRecords(
                  "delete",
                  oDataForProcess
                );

              } else if (oAction === "NO") {
                // sap.m.MessageToast.show("Eliminación cancelada.");
              }
            },
          }
        );
      },

      filterGlobally: function (oEvent) {
        // Obtener el valor ingresado en el SearchField
        var oValue = oEvent.getParameter("query");

        // Obtener la referencia a la tabla
        var oTable = this.getView().byId("idTableOvens");

        // Crear los filtros necesarios para los campos que se desean buscar
        var aFilters = [];

        // Filtro para el campo 'Customer' (puedes agregar otros campos)
        if (oValue) {
          var oFilterUm = new sap.ui.model.Filter(
            "Um",
            sap.ui.model.FilterOperator.Contains,
            oValue
          );
          // Combinar los filtros con OR
          aFilters.push(
            new sap.ui.model.Filter({
              filters: [
                oFilterUm,
              ],
              and: false, // Filtros con OR
            })
          );
        }

        // Aplicar los filtros a la tabla
        oTable.getBinding("rows").filter(aFilters, "Application");
      },

      msToTime: function (ms) {
        // Convertir milisegundos a segundos
        let totalSeconds = Math.floor(ms / 1000);

        // Calcular horas, minutos y segundos
        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let seconds = totalSeconds % 60;

        // Formatear horas, minutos y segundos para que siempre tengan dos dígitos
        hours = hours.toString().padStart(2, "0");
        minutes = minutes.toString().padStart(2, "0");
        seconds = seconds.toString().padStart(2, "0");

        // Retornar el formato HH:MM:SS
        return `${hours}:${minutes}:${seconds}`;
      },

      onBarcode: function () {
        sap.ndc.BarcodeScanner.scan(
          function (mResult) {
            if (!mResult.cancelled) {
              inpUm.setValue(mResult.text);

              if (mResult.text !== "") {
                sap.m.MessageToast.show(
                  "Buscando datos.. Unidad de Manipulación: " + inpUm.getValue()
                );

                this.getUm(inpUm.getValue());
              }
            }
          }.bind(this),
          function (Error) {
            var a = 2;
          }.bind(this)
        );
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

      handleDetailsPress: function (oEvent, sClose) {
        let that = this;
        var sMensaje;
        var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
        var sBusy = oResourceBundle.getText('textProcessingSave');
        var busyDialog4 = sap.ui.getCore().byId("busy4")
          ? sap.ui.getCore().byId("busy4")
          : new sap.m.BusyDialog("busy4", {
            title: sBusy,
          });

        if (this.byId("idTableOvens").getSelectedIndex() < 0) {
          sMensaje = oResourceBundle.getText("textOvensSelect");
          sap.m.MessageToast.show(sMensaje);
        } else {
          var aTabUm = this.getView().getModel("UmModel").getProperty("/");
          var oWoutJSON = this.getView()
            .getModel("modelOperario")
            .getObject("/");
          var oPostProduct = this.getInitPost();
          var sProduct = this.getInitProduct();

          oPostProduct.Linea = oWoutJSON.WorkCenter;
          oPostProduct.Operario = oWoutJSON.Operario;
          oPostProduct.Werks = oWoutJSON.Plant;

          //if (this.byId("idTableOvens").getSelectedIndices().length == 1) {
          if (this.byId("idTableOvens").getBinding().getFilterInfo() != null) {

            var objeto = this.byId("idTableOvens")
            var binding = objeto.getBinding("rows")
            binding.refresh(true);
            //        Seleccionar una unica linea
            //var iPosicion = this.byId("idTableOvens").getSelectedIndex();
            //var sPath = "/" + iPosicion;
            //var aTabUm_idx = this.byId("idTableOvens").getBinding().getModel().getProperty(sPath);
            var aTabUm_idx = this.byId("idTableOvens").getContextByIndex().getObject();

            sProduct.Operario = oWoutJSON.Operario;
            sProduct.Werks = oWoutJSON.Plant;
            sProduct.Um = aTabUm_idx.Um;
            sProduct.Aufnr = aTabUm_idx.Aufnr;
            sProduct.Matnr = aTabUm_idx.Matnr;
            sProduct.Component = aTabUm_idx.Component;
            sProduct.Batch = aTabUm_idx.Batchid;
            sProduct.Cantidad = parseInt(aTabUm_idx.Quantity).toFixed(3);
            sProduct.Guid = aTabUm_idx.Guid;

            sProduct.Ofclosing = sClose;

            if (sProduct.Cantidad == 0) {
              sap.m.MessageToast.show(oResourceBundle.getText('textErrMsgEnterQty'));
              return;
            } else {
              sProduct.BeginDate = new Date(aTabUm_idx.BeginDate);
            }

            if (aTabUm_idx.BeginDate == null) {
              sap.m.MessageToast.show("Ingresar Fecha Inicio");
              return;
            } else {
              sProduct.BeginDate = new Date(aTabUm_idx.BeginDate);
            }

            sProduct.EndDate = new Date(aTabUm_idx.EndDate);
            oPostProduct.ProductionDeclarationSet.push(
              $.extend(true, {}, sProduct)
            );

          } else {
            //        Seleccion multiple
            for (
              var i = 0;
              i < this.byId("idTableOvens").getSelectedIndices().length;
              i++
            ) {
              var oTable = this.byId("idTableOvens");
              var aSelectedIndices = oTable.getSelectedIndices();
              var oDataForProcess = [];

              aSelectedIndices.forEach(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                var oSelectedData = oContext.getObject();
                oDataForProcess.push(oSelectedData);
              });

              var sTabUm = $.extend(
                true,
                {},
                //aTabUm[this.byId("idTableOvens").getSelectedIndices()[i]]
                aTabUm[aSelectedIndices[i]]
              );
              sProduct.Operario = oWoutJSON.Operario;
              sProduct.Werks = oWoutJSON.Plant;
              sProduct.Um = sTabUm.Um;
              sProduct.Aufnr = sTabUm.Aufnr;
              sProduct.Matnr = sTabUm.Matnr;
              sProduct.Component = sTabUm.Component;
              sProduct.Batch = sTabUm.Batchid;
              sProduct.Cantidad = parseInt(sTabUm.Quantity).toFixed(3);
              sProduct.Guid = sTabUm.Guid;

              sProduct.Ofclosing = sClose;

              if (sProduct.Cantidad == 0) {
                sap.m.MessageToast.show(oResourceBundle.getText('textErrMsgEnterQty'));
                return;
              } else {
                sProduct.BeginDate = new Date(sTabUm.BeginDate);
              }

              if (sTabUm.BeginDate == null) {
                sap.m.MessageToast.show("Ingresar Fecha Inicio");
                return;
              } else {
                sProduct.BeginDate = new Date(sTabUm.BeginDate);
              }

              sProduct.EndDate = new Date(sTabUm.EndDate);
              oPostProduct.ProductionDeclarationSet.push(
                $.extend(true, {}, sProduct)
              );
            };

          }
          //borrar registro
          var oModel = me.getView().getModel("UmModel");
          var data = oModel.getData();

          var oTable = me.getView().byId("idTableOvens");
          var aSelectedIndices = oTable.getSelectedIndices();

          var oDataForProcess = [];

          // Mostrar los registros seleccionados en la consola
          aSelectedIndices.forEach(function (iIndex) {
            var oContext = oTable.getContextByIndex(iIndex);
            var oSelectedData = oContext.getObject();
            oDataForProcess.push(oSelectedData);
            //console.log("Registro seleccionado:", oSelectedData);
          });

          busyDialog4.open();

          this.getView()
            .getModel("ZDOM_0000_SRV_01")
            .create("/HeaderSet", oPostProduct, {
              success: function (oData) {
                me.cleanNotifications();
                busyDialog4.close();

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

                if (oData.ReturnSet.results.length == 0 ||
                  oData.ReturnSet.results[0].Type == 'S') {
                  // Si el usuario confirma, proceder a eliminar los registros seleccionados
                  aSelectedIndices.sort(function (a, b) {
                    return b - a; // Ordenar los índices de forma descendente para evitar conflictos al eliminar
                  });

                  aSelectedIndices.forEach(function (iIndex) {
                    // Eliminar el registro del array de datos
                    data.splice(iIndex, 1);
                  });

                  oModel.setData(data);
                  oModel.refresh(true);
                }

              }.bind(this),
              error: function (oError) {
                me.cleanNotifications();
                var oMessage = JSON.parse(oError.responseText).error.message.value;

                let msgsArr = [];
                msgsArr.push({
                  T: this.setMessageType('E'),
                  S: oMessage
                })

                let prevMsgs = Array.from(oMessagePopover.getModel().getData());
                let upDatedMsgs = [...prevMsgs, ...msgsArr];
                oMessagePopover.getModel().setData(upDatedMsgs);
                oMessagePopover.getModel().refresh(true);
                busyDialog4.close();
              }.bind(this),
            });
        }
      },

      cleanNotifications: function () {
        this.getView().getModel('message').setProperty('/messageLength', '');
        this.getView().getModel('message').setProperty('/type', 'Default');
        oMessagePopover.getModel().setData({});
      },

      getInitPost: function () {
        return {
          Linea: "",
          Werks: "",
          Operario: "",
          ProductionDeclarationSet: [],
          ReturnSet: [],
          SRfidSet: [],
        };
      },

      getInitialWout: function () {
        return {
          Operario: "",
          Plant: "",
          WorkCenter: "",
        };
      },

      getInitProduct: function () {
        return {
          Operario: "",
          Werks: "",
          Aufnr: "",
          Matnr: "",
          Packnr: "",
          Proces: "",
          Cantidad: 0.0,
          Lifnr: "",
          Sernr: "",
          Um: "",
          Component: "",
          Declarquantity: false,
          Ofclosing: false,
          Impregpart: false,
          Unidad: "",
          BeginDate: null,
          BeginTime: null,
          EndDate: null,
          EndTime: null,
          Batch: "",
        };
      },

      checkQuantity: function () {
        let intCant = parseInt(inpCantRest).toFixed(3) - parseInt(inpQuantity.getValue()).toFixed(3);

        if (intCant < 0) {
          return false;
        } else {
          return true;
        }
      },

      onCreateOvens: function () // FOR CREATING NEW RECORD ************
      //  onTest:function() // FOR CREATING NEW RECORD ************
      {
        var oModel = this.getView().getModel("UmModel");
        var oModelOperario = this.getView().getModel("modelOperario");
        var oDataOperario = oModelOperario.getData();

        if (inpQuantity.getValue() == 0) {
          sap.m.MessageToast.show(oResourceBundle.getText('textErrMsgEnterQty'));
          return;
        }

        var oAddOvensData = {};
        //let iMandt = "130";
        let iUm = inpUm.getValue();
        let iWerks = oDataOperario.Plant;
        let iWorkCtr = oDataOperario.WorkCenter;
        let iIsDelete = false;
        let iMatnr = inpMatnr.getValue();
        let iDescription = inpDescription.getValue();
        let iAufnr = inpAufnr.getValue();
        let iComponent = inpComponent.getValue();
        let iQuantity = inpQuantity.getValue();
        let iUnit = inpUnit.getValue();
        let iBatchId = inpBatch.getValue();
        //let iAvance = inpAvance.getValue();
        let iBeginDate = new Date(dtpStartDate.getValue());
        let iBeginTime = this.formatTime(dtpStartTime.getValue());
        let iEndDate = new Date(dtpEndDate.getValue());
        let iEndTime = this.formatTime(dtpEndTime.getValue());
        let iIsDeclared = false;
        let iUtime = this.presentTime();
        let iUdate = new Date();
        let iGamng = inpGamng;
        let iCantRest = inpCantRest;

        if (iQuantity == "") {
          iQuantity = "0.000";
        }
        oAddOvensData.Um = iUm; //MaxLength="20"
        oAddOvensData.Werks = iWerks; // MaxLength="4"
        oAddOvensData.WorkCtr = iWorkCtr; // Código del centro de trabajo, "CT01" representa un centro de trabajo específico.
        oAddOvensData.IsDeleted = iIsDelete; // Booleano que indica si está eliminado, en este caso no está eliminado.
        oAddOvensData.Matnr = iMatnr; // Código de material, ejemplo: "MAT12345".
        oAddOvensData.Description = iDescription; // Descripción, ejemplo de texto para describir el objeto.
        oAddOvensData.Aufnr = iAufnr; // Número de orden de fabricación, ejemplo: "AUF56789".
        oAddOvensData.Component = iComponent; // Componente asociado, ejemplo: "COMP987".
        oAddOvensData.Quantity = iQuantity; // Cantidad, ejemplo de valor decimal: "150.75".
        oAddOvensData.Unit = iUnit; // Unidad de la cantidad, ejemplo: "KG" (kilogramos).
        oAddOvensData.Batchid = iBatchId; // Identificador del lote, ejemplo: "BATCH001".
        oAddOvensData.BeginDate = iBeginDate; // Fecha de inicio, formato ISO.
        oAddOvensData.BeginTime = iBeginTime; // Hora de inicio, ejemplo: "08:30:00".
        oAddOvensData.EndDate = iEndDate; // Fecha de fin, formato ISO.
        oAddOvensData.IsDeclared = iIsDeclared; // Booleano para indicar si está declarado, en este caso verdadero.
        oAddOvensData.Utime = iUtime; // Fecha y hora de la última actualización, formato ISO.
        oAddOvensData.Udate = iUdate; // Fecha y hora de la última actualización, formato ISO.
        oAddOvensData.EndTime = iEndTime; // Hora de fin, ejemplo: "12:30:00".
        oAddOvensData.Gamng = parseInt(iGamng).toFixed(3); // Cantidad planificada
        oAddOvensData.CantRest = parseInt(iCantRest).toFixed(3); //Cantidad restante

        var sPath = "/ProductionDeclarationSet(Werks='',Aufnr='" + iAufnr + "',Operario='')"
        var sProduction = this.getView().getModel("ZDOM_0000_SRV_01").getProperty(sPath);
        oAddOvensData.Description = sProduction.Description;
        oAddOvensData.DesComponent = sProduction.DesComponent;

        oGlobalBusyDialog.open();
        this.getView()
          .getModel("ZDOM_0000_SRV_01")
          .create("/OvenRecordsSet", oAddOvensData, {
            method: "POST",
            success: function (data) {
              // Load Table
              //me.loadModelUm(data);
              // refresh popupData
              me.onClean(true);
              this.getOvensRecords();
              oGlobalBusyDialog.close();
              me._dialog.close();
            }.bind(this),
            error: function (data) {
              me.onClean(true);
              oGlobalBusyDialog.close();
              me._dialog.close();
            },
          });
      },

      getOvensRecords: function () {
        let oModel = me.getView().getModel("modelOperario");
        let oData = oModel.getData();

        let oParameters = {
          urlParameters: {
            Werks: oData.Plant,
            WorkCtr: oData.WorkCenter,
          },
        };

        let oFilters = [];

        oFilters.push(new sap.ui.model.Filter("Werks", FilterOperator.EQ, oData.Plant));
        oFilters.push(new sap.ui.model.Filter("WorkCtr", FilterOperator.EQ, oData.WorkCenter));

        oGlobalBusyDialog.open();

        me.getView()
          .getModel("ZDOM_0000_SRV_01")
          .read("/OvenRecordsSet", {
            filters: oFilters,
            urlParameters: oParameters.urlParameters,
            method: "GET",
            success: function (data) {
              me.onCreateModelOvens(data);
              oGlobalBusyDialog.close();
            },
            error: function (data) {
              oGlobalBusyDialog.close();
            },
          });
      },

      formatTime: function (pValue) {
        var timeValue = pValue;
        var timeParts = timeValue.split(":");
        var formattedTime =
          "PT" + timeParts[0] + "H" + timeParts[1] + "M" + timeParts[2] + "S";

        return formattedTime;
      },

      presentTime: function () {
        // Obtén la hora actual
        var currentDate = new Date();

        // Extrae horas, minutos y segundos
        var hours = currentDate.getHours();
        var minutes = currentDate.getMinutes();
        var seconds = currentDate.getSeconds();

        // Formatea en el estándar OData Edm.Time
        var formattedTime = "PT" + hours + "H" + minutes + "M" + seconds + "S";

        return formattedTime;
      },

      updateOvenRecord: function (sPath, oRequest) {
        return new Promise(function (resolve, reject) {
          this.getView().getModel("ZDOM_0000_SRV_01").update(
            sPath,
            oRequest,
            {
              method: "PUT",
              success: resolve,
              error: reject
            });
        }.bind(this));
      },

      onUpdateOvenRecords(param, oDataForProcess) {
        //param = declare
        //param = delete

        for (var i = 0; i < oDataForProcess.length; i++) {
          var oAddOvensData = {};
          oAddOvensData.Guid = oDataForProcess[i].Guid;

          if (param === "delete") {
            oAddOvensData.IsDeleted = true;
          } else if (param === "declare") {
            oAddOvensData.IsDeclared = true;
          }

          oGlobalBusyDialog.open();
          let path = "/OvenRecordsSet(Guid=guid'" +
            oDataForProcess[i].Guid +
            "')";

          this.updateOvenRecord(path, oAddOvensData).then(function (oData) {
            oGlobalBusyDialog.close();
            if (response.status < 400) {
              return true;
            }
          }.bind(this)).catch((oError) => {
            oGlobalBusyDialog.close();
            return false;
          }).finally(function (info) {

          })
        }

        oGlobalBusyDialog.close();
      },

      handleMessagePopoverPress: function (oEvent) {
        oMessagePopover.toggle(oEvent.getSource());
      },

      ReadEntity: function (sPath, aFilter) {

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

    });
  }
);
