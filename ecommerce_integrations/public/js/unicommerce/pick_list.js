frappe.ui.form.on('Pick List', {
	purpose(frm) {
		if (frm.doc.purpose=='Delivery') {
            frm.trigger('add_get_so_items_button');
		}
	},
    refresh(frm){
        cur_frm.add_custom_button(__('Generate Invoice'), () => frm.trigger('generate_invoice'))
        me.frm.set_df_property("business_type", "set_only_once", 1);
        if (frm.doc.purpose == 'Delivery'){
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
    onload(frm){
        frappe.db.get_single_value("Stock Settings", "scanning_required_b2c").then( val => {
			if(val == 0){
            cur_frm.set_df_property("scan_barcode", "hidden", 1)
            }
        })
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
        frappe.db.get_single_value("Stock Settings", "scanning_required_b2c").then((r)=>{
            console.log(r)
            if (r) {
                $.each(frm.doc.locations||[], function(i, d) {
                    if (d.picked_qty != d.qty) {
                        console.log(d)
                        return
                    }
                })
                console.log('test')
                cur_frm.add_custom_button(__('Generate Invoice'), () => frm.trigger('generate_invoice'))
            }
            else {
                cur_frm.add_custom_button(__('Generate Invoice'), () => frm.trigger('generate_invoice'))
            }
        })
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
	const warehouse_allocation = {};
	selected_so.forEach(function(so) {
    		const item_details = frm.doc.locations.map((item) => {
    		if (item.sales_order == so && item.picked_qty > 0){
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
                console.log(so_item_list)
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
