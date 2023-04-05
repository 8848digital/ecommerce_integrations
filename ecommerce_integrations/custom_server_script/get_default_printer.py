import frappe

@frappe.whitelist()
def get_available_printer_and_data_to_print( user,invoice_url,label_url,warehouse):
	data = frappe.form_dict
	printer = ""
	if data.user and data.warehouse:
		printer = frappe.db.get_value('Network Printer Template', {'warehouse': data.warehouse, 'user': data.user}, 'printers')

	invoice_base_64 = ""
	if data.invoice_url:
	    invoice_base_64 = frappe.utils.cstr(frappe.utils.pdf_to_base64(data.invoice_url))

	label_base_64 = ""
	if data.label_url:
    		label_base_64 = frappe.utils.cstr(frappe.utils.pdf_to_base64(data.label_url))
	frappe.response['message'] = {
    		"printer": printer,
    		"invoice_base_64": invoice_base_64,
    		"label_base_64": label_base_64
	}
