from collections import defaultdict
from typing import Dict

import frappe
from frappe.utils import cint, now
from datetime import datetime 
from ecommerce_integrations.controllers.inventory import (
	get_inventory_levels,
	get_inventory_levels_of_group_warehouse,
	update_inventory_sync_status,
)
from ecommerce_integrations.controllers.scheduling import need_to_run
from ecommerce_integrations.unicommerce.api_client import UnicommerceAPIClient
from ecommerce_integrations.unicommerce.constants import MODULE_NAME, SETTINGS_DOCTYPE

# Note: Undocumented but currently handles ~1000 inventory changes in one request.
# Remaining to be done in next interval.
MAX_INVENTORY_UPDATE_IN_REQUEST = 1000


def update_inventory_on_unicommerce(client=None, force=False):
	"""Update ERPnext warehouse wise inventory to Unicommerce.

	This function gets called by scheduler every minute. The function
	decides whether to run or not based on configured sync frequency.

	force=True ignores the set frequency.
	"""
	settings = frappe.get_cached_doc(SETTINGS_DOCTYPE)
	if not settings.is_enabled() or not settings.enable_inventory_sync:
		return

	# check if need to run based on configured sync frequency
	if not force and not need_to_run(
		SETTINGS_DOCTYPE, "inventory_sync_frequency", "last_inventory_sync"
	):
		return

	# get configured warehouses
	# warehouses = settings.get_erpnext_warehouses()
	warehouses = settings.get_warehouses()
	wh_to_facility_map = settings.get_erpnext_to_integration_wh_mapping()

	if client is None:
		client = UnicommerceAPIClient()

	# track which ecommerce item was updated successfully
	success_map: Dict[str, bool] = defaultdict(lambda: True)
	inventory_synced_on = now()

	for warehouse in warehouses:
		if warehouse['shelf']:
			return shelf_bulk_update(warehouse,settings)
		warehouse = warehouse['erpnext_warehouse']
		is_group_warehouse = cint(frappe.db.get_value("Warehouse", warehouse, "is_group"))
		if is_group_warehouse:
			erpnext_inventory = get_inventory_levels_of_group_warehouse(
				warehouse=warehouse, integration=MODULE_NAME
			)
		else:
			erpnext_inventory = get_inventory_levels(warehouses=(warehouse,), integration=MODULE_NAME)
		if not erpnext_inventory:
			continue
		erpnext_inventory = erpnext_inventory[:MAX_INVENTORY_UPDATE_IN_REQUEST]

		# TODO: consider reserved qty on both platforms.
		inventory_map = {d.integration_item_code: cint(d.actual_qty) for d in erpnext_inventory}
		facility_code = wh_to_facility_map[warehouse]
		frappe.log_error(facility_code, "facility_code")
		response, status = client.bulk_inventory_update(
			facility_code=facility_code, inventory_map=inventory_map
		)
		#frappe.log_error("response", str([response,response.json(), status]))
		if status:
			# update success_map
			sku_to_ecom_item_map = {d.integration_item_code: d.ecom_item for d in erpnext_inventory}
			for sku, status in response.items():
				ecom_item = sku_to_ecom_item_map[sku]
				# Any one warehouse sync failure should be considered failure
				success_map[ecom_item] = success_map[ecom_item] and status
	_update_inventory_sync_status(success_map, inventory_synced_on)


def _update_inventory_sync_status(ecom_item_success_map: Dict[str, bool], timestamp: str) -> None:
	for ecom_item, status in ecom_item_success_map.items():
		if status:
			update_inventory_sync_status(ecom_item, timestamp)


def shelf_bulk_update(warehouse,settings):
	warehouse = warehouse['erpnext_warehouse']
	shelves = frappe.get_list('Shelf',{'warehouse':warehouse,'disable':0},['shelf_name','type'])
	is_group_warehouse = cint(frappe.db.get_value("Warehouse", warehouse, "is_group"))
	if is_group_warehouse:
		erpnext_inventory = get_inventory_levels_of_group_warehouse(
			warehouse=warehouse, integration=MODULE_NAME
		)
	else:
		erpnext_inventory = get_inventory_levels(warehouses=(warehouse,), integration=MODULE_NAME)

	if not erpnext_inventory:
		return

	# erpnext_inventory = erpnext_inventory[:MAX_INVENTORY_UPDATE_IN_REQUEST]
	report = frappe.get_doc("Report", "Stock Ledger")
	wh_to_facility_map = settings.get_erpnext_to_integration_wh_mapping()
	facility_code = wh_to_facility_map[warehouse]
	inventory_list = []
	for shelf in shelves: 
		inventoryType = "GOOD_INVENTORY"
		if shelf.type == 'Unsellable':
			inventoryType = "BAD_INVENTORY"
		for item in erpnext_inventory:
			custom_filter ={
				"company":"Lifelong Online Retail Private Limited",
				"from_date":datetime.today().strftime("%Y-%m-%d"),
				"to_date":datetime.today().strftime("%Y-%m-%d"),
				"warehouse":warehouse,
				"shelf": shelf.shelf_name,
				"item_code": item.item_code
				}
			columns, data = report.get_data(
				limit=1, filters=custom_filter, as_dict=True
			)
			if len(data)>0:
				data = data[0] 
				inventory_list.append({
					"itemSKU": item.item_code,
					"quantity": data['qty_after_transaction'],
					"shelfCode": shelf,  
					"inventoryType": inventoryType,
					"adjustmentType": "REPLACE",
					"facilityCode": facility_code,
				})
	inventory_list = inventory_list[:MAX_INVENTORY_UPDATE_IN_REQUEST]
	client = UnicommerceAPIClient()
	response, status = client.bulk_inventory_update(
			facility_code=facility_code, inventory_map={'sku':1},inventory_adjustments=inventory_list
		)
	if status:
			success_map: Dict[str, bool] = defaultdict(lambda: True)
			# update success_map
			sku_to_ecom_item_map = {d.integration_item_code: d.ecom_item for d in erpnext_inventory}
			for sku, status in response.items():
				ecom_item = sku_to_ecom_item_map[sku]
				# Any one warehouse sync failure should be considered failure
				success_map[ecom_item] = success_map[ecom_item] and status

	_update_inventory_sync_status(success_map, now())

		
