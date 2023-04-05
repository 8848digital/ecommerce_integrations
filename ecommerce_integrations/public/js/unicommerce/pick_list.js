frappe.ui.form.on('Pick List', {
	purpose(frm) {
		if (frm.doc.purpose=='Delivery') {
		    //&& frm.doc.workflow_state != 'Invoice Generated')
            //  frm.remove_custom_button('Get Items');
            frm.trigger('add_get_so_items_button');
		}
	},

    refresh(frm){
        cur_frm.add_custom_button(__('Generate Invoice'), () => frm.trigger('generate_invoice'))
        me.frm.set_df_property("business_type", "set_only_once", 1); 
        if (frm.doc.purpose == 'Delivery'){
            // frm.remove_custom_button('Get Items');
            if (frm.doc.docstatus == 1 && frm.doc.business_type == 'B2C')
                frm.remove_custom_button('Delivery Note', "Create");
            frm.trigger('add_get_so_items_button');
            
			frm.set_df_property('order_details', 'cannot_add_rows', 1);
			
			if (frm.doc.workflow_state == 'Picking Completed' || frm.doc.workflow_state == 'Invoice Generated'){
			    frm.set_df_property('order_details', 'cannot_delete_rows', 1);
			    frm.set_df_property('order_details', 'cannot_delete_all_rows', 1);
			    frm.set_df_property('locations', 'cannot_delete_rows', 1);
			    frm.set_df_property('locations', 'cannot_delete_all_rows', 1);
			}
        }
    },
    
    render_selected_so_in_modal(frm) {
        setTimeout(() => {
            if (frm.so_modal.fields) {
                frm.so_modal.fields[0]['change'] = function() {
			        frm.trigger('render_selected_so_in_modal');
			    }
            }
                debugger
            if ($(frm.so_modal.dialog.get_field('results_area').$wrapper[0]).find('.orders_count')) {
                $(frm.so_modal.dialog.get_field('results_area').$wrapper[0]).find('.orders_count').remove();
            }
        
		    let total_count = $(frm.so_modal.dialog.get_field('results_area').$wrapper[0]).find('.list-row-check').length - 1
		    let checked_count = $(frm.so_modal.dialog.get_field('results_area').$wrapper[0]).find('.list-row-check:checked').length || 0;
			let div = __('<div style="text-align:center" class="orders_count"> Selected {0} of <b>{1}</b> </div>', [checked_count, total_count]);
            frm.so_modal.dialog.get_field('results_area').$wrapper.append(div); 
            
            $(frm.so_modal.dialog.get_field('results_area').$wrapper[0]).find('.list-row-check').click((e) => {
                let checked_count = 0;
                if ($(e.target).attr('data-item-name') === 'undefined') {
                    checked_count = $(e.target).is(':checked') ? 
                        $(frm.so_modal.dialog.get_field('results_area').$wrapper[0]).find('.list-row-check').length - 1: 0;
                } else {
                    checked_count = $(frm.so_modal.dialog.get_field('results_area').$wrapper[0]).find('.list-row-check:checked').length || 0;
                }

                let div = __('<div style="text-align:center" class="orders_count"> Selected {0} of <b>{1}</b> </div>', [checked_count, total_count]);
                $(frm.so_modal.dialog.$wrapper[0]).find('.orders_count').html(div);
            });
                
		}, 1200);
    },

    validate(frm){ 
        if (frm.doc.purpose == 'Delivery'){
            // frm.remove_custom_button('Get Items');
            frm.trigger('add_get_so_items_button');
            let selected_so = frm.get_field('order_details').grid.get_selected_children()
           
        }
    },

    after_save(frm){
        for (var i in frm.doc.order_details){
	    if (frm.doc.order_details[i].pick_status === 'Fully Picked' && frm.doc.order_details[i].print_status != 'Printed')
            print_invoice_and_label(frm.doc.order_details[i],frm.doc.parent_warehouse)
        }
    },
	generate_invoice(frm){
	   // let selected_so = frm.get_field('order_details').grid.get_selected_children()
	   let selected_so = []
	    var tbl = cur_frm.doc.order_details || []; 
        for(var i = 0; i < tbl.length; i++) {
            selected_so.push(tbl[i].sales_order)
        }
        let sales_orders = [];
        let so_item_list = [];
	   // if (selected_so.length === 0)
    //         frappe.throw('Kindly select a Sales Order to Generate Invoice!' )

    //     else{
     	    const warehouse_allocation = {};
	        
            selected_so.forEach(function(so) {
    			const item_details = frm.doc.locations.map((item) => {
    			    if (item.sales_order == so){
    			        so_item_list.push({so_item:item.sales_order_item,
    			                          qty:item.qty
    			                          });
    			        
		        		return {
			        		sales_order_row: item.sales_order_item,
				        	item_code: item.item_code,
					        warehouse: item.warehouse,
					        shelf:item.shelf
	    			        }
    			        }
    			      else{return {} }
		    	    });
		    	sales_orders.push(so);
			    warehouse_allocation[so] = item_details.filter(value => Object.keys(value).length !== 0);
			 //   let item_detail = lst.length
			 //   for (let k = 0; k < item_detail.length; k++){
			 //          console.log(item_detail[k]['item_code'])
			 //   }
                });
                frappe.call({
			        method: 'ecommerce_integrations.custom_server_script.partial_picking.validate_partial_picking',
			        args: {
				        'so_item_list': so_item_list
				        }
		                })
                 frappe.call({
					    	method:
						    	"ecommerce_integrations.unicommerce.invoice.generate_unicommerce_invoices",
						    args: {
							    sales_orders: sales_orders,
							    warehouse_allocation: warehouse_allocation
						    },
						freeze: true,
						freeze_message: "Requesting Invoice generation. Once synced, invoice will appear in linked documents.",
					});
            // }
        },
	
	add_get_so_items_button: (frm) => {
		let purpose = frm.doc.purpose;
		if (purpose != 'Delivery' || frm.doc.docstatus !== 0) return;
		let get_query_filters = {
			docstatus: 1,
			per_billed: ['<',100],
			per_picked:['<',100],
			per_delivered: ['<', 100]
		};
	    if (frm.doc.workflow_state == 'Draft'){
		frm.get_items_btn = frm.add_custom_button(__('Get SO Items'), () => {
			frm.so_modal = erpnext.utils.map_current_doc({
				method: 'erpnext.selling.doctype.sales_order.sales_order.create_pick_list',
				source_doctype: 'Sales Order',
				target: frm,
				size:'extra-large',
				setters: [
				        {
    						fieldtype: 'Link',
    						label: __('Unicommerce Channel'),
    						options: 'Unicommerce Channel',
    						fieldname: 'unicommerce_channel_id',
    						change: function() {
    						    frm.trigger('render_selected_so_in_modal');
    						}
					    },
					    {
    						fieldtype: 'Link',
    						label: __('Warehouse'),
    						options: 'Warehouse',
    						fieldname: 'main_warehouse',
    						change: function() {
    						    frm.trigger('render_selected_so_in_modal');
    						}
					    },
				        {
    						fieldtype: 'Select',
    						label: __('Business Type'),
                            read_only: 1,
    						fieldname: 'business_type',
    						default: me.frm.doc.business_type,
    						change: function() {
    						    frm.trigger('render_selected_so_in_modal');
    						}
					    },
					    {
    						fieldtype: 'Select',
    						label: __('No of Items'),
    						options: ['','Single','Multiple'],
    						fieldname: 'no_of_items',
    					    default: '',
    					    change: function() {
    						    frm.trigger('render_selected_so_in_modal');
    						}
					    }
					],
				date_field: 'transaction_date',
				get_query_filters: get_query_filters
			});
			
			frm.trigger('render_selected_so_in_modal');
		});
		
	    }
	},
// 		scan_barcode(frm) {
// 	    let start_scanning = 0
//         for (var i in frm.doc.order_details){
//             if (frm.doc.order_details[i].sales_invoice)
//                 start_scanning = 1
//                 break;
//         }
//         if (start_scanning === 0)
//             frappe.throw('You can start scanning only if atleast one Invoice is generated!')
            
// 		let scan_barcode_field = frm.fields_dict["scan_barcode"];

// 		let show_description = function(idx, exist = null) {
// 			if (exist) {
// 				frappe.show_alert({
// 					message: __(' {0}: Picked Qty increased by 1', [exist]),
// 					indicator: 'green'
// 				});
// 			} else {
// 				frappe.show_alert({
// 					message: __('Item not found in pick list'),
// 					indicator: 'red'
// 				});
// 			}
// 		}

// 		if(frm.doc.scan_barcode) {
// 			frappe.call({
// 				method: "erpnext.selling.page.point_of_sale.point_of_sale.search_for_serial_or_batch_or_barcode_number",
// 				args: { search_value: frm.doc.scan_barcode }
// 			    }).then(r => {
// 				    const data = r && r.message;
// 				    if (!data || Object.keys(data).length === 0) {
//         					frappe.call({
//         				method: "search_by_item_code",
//         				args: { search_value: frm.doc.scan_barcode }
//         			    }).then(r => {
//         				    const data = r && r.message;
//         				    if (!data || Object.keys(data).length === 0) {
        				            
//                 					frappe.show_alert({
//                 						message: __('Cannot find Item with this Code!'),
//                 						indicator: 'red'
//                 					});
//                 	 				return;
//             				    }
				
// 				let row_to_modify = null;
// 				let locations = frm.doc.locations; 
// 				locations.sort(function(a, b){
//                     let x = a.no_of_items.toLowerCase();
//                     let y = b.no_of_items.toLowerCase();
//                     if (x < y) {return 1;}
//                     if (x > y) {return -1;}
//                     return 0;
//                 });
//                 const existing_item_row = locations.find(d => (d.item_code == data.item_code && d.picked_qty < d.qty));
// 				if (existing_item_row) {
// 					row_to_modify = existing_item_row;
// 				} 
// 				if (!row_to_modify) {
//     				scan_barcode_field.set_value('');
//                     frappe.msgprint("Item not found in pick list or has been picked already!");		
//                     return;
// 				}
//                 else{
// 				    show_description(row_to_modify.idx, row_to_modify.item_code);
//                 }
// 				frm.from_barcode = frm.from_barcode ? frm.from_barcode + 1 : 1;

// 				frappe.model.set_value(row_to_modify.doctype, row_to_modify.name, {
// 					item_code: data.item_code,
// 					picked_qty: (row_to_modify.picked_qty || 0) + 1
// 				});

// 				let so_data = [];
// 				const title = __('Pending Items in Sales Order');
//                 const fields = [
//                         {
//                                 fieldname: 'sales_order',
//                                 read_only: 1,
//                                 fieldtype:'Data',
//                                 label: __('Sales Order'),
//                                 default: row_to_modify.sales_order
//                         },
//                         {
//                                 fieldname: 'col_brk',
//                                 read_only: 1,
//                                 fieldtype:'Column Break'
//                         },
//                         {
//                                 label:__('Scan Barcode'),
//                                 fieldname: 'scan_barcode_for_so',
//                                 read_only: 0,
//                                 fieldtype:'Data',
//                                 default: "",
//                                 change:function() {
// 					                let val = this.get_value();
					                
// 					                if (val){
// 					                    frm.events.pick_items(frm.pl_dialog,val); 
//                                     frm.pl_dialog.fields_dict.pending_items.grid.refresh();}
// 				                }
//                         },
//                         {
//                                 fieldname: 'sec_brk',
//                                 read_only: 1,
//                                 fieldtype:'Section Break'
//                         },
//                         {
//                             fieldname: 'pending_items',
//                             read_only: 1,
//                             fieldtype:'Table',
//                             cannot_add_rows: 'True' ,
//                             cannot_delete_rows: 'True',
//                             cannot_edit_rows: 'True',
//                             in_place_edit: 1,
//                             label:__('Pending Items'),
//                             fields:[
//                             {
//                                 fieldname: 'item_code',
//                                 read_only: 1,
//                                 fieldtype:'Data',
//                                 label: __('Item'),
//                                 in_list_view: 1
//                             },
//                             {
//                                 fieldname: 'item_barcode',
//                                 read_only: 1,
//                                 fieldtype:'Data',
//                                 hidden: 0,
//                                 in_list_view: 0
//                             },
//                             {
//                                 fieldname: 'qty',
//                                 read_only: 1,
//                                 fieldtype:'Data',
//                                 label: __('Qty'),
//                                 in_list_view: 1,
//                             },
//                             {
//                                 fieldname: 'picked_qty',
//                                 read_only: 1,
//                                 fieldtype:'Data',
//                                 label: __('Picked Qty'),
//                                 in_list_view: 1,
//                             },
//                             {
//                                 fieldname: 'row_name',
//                                 hidden: 1,
//                                 fieldtype:'Data',
//                                 label: __('Row Name'),
//                                 in_list_view: 0
//                             }],
//                             data:so_data
//                         }
//                 ];
//                 frm.pl_dialog = new frappe.ui.Dialog({
//                         title: title,
//                         fields: fields,
//                         primary_action: function(values) {
//                             frm.events.update_pending_items(frm,values);
//         			    },
// 			            primary_action_label: __('Update')
//                 }); 
//                 frappe.call({
// 			        method: 'fetch_items_in_so',
// 			        args: {
// 				        'so_no': row_to_modify.sales_order,
// 				        'pl_no':frm.doc.name
// 				        }
// 		                }).then(r => {
//                             so_data = r.message;
                            
//                             var picked_qty;
//                             for (var d in so_data){
//                                 if (so_data[d].item_code == row_to_modify.item_code && row_to_modify.name == so_data[d].name) 
//                                     picked_qty = so_data[d].picked_qty+1
//                                 else
//                                     picked_qty = so_data[d].picked_qty
                                    
//                                 frm.pl_dialog.fields_dict.pending_items.df.data.push({
//                                     'item_code': so_data[d].item_code,
//                                     'qty': so_data[d].qty,
//                                     'picked_qty': picked_qty,
//                                     'item_barcode': so_data[d].barcode,
//                                     'row_name':so_data[d].name
//                                     });
//                                 }

//                         frm.pl_dialog.fields_dict.pending_items.grid.refresh();
// 		                frm.pl_dialog.show();
                
// 			        scan_barcode_field.set_value('');
// 			        refresh_field("items");
// 			    });
// 			});
				    
//         			    }
// 				    })
// 		}
// 		return false;
// 	},


    pick_items:function(dialog,val)
    {  let doc = dialog.get_values();
            for (var i in doc.pending_items){
                if (doc.pending_items[i].item_barcode == val && doc.pending_items[i].qty > doc.pending_items[i].picked_qty)
                    { 
                        doc.pending_items[i].picked_qty = doc.pending_items[i].picked_qty + 1 
                        break;
                    }
            }
        
        dialog.set_value("scan_barcode_for_so",'')        
    },
    
    update_pending_items(frm,values) {
        debugger
        values.pending_items.forEach(d => {
            frappe.model.set_value("Pick List Item", d.row_name, "picked_qty", d.picked_qty);
            });

	    frm.save();
	    frm.pl_dialog.hide();
	    },
    })
    
