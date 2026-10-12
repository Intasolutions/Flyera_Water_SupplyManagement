"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { 
  Printer, 
  CheckCircle2, 
  Share2, 
  ArrowRight, 
  QrCode, 
  Download, 
  Sparkles, 
  X, 
  Edit2, 
  Check, 
  Smartphone, 
  FileText,
  Clock
} from "lucide-react";
import { toast } from "react-hot-toast";

export interface ReceiptItem {
  name: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface ReceiptData {
  receiptNo: string;
  date: string;
  companyName: string;
  gstin: string;
  hotline: string;
  address: string;
  vehiclePlate: string;
  routeName: string;
  driverName: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  items: ReceiptItem[];
  emptyReturned: number;
  totalAmount: number;
  paymentMethod: string; // "Cash" | "UPI / QR" | "Pay Later (Slip QR)"
  paymentStatus?: "PAID" | "PENDING";
  upiId: string;
}

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "qr_collect" | "success_receipt";
  data: ReceiptData;
  onConfirmPayment?: () => void;
  onNextStop?: () => void;
}

export function ThermalReceiptModal({
  isOpen,
  onClose,
  mode,
  data,
  onConfirmPayment,
  onNextStop
}: ThermalReceiptModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const receiptRef = useRef<HTMLDivElement>(null);
  const activeUpiId = data.upiId || "flyera@okhdfcbank";
  const isPayLater = data.paymentStatus === "PENDING" || (data.paymentMethod || "").toLowerCase().includes("pay later") || (data.paymentMethod || "").toLowerCase().includes("slip");

  // Generate dynamic NPCI UPI URI and QR code strictly using Admin configured UPI ID
  useEffect(() => {
    const note = encodeURIComponent(`${data.receiptNo} - ${data.clientName}`);
    const company = encodeURIComponent(data.companyName || "Flyera Logistics");
    const upiUri = `upi://pay?pa=${activeUpiId}&pn=${company}&am=${data.totalAmount.toFixed(2)}&tn=${note}&cu=INR`;

    QRCode.toDataURL(upiUri, {
      width: 260,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff"
      },
      errorCorrectionLevel: "M"
    })
      .then(url => setQrDataUrl(url))
      .catch(err => {
        console.error("QR Generation error:", err);
      });
  }, [activeUpiId, data.totalAmount, data.receiptNo, data.clientName, data.companyName]);

  if (!isOpen) return null;

  // Print thermal receipt formatted specifically for 58mm/80mm Bluetooth printers
  const handlePrint = () => {
    window.print();
  };

  // WhatsApp formatted receipt text
  const handleShareWhatsApp = () => {
    const cleanPhone = (data.clientPhone || "").replace(/[^0-9]/g, "");
    const lines = isPayLater ? [
      `*WATER DELIVERY INVOICE & PAYMENT QR*`,
      `*${data.companyName}*`,
      `--------------------------------`,
      `Receipt No: *${data.receiptNo}*`,
      `Date: ${data.date}`,
      `Vehicle: ${data.vehiclePlate} | Route: ${data.routeName} | Driver: *${data.driverName}*`,
      `Customer: *${data.clientName}*`,
      `--------------------------------`,
      ...data.items.map(item => `• ${item.name} x ${item.qty} @ ₹${item.rate} = ₹${item.amount}`),
      data.emptyReturned > 0 ? `• Empty Jars Collected: ${data.emptyReturned}` : "",
      `--------------------------------`,
      `*TOTAL DUE: ₹${data.totalAmount}*`,
      `*PAYMENT STATUS: PENDING (PAY VIA SLIP QR)*`,
      `--------------------------------`,
      `Your water bottles have been dropped off!`,
      `Please scan the QR code on your printed slip or pay via UPI:`,
      `UPI ID: *${activeUpiId}*`,
      `Amount: *₹${data.totalAmount}*`,
      `--------------------------------`,
      `Helpline: ${data.hotline}`,
      `_Powered by IN-TA Solution PVT LTD_`
    ].filter(Boolean).join("\n") : [
      `*WATER DELIVERY INVOICE & RECEIPT*`,
      `*${data.companyName}*`,
      `--------------------------------`,
      `Receipt No: *${data.receiptNo}*`,
      `Date: ${data.date}`,
      `Vehicle: ${data.vehiclePlate} | Route: ${data.routeName} | Driver: *${data.driverName}*`,
      `Customer: *${data.clientName}*`,
      `--------------------------------`,
      ...data.items.map(item => `• ${item.name} x ${item.qty} @ ₹${item.rate} = ₹${item.amount}`),
      data.emptyReturned > 0 ? `• Empty Jars Collected: ${data.emptyReturned}` : "",
      `--------------------------------`,
      `*TOTAL AMOUNT: ₹${data.totalAmount}*`,
      `*PAYMENT STATUS: PAID (${data.paymentMethod.toUpperCase()})*`,
      `--------------------------------`,
      `Thank you for choosing Flyera!`,
      `Helpline: ${data.hotline}`,
      `_Powered by IN-TA Solution PVT LTD_`
    ].filter(Boolean).join("\n");

    const encoded = encodeURIComponent(lines);
    const url = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  return (
    <>
      {/* Dynamic CSS for 58mm/80mm Bluetooth Thermal Receipt Printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-print-area,
          #thermal-print-area * {
            visibility: visible !important;
          }
          #thermal-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 58mm !important;
            max-width: 58mm !important;
            padding: 2mm !important;
            margin: 0 !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: #fff !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
          }
          @page {
            size: 58mm auto;
            margin: 0mm;
          }
        }
      `}</style>

      {/* Main Dialog Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                {mode === "qr_collect" ? <QrCode className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  {mode === "qr_collect" ? "Dynamic UPI Payment QR" : "Payment Received"}
                </h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  {mode === "qr_collect" ? "Scan to pay or print QR slip" : "Bluetooth receipt ready"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            
            {/* MODE 1: Dynamic UPI Collect Screen */}
            {mode === "qr_collect" && (
              <div className="space-y-4 text-center">
                <div className="bg-gradient-to-br from-sky-50 to-emerald-50 rounded-2xl p-4 border border-sky-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 block mb-0.5">
                    Total Amount Due
                  </span>
                  <div className="text-4xl font-black text-slate-900 mb-1">
                    ₹{data.totalAmount}
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    Client: <span className="text-slate-900">{data.clientName}</span>
                  </div>
                </div>

                {/* Scannable Dynamic QR Box */}
                <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-slate-200 inline-block mx-auto shadow-xs">
                  {qrDataUrl ? (
                    <img 
                      src={qrDataUrl} 
                      alt="Dynamic UPI QR Code" 
                      className="w-52 h-52 mx-auto rounded-lg"
                    />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center bg-slate-50 rounded-lg text-xs text-slate-400">
                      Generating dynamic QR...
                    </div>
                  )}
                  <p className="text-[11px] font-bold text-slate-500 mt-2 flex items-center justify-center gap-1">
                    <span>Scan with GPay • PhonePe • Paytm • BHIM</span>
                  </p>
                </div>

                {/* Admin Configured Merchant UPI ID Badge (Locked for Drivers) */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs max-w-sm mx-auto">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-[10px] font-black uppercase text-slate-500">🔒 Merchant VPA:</span>
                    <span className="font-bold text-slate-800 font-mono truncate">{activeUpiId}</span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                    Admin Verified
                  </span>
                </div>

                {/* Quick Print QR Slip Button */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex-1 py-3 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>Print QR Slip (58mm)</span>
                  </button>

                  {onConfirmPayment && (
                    <button
                      type="button"
                      onClick={onConfirmPayment}
                      className="flex-1 py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Received</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* MODE 2: Clean Celebratory / Slip Ready Screen */}
            {mode === "success_receipt" && (
              <div className="space-y-5 text-center">
                
                {/* Celebratory Animated Checkmark or Clock Aura */}
                <div className="py-2 flex flex-col items-center justify-center">
                  <div className="relative mb-3">
                    <div className={`absolute inset-0 rounded-full ${isPayLater ? "bg-amber-400/20" : "bg-emerald-400/20"} animate-ping`} />
                    <div className={`w-18 h-18 rounded-full ${
                      isPayLater 
                        ? "bg-gradient-to-tr from-amber-500 to-orange-500" 
                        : "bg-gradient-to-tr from-emerald-600 to-teal-500"
                    } text-white flex items-center justify-center shadow-lg relative z-10`}>
                      {isPayLater ? <Clock className="w-10 h-10 stroke-[2.5]" /> : <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />}
                    </div>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    {isPayLater ? "Delivery Dropped • Slip Ready" : "Payment Collected!"}
                  </h2>
                  <p className={`text-xs font-bold mt-0.5 ${isPayLater ? "text-amber-700" : "text-emerald-700"}`}>
                    {isPayLater 
                      ? `₹${data.totalAmount} Due • Awaiting Customer Slip QR Payment`
                      : `₹${data.totalAmount} received via ${data.paymentMethod}`}
                  </p>
                </div>

                {/* Mini Delivery Recap */}
                <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-100 text-left space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Client:</span>
                    <span className="font-black text-slate-800">{data.clientName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Receipt No:</span>
                    <span className="font-mono font-bold text-slate-700">{data.receiptNo}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Items:</span>
                    <span className="font-bold text-slate-800">
                      {data.items.map(i => `${i.name} (${i.qty})`).join(", ")}
                    </span>
                  </div>
                  {data.emptyReturned > 0 && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-semibold">Empties Returned:</span>
                      <span className="font-bold text-emerald-700">{data.emptyReturned} Jars</span>
                    </div>
                  )}
                </div>

                {/* Thermal Receipt Visual Preview Box */}
                <div className="text-left bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1 text-[11px] font-mono text-slate-700">
                  <div className="flex items-center justify-between text-[10px] font-sans font-black uppercase text-slate-400 pb-1 border-b border-dashed border-slate-200">
                    <span>58mm Thermal Receipt Preview</span>
                    <span className="text-emerald-700 font-bold">Bluetooth ESC/POS</span>
                  </div>
                  <div className="text-center font-bold pt-1">{data.companyName}</div>
                  <div className="text-center text-[10px] text-slate-500">{data.address}</div>
                  <div className="border-b border-dashed border-slate-300 my-1"></div>
                  <div className="flex justify-between">
                    <span>INV: {data.receiptNo}</span>
                    <span className={isPayLater ? "text-amber-700 font-bold" : "text-emerald-700"}>
                      {isPayLater ? "PAY LATER (SLIP QR)" : data.paymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>DRIVER: {data.driverName}</span>
                    <span>{data.vehiclePlate}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-1">
                    <span>{isPayLater ? "AMOUNT DUE:" : "TOTAL PAID:"}</span>
                    <span>₹{data.totalAmount}</span>
                  </div>
                  <div className="border-t border-dashed border-slate-200 mt-2 pt-1 text-center text-[9px] text-slate-400 font-sans font-semibold">
                    Powered by{" "}
                    <a
                      href="https://in-tasolutions.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold bg-gradient-to-r from-slate-950 via-slate-900 to-blue-600 bg-clip-text text-transparent hover:opacity-80"
                    >
                      IN-TA Solution PVT LTD
                    </a>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="py-3 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{isPayLater ? "Print Slip QR (58mm)" : "Print 58mm Receipt"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>WhatsApp Bill</span>
                  </button>
                </div>

                {/* Advance to next stop */}
                {onNextStop && (
                  <button
                    type="button"
                    onClick={onNextStop}
                    className="w-full py-3 px-4 bg-sky-50 hover:bg-sky-100 border border-sky-100 text-sky-800 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all mt-2"
                  >
                    <span>Done & Proceed to Next Stop</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden Thermal Slip for Native 58mm / 80mm Bluetooth Printing */}
      <div id="thermal-print-area" className="hidden print:block font-mono text-black bg-white">
        <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "13px" }}>
          {data.companyName}
        </div>
        <div style={{ textAlign: "center", fontSize: "10px" }}>
          {data.address}
        </div>
        <div style={{ textAlign: "center", fontSize: "10px" }}>
          Hotline: {data.hotline} | GST: {data.gstin}
        </div>
        <div>--------------------------------</div>
        <div>RECEIPT NO : {data.receiptNo}</div>
        <div>DATE       : {data.date}</div>
        <div>VEHICLE    : {data.vehiclePlate}</div>
        <div>ROUTE      : {data.routeName}</div>
        <div>DRIVER     : {data.driverName}</div>
        <div>--------------------------------</div>
        <div>CUSTOMER:</div>
        <div style={{ fontWeight: "bold" }}>{data.clientName}</div>
        {data.clientPhone && <div>Phone: {data.clientPhone}</div>}
        {data.clientAddress && <div>Address: {data.clientAddress}</div>}
        <div>--------------------------------</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
          <span>ITEM</span>
          <span>QTY</span>
          <span>AMT</span>
        </div>
        <div>--------------------------------</div>
        {data.items.map((it, idx) => (
          <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{it.name}</span>
            <span>x{it.qty}</span>
            <span>Rs.{it.amount}</span>
          </div>
        ))}
        {data.emptyReturned > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Empty Cans Returned</span>
            <span>{data.emptyReturned}</span>
          </div>
        )}
        <div>--------------------------------</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px" }}>
          <span>{isPayLater ? "TOTAL DUE:" : "TOTAL COLLECTED:"}</span>
          <span>Rs.{data.totalAmount}</span>
        </div>
        <div>{isPayLater ? "PAYMENT STATUS  : PENDING (SCAN SLIP QR)" : `PAYMENT METHOD   : ${data.paymentMethod.toUpperCase()}`}</div>
        <div>--------------------------------</div>
        
        {/* Dynamic UPI QR printed on the thermal slip */}
        {qrDataUrl && (
          <div style={{ textAlign: "center", margin: "4px 0" }}>
            <img 
              src={qrDataUrl} 
              alt="UPI QR Code" 
              style={{ width: "160px", height: "160px", margin: "0 auto", display: "block" }} 
            />
            <div style={{ fontSize: "9px" }}>UPI ID: {activeUpiId}</div>
            <div style={{ fontSize: "9px" }}>
              {isPayLater ? "Scan to Pay Pending Refill Bill" : "Scan to Pay / Verify"}
            </div>
          </div>
        )}
        
        <div>--------------------------------</div>
        {isPayLater && (
          <div style={{ textAlign: "center", fontSize: "9px", fontWeight: "bold", margin: "2px 0" }}>
            * PLEASE SCAN QR TO PAY UPON RETURNING *
          </div>
        )}
        <div style={{ textAlign: "center", fontSize: "10px" }}>
          Thank you for trusting Flyera!
        </div>
        <div style={{ textAlign: "center", fontSize: "9px" }}>
          For refills call: {data.hotline}
        </div>
        <div style={{ textAlign: "center", fontSize: "8.5px", marginTop: "3px" }}>
          Powered by IN-TA Solution PVT LTD
        </div>
        <div style={{ textAlign: "center" }}>================================</div>
      </div>
    </>
  );
}
