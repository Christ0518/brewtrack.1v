type ReceiptLineItem = {
	productName: string;
	quantity: number;
	lineTotal: number;
};

type ReceiptTemplateData = {
	referenceNumber: string;
	shopName: string;
	customerName: string;
	orderType: "dine-in" | "takeout";
	createdAt: string;
	subtotal: number;
	discount: number;
	total: number;
	paid: number;
	change: number;
	items: ReceiptLineItem[];
	receiptHeader?: string;
	receiptFooter?: string;
};

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function buildBarceloReceiptHtml(data: ReceiptTemplateData) {
	return `
	<html>
	<head>
		<title>${escapeHtml(data.shopName)} Receipt - ${escapeHtml(data.referenceNumber)}</title>
		<style>
			body { font-family: 'Courier New', monospace; padding: 20px; font-size: 12px; max-width: 300px; margin: 0 auto; color: #0f172a; }
			.brand { text-align: center; color: #073dbe; font-weight: 800; font-size: 18px; margin-bottom: 2px; }
			.ref { text-align: center; font-size: 11px; color: #334155; }
			.divider { border-top: 1px dashed #0f172a; margin: 10px 0; }
			.row { display: flex; justify-content: space-between; margin: 5px 0; gap: 8px; }
			.row span:last-child { text-align: right; }
			.bold { font-weight: 700; }
			.total { font-size: 14px; color: #073dbe; font-weight: 800; }
			.footer { text-align: center; margin-top: 14px; font-size: 10px; color: #334155; }
		</style>
	</head>
	<body>
		<div class="brand">${escapeHtml(data.shopName)}</div>
		<div class="ref">Reference: ${escapeHtml(data.referenceNumber)}</div>
		${data.receiptHeader ? `<div class="footer">${escapeHtml(data.receiptHeader)}</div>` : ""}
		<div class="divider"></div>
		<div class="row"><span>Datetime:</span><span>${escapeHtml(data.createdAt)}</span></div>
		<div class="row"><span>Customer:</span><span>${escapeHtml(data.customerName || "Walk-in")}</span></div>
		<div class="row"><span>Type:</span><span>${data.orderType === "dine-in" ? "DINE IN" : "TAKEOUT"}</span></div>
		<div class="divider"></div>
		${data.items
			.map(
				(item) => `<div class="row"><span>${escapeHtml(item.productName)} x${item.quantity}</span><span>PHP ${item.lineTotal.toFixed(2)}</span></div>`
			)
			.join("")}
		<div class="divider"></div>
		<div class="row"><span>Subtotal:</span><span class="bold">PHP ${data.subtotal.toFixed(2)}</span></div>
		${data.discount > 0 ? `<div class="row"><span>Discount:</span><span>-PHP ${data.discount.toFixed(2)}</span></div>` : ""}
		<div class="row total"><span>Total:</span><span>PHP ${data.total.toFixed(2)}</span></div>
		<div class="row"><span>Cash:</span><span>PHP ${data.paid.toFixed(2)}</span></div>
		<div class="row"><span>Change:</span><span>PHP ${Math.max(0, data.change).toFixed(2)}</span></div>
		<div class="divider"></div>
		<div class="footer">${data.receiptFooter ? escapeHtml(data.receiptFooter) : "Thank you for visiting Barcelo"}</div>
	</body>
	</html>
	`;
}