frappe.ui.form.on('Pick List Sales Order Details', {
    
// 	print_invoice(frm, cdt, cdn) {
//         let default_site = 'mydev'    
// 	    let row = locals[cdt][cdn];

// 	    if (!row.sales_invoice)
// 	        frappe.throw('Generate Invoice for row ' + row.idx +', to print!')

// 	    if (!row.pick_status)
// 	        frappe.throw('Cannot Print Invoice for row ' + row.idx + ' until the order is Picked!')
	   
// 	    frappe.model.set_value(cdt, cdn, "print_status", 'Printed');
// 	    refresh_field('print_status');
//         if (row.label_url){
// 	    frappe.call({
// 				method: 'frappe.utils.print_format.print_by_server',
// 				args: {
// 					doctype: me.frm.doc.doctype,
// 					name: me.frm.doc.name,
// 					printer_setting: localStorage.getItem('network_printer'),
// 					file:row.label_url
// 					},
// 		        callback: function() {
// 	               }
//     	    });
	        
// 	    }
// 	    if (row.invoice_url){
// 	    frappe.call({
// 				method: 'frappe.utils.print_format.print_by_server',
// 				args: {
// 					doctype: me.frm.doc.doctype,
// 					name: me.frm.doc.name,
// 					printer_setting: localStorage.getItem('network_printer'),
// 					file:row.invoice_url
// 					},
// 				callback: function() {
// 	                    frappe.model.set_value(cdt, cdn, "print_status", 'Printed');
// 	                    refresh_field('print_status');},
// 		        });
// 	    }
// 	    frm.save();
	    
// 	},
	    
	print_invoice(frm, cdt, cdn) {
	    let row = locals[cdt][cdn];
        print_invoice_and_label(row)

	},
	    
	before_order_details_remove(frm,cdt,cdn){
        let row = locals[cdt][cdn];
        if (row.sales_invoice)
            frappe.throw('Cannot Delete Order ' + row.sales_order + ',as invoice '+ row.sales_invoice +' has already been generated!')
        for (var i in frm.doc.locations){
            if (frm.doc.locations[i].sales_order == row.sales_order)
                {
                    frm.get_field("locations").grid.grid_rows[i].remove();
            }
        }
	}
});
function print_invoice_and_label(row,parent_warehouse){

	    frappe.call({
	        method: 'ecommerce_integrations.custom_server_script.get_default_printer.get_available_printer_and_data_to_print',
	        args: {
	            user: user,
	            invoice_url: row.invoice_url,
	            label_url:row.label_url,
	            warehouse: parent_warehouse
	        }
	    }).then((r) => {
	        let printer_name = r.message.printer;
	        let site_name = frappe.urllib.get_base_url();
	        if (row.invoice_url) {
    	        let args = [{
    	            type: 'pixel',
                    format: 'pdf',
                    flavor: 'base64',
                    data: r.message.invoice_base_64,
                    options: { pageWidth: 4  }
    	        }]
	        
    	        frappe.ui.form.qz_connect().then(() => {
    	            let config = qz.configs.create(printer_name);
    	            qz.print(config, args)
    	        })
	        }
	        
	        if (row.label_url) {
    	        let args = [{
    	            type: 'pixel',
                    format: 'pdf',
                    flavor: 'base64',
                    data: r.message.label_base_64,
                    options: { pageWidth: 4  }
    	        }]
	        
    	        frappe.ui.form.qz_connect().then(() => {
    	            let config = qz.configs.create(printer_name);
    	            qz.print(config, args)
    	        })
	        }
	    })
	    }
