"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CREDENTIALS = [
  { userId: "01KKJTHN26SFYMFWEB4EYQSV62", apiKey: "019ce5a8-d446-74ab-8c02-3d7c26ccc29e" },
  { userId: "01KKK1KZ9PKGNPX11VD9FV76NC", apiKey: "019ce619-fd36-7afa-860b-bf7742815867" },
  { userId: "01KKK1PC9D4MY34SD4ZK9Z066E", apiKey: "019ce61b-312d-7cd6-94c7-20f55c44aab8" },
];

interface BillPreviewProps {
  bill: {
    id: string;
    date: Date | string;
    total: number;
    discount?: number;
    type: "SALES" | "PURCHASE";
    party: {
      name: string;
      balance: number;
    };
    items: Array<{
      product: { name: string; variant: string; company: string; cartonSize?: number };
      quantity: number;
      price: number;
    }>;
  };
  onClose?: () => void;
  mode?: "modal" | "page";
  companyName?: string;
}

export function BillPreview({ bill, onClose, mode = "modal", companyName = "Horizon" }: BillPreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const billRef = useRef<HTMLDivElement>(null);

  const formatQuantity = (quantity: number, cartonSize?: number) => {
    if (!cartonSize || cartonSize <= 1) return `${quantity} PCS`;
    const cartons = Math.floor(quantity / cartonSize);
    const pieces = quantity % cartonSize;
    if (cartons === 0) return `${pieces} PCS`;
    if (pieces === 0) return `${cartons} CN`;
    return `${cartons} CN • ${pieces} PCS`;
  };

  const generateBillHTML = () => {
    const formattedDate = new Date(bill.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const hideTotals = bill.id === "NEXT_ORDER_PREVIEW";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { font-family: 'Inter', sans-serif; background: white; margin: 0; padding: 0; }
          .bill-container {
            width: 500px;
            margin: 0 auto;
            background: white;
            padding: 1.5rem;
            box-sizing: border-box;
          }
          .watermark {
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
            margin-top: 2rem;
            padding-top: 0.5rem;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="bill-container">
          <div class="border-b-2 border-gray-800 pb-6 mb-6">
            <h2 class="text-xl font-bold text-indigo-700">${companyName}</h2>
            <p class="text-sm text-gray-600">Date: ${formattedDate}</p>
          </div>

          <div class="mb-8">
            <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              ${bill.type === "PURCHASE" ? "Order From:" : "Billed To:"}
            </p>
            <p class="text-lg font-bold text-gray-900">${bill.party.name}</p>
          </div>

          <table class="w-full mb-8">
            <thead>
              <tr class="border-b border-gray-300">
                <th class="py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Item</th>
                <th class="py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Qty</th>
                ${bill.type === "SALES" ? '<th class="py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Price</th><th class="py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>' : ''}
               </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${bill.items.map(item => `
                <tr>
                  <td class="py-4">
                    <p class="font-medium text-gray-900">${item.product.name}</p>
                    <p class="text-xs text-gray-500">${item.product.variant} • ${item.product.company}</p>
                  </td>
                  <td class="py-4 text-right text-gray-700">${formatQuantity(item.quantity, item.product.cartonSize)}</td>
                  ${bill.type === "SALES" ? `
                    <td class="py-4 text-right text-gray-700">₹${item.price.toFixed(2)}</td>
                    <td class="py-4 text-right font-medium text-gray-900">₹${(item.quantity * item.price).toFixed(2)}</td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${!hideTotals ? `
          <div class="flex justify-end border-t border-gray-300 pt-4">
            <div class="w-56 space-y-2">
              ${bill.discount && bill.discount > 0 ? `
                <div class="flex justify-between text-gray-600">
                  <span>Discount:</span>
                  <span>-₹${bill.discount.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="flex justify-between text-gray-600">
                <span>Total:</span>
                <span class="font-semibold">₹${bill.total.toFixed(2)}</span>
              </div>
              <div class="flex justify-between text-gray-600 pt-2 border-t border-gray-200">
                <span>Current Balance:</span>
                <span class="${bill.party.balance >= 0 ? 'text-green-600' : 'text-red-600'} font-semibold">
                  ₹${bill.party.balance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          ` : ''}
          <div class="watermark">Built with Horizon</div>
        </div>
      </body>
      </html>
    `;
  };

  const handleDownloadImage = async () => {
    setIsGenerating(true);
    let lastError = null;
    for (const cred of CREDENTIALS) {
      try {
        const html = generateBillHTML();
        const response = await fetch("https://hcti.io/v1/image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${btoa(`${cred.userId}:${cred.apiKey}`)}`,
          },
          body: JSON.stringify({
            html: html,
            width: 500,
            selector: '.bill-container',
            quality: 90,
            format: "jpg",
          }),
        });
        if (!response.ok) {
          if (response.status === 402) {
            console.warn(`Key ${cred.userId} hit limit, trying next...`);
            continue;
          }
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error && errorData.error.toLowerCase().includes("limit")) {
            console.warn(`Key ${cred.userId} hit limit, trying next...`);
            continue;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        const imageUrl = data.url;
        const imageResponse = await fetch(imageUrl);
        const blob = await imageResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Bill_${bill.id}.jpg`;
        link.click();
        window.URL.revokeObjectURL(url);
        setIsGenerating(false);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`Key ${cred.userId} failed:`, error);
      }
    }
    console.error("All API keys failed:", lastError);
    alert("Failed to generate JPG. All API keys may have reached their limit.");
    setIsGenerating(false);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Pop-up blocked. Please allow pop-ups for this site.");
      return;
    }
    const formattedDate = new Date(bill.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    printWindow.document.write(`
      <html>
        <head>
          <title>Bill #${bill.id}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 2rem; }
            .bill-header { border-bottom: 2px solid #000; padding-bottom: 1rem; margin-bottom: 2rem; }
            table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
            th { text-align: left; border-bottom: 1px solid #ccc; padding: 0.5rem; }
            td { padding: 0.5rem; border-bottom: 1px solid #eee; }
            .total { text-align: right; font-weight: bold; margin-top: 2rem; }
            .watermark { text-align: center; font-size: 10px; color: #9ca3af; margin-top: 2rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="bill-header">
            <h2>${companyName}</h2>
            <p>Date: ${formattedDate}</p>
          </div>
          <p><strong>${bill.type === "PURCHASE" ? "Order From:" : "Billed To:"}</strong> ${bill.party.name}</p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                ${bill.type === "SALES" ? "<th>Price</th><th>Total</th>" : ""}
              </tr>
            </thead>
            <tbody>
              ${bill.items.map(item => `
                <tr>
                  <td>${item.product.name} (${item.product.variant})</td>
                  <td>${item.quantity}</td>
                  ${bill.type === "SALES" ? `
                    <td>₹${item.price.toFixed(2)}</td>
                    <td>₹${(item.quantity * item.price).toFixed(2)}</td>
                  ` : ""}
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">Total: ₹${bill.total.toFixed(2)}</div>
          <div class="watermark">Built with Horizon</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const content = (
    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
        <h3 className="text-lg font-semibold text-gray-800">
          {mode === "modal" ? "Bill Preview" : "Bill"}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Download className="w-4 h-4 mr-2" />
            Print / PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadImage}
            disabled={isGenerating}
            className="text-gray-900 border-gray-300 hover:bg-gray-100"
          >
            <Download className="w-4 h-4 mr-2" />
            {isGenerating ? "Generating..." : "Download JPG"}
          </Button>
          {mode === "modal" && (
            <Button variant="outline" size="icon" onClick={onClose} className="text-gray-900 border-gray-300 hover:bg-gray-100">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-white">
        <div className="max-w-md mx-auto text-gray-900">
          <div className="border-b-2 border-gray-800 pb-6 mb-6">
            <h2 className="text-xl font-bold text-indigo-700">{companyName}</h2>
            <p className="text-sm text-gray-600">Date: {format(new Date(bill.date), "dd MMM yyyy")}</p>
          </div>
          <div className="mb-8">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              {bill.type === "PURCHASE" ? "Order From:" : "Billed To:"}
            </p>
            <p className="text-lg font-bold text-gray-900">{bill.party.name}</p>
          </div>
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Item Description</th>
                <th className="py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Qty</th>
                {bill.type === "SALES" && (
                  <>
                    <th className="py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bill.items.map((item, index) => (
                <tr key={index}>
                  <td className="py-4">
                    <p className="font-medium text-gray-900">{item.product.name}</p>
                    <p className="text-xs text-gray-500">{item.product.variant} • {item.product.company}</p>
                  </td>
                  <td className="py-4 text-right text-gray-700">{formatQuantity(item.quantity, item.product.cartonSize)}</td>
                  {bill.type === "SALES" && (
                    <>
                      <td className="py-4 text-right text-gray-700">₹{item.price.toFixed(2)}</td>
                      <td className="py-4 text-right font-medium text-gray-900">₹{(item.quantity * item.price).toFixed(2)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {bill.id !== "NEXT_ORDER_PREVIEW" && (
            <div className="flex justify-end border-t border-gray-300 pt-4">
              <div className="w-56 space-y-2">
                {bill.discount && bill.discount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Discount:</span>
                    <span>-₹{bill.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Total:</span>
                  <span className="font-semibold">₹{bill.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 pt-2 border-t border-gray-200">
                  <span>Current Balance:</span>
                  <span className={`${bill.party.balance >= 0 ? 'text-green-600' : 'text-red-600'} font-semibold`}>
                    ₹{bill.party.balance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className="mt-16 pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
            Built with Horizon
          </div>
        </div>
      </div>
    </div>
  );

  return mode === "modal" ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      {content}
    </div>
  ) : (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">{content}</div>
    </div>
  );
}