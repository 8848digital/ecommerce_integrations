import frappe
import json

@frappe.whitelist()
def validate_partial_picking(so_item_list):
	#so_item_list = filters.get('so_item_list')
	if isinstance(so_item_list, str):
		so_item_list = json.loads(so_item_list)
	for so in so_item_list:
		so_item_doc = frappe.get_doc("Sales Order Item",so['so_item'])
	if (((so_item_doc.picked_qty + so['qty'] )/ so_item_doc.qty)*100) > (100 + frappe.db.get_single_value('Stock Settings', 'over_delivery_receipt_allowance')):
        	frappe.throw('You are picking more than required quantity for ' + so_item_doc.item_code + '. Check if there is any other picklist for ' + so_item_doc.parent)

