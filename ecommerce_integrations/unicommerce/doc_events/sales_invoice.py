import frappe

@frappe.whitelist()
def on_submit(self, method = None):
	sales_order = self.get('items')[0].sales_order
	attached_docs = frappe.get_all("File",
			fields=['file_name'],
			filters={'attached_to_name':self.name,'file_name': ('like', 'unicommerce%')},
			order_by="file_name"
	)
	url = frappe.get_all("File",
		fields=['file_url'],
		filters={'attached_to_name':self.name,'file_name': ('like', 'unicommerce%')},
		order_by="file_name"
	)
	pi_so = frappe.get_all("Pick List Sales Order Details",fields = ['name','parent'], filters = [{'sales_order' : sales_order,"docstatus" : 0}])
	for pl in pi_so:
		if not pl.parent or not frappe.db.exists('Pick List', pl.parent):
			continue
		if attached_docs:
			frappe.db.set_value("Pick List Sales Order Details", pl.name, {
					"sales_invoice": self..name,
					"invoice_url":attached_docs[0].file_name,
					# "label_url":attached_docs[1].file_name,
					"invoice_pdf":url[0].file_url,
					# "label_pdf":url[1].file_url
			})
		else:
			frappe.db.set_value("Pick List Sales Order Details",pl.name,{"sales_invoice":doc.name})
		is_invoice_generated = 1
		pl_doc = frappe.get_doc("Pick List",pl.parent)
		for i in pl_doc.get('order_details'):
			if not i.sales_invoice:
				is_invoice_generated = 0
				break;
		if is_invoice_generated :
			frappe.db.set_value("Pick List",pl.parent,"workflow_state","Invoice Generated")


@frappe.whitelist()
def on_cancel(self, method = None):
	results = frappe.db.get_all("Pick List Sales Order Details", filters={"sales_invoice": self.name, "docstatus": 1})
	if results:
		self.flags.ignore_links = True
