import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Trash2, Search, Calendar, CreditCard, DollarSign, Edit3, 
  CheckCircle, ShieldAlert, BadgeAlert, HelpCircle, FileSpreadsheet, Sparkles
} from 'lucide-react';
import { StockItem, PaymentStatus } from '../types';
import { formatThaiDate, getAlertLevel } from '../utils';

interface StockListPanelProps {
  stockItems: StockItem[];
  onDeleteItem: (id: string) => void;
  onUpdatePaymentStatus: (id: string, status: PaymentStatus) => void;
  onUpdateThresholds: (id: string, critical: number, low: number, high: number) => void;
  sampleGroups: string[];
}

export default function StockListPanel({ 
  stockItems, 
  onDeleteItem, 
  onUpdatePaymentStatus,
  onUpdateThresholds,
  sampleGroups 
}: StockListPanelProps) {
  // ฟิลเตอร์ค้นหา
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedAlert, setSelectedAlert] = useState('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('');

  // ฟอร์มสเตตสำหรับปรับแก้เกณฑ์การแจ้งเตือน ( thresholds ) เฉพาะตัว
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [editCrit, setEditCrit] = useState<number>(5);
  const [editLow, setEditLow] = useState<number>(15);
  const [editHigh, setEditHigh] = useState<number>(30);

  // สเตตสับเปลี่ยนปุ่มลบเพื่อเลี่ยง iframe confirm restriction
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // คำนวณวันหมดอายุ/การแจ้งชำระเงินล่าช้า
  const isPastDue = (dueDateString?: string): boolean => {
    if (!dueDateString) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateString);
    return due < today;
  };

  const isExpired = (expiryDateString: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDateString);
    return expiry < today;
  };

  const handleOpenEditThreshold = (item: StockItem) => {
    setEditingThresholdId(item.id);
    if (item.thresholds) {
      setEditCrit(item.thresholds.critical);
      setEditLow(item.thresholds.low);
      setEditHigh(item.thresholds.high);
    } else {
      setEditCrit(5);
      setEditLow(15);
      setEditHigh(30);
    }
  };

  const handleSaveThreshold = (id: string) => {
    onUpdateThresholds(id, editCrit, editLow, editHigh);
    setEditingThresholdId(null);
  };

  // ดึงระดับความเตือนของแต่ละหน่วยสต็อกมาคัดกรอง
  const filteredStock = stockItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.lot.toLowerCase().includes(search.toLowerCase());
    
    const matchesGroup = selectedGroup === '' || item.sampleGroup === selectedGroup;
    
    // คัดกรองจากระดับความเสี่ยง
    const alertInfo = getAlertLevel(item.currentQty, item.thresholds);
    const matchesAlert = selectedAlert === '' || alertInfo.level === selectedAlert;

    // คัดกรองจากสถานะการจ่ายเงิน
    const matchesPayment = selectedPaymentStatus === '' || 
      (selectedPaymentStatus === 'cash' && item.paymentType === 'cash') ||
      (selectedPaymentStatus === 'credit-pending' && item.paymentType === 'credit' && item.paymentStatus === 'pending') ||
      (selectedPaymentStatus === 'credit-paid' && item.paymentType === 'credit' && item.paymentStatus === 'paid');

    return matchesSearch && matchesGroup && matchesAlert && matchesPayment;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 max-w-6xl mx-auto">
      
      {/* ส่วนหัว และตัวสถิติย่อ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-sans flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-600" />
            ตารางตรวจสอบข้อมูลสต็อกแล็บ & การชำระเงิน
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ดูรายละเอียด บัญชีเครดิตค่าสินค้า และสเปคค่าเกณฑ์ความเสี่ยงสีเพื่อป้องกันน้ำยาขาดสต็อก
          </p>
        </div>
        
        {/* บ่งชี้ข้อมูลทางการเงิน */}
        <div className="flex flex-wrap gap-2.5">
          <div className="bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10 text-xs">
            <span className="text-slate-500 block text-[10px]">มูลค่าคลังประเมินได้</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
              {stockItems.reduce((acc, curr) => acc + (curr.currentQty * curr.pricePerUnit), 0).toLocaleString('th-TH')} บาท
            </span>
          </div>

          <div className="bg-rose-500/5 px-3 py-1.5 rounded-lg border border-rose-500/10 text-xs">
            <span className="text-slate-500 block text-[10px]">หนี้ค้างชำระ (เครดิต)</span>
            <span className="font-bold text-rose-700 dark:text-rose-400 font-mono">
              {stockItems
                .filter(i => i.paymentType === 'credit' && i.paymentStatus === 'pending')
                .reduce((acc, curr) => acc + curr.totalPrice, 0)
                .toLocaleString('th-TH')} บาท
            </span>
          </div>
        </div>
      </div>

      {/* ควบคุมการฟิลเตอร์ข้อมูลร่วม */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-6">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1">ค้นหาด่วน (ชื่อ/LOT)</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหา..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1">กลุ่มตัวอย่าง</label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
          >
            <option value="">ทั้งหมด</option>
            {sampleGroups.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1">ระดับสต็อกคงเหลือ</label>
          <select
            value={selectedAlert}
            onChange={(e) => setSelectedAlert(e.target.value)}
            className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
          >
            <option value="">ทุกระดับความพร้อม</option>
            <option value="green">🟢 สีเขียว (เพียงพอ)</option>
            <option value="yellow">🟡 สีเหลือง (เริ่มต่ำ)</option>
            <option value="red">🔴 สีแดง (วิกฤต)</option>
            <option value="neutral">⚪ ไม่มีเกณฑ์แจ้งเตือน</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1">เงื่อนไขจ่ายเงิน</label>
          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
          >
            <option value="">ทุกเงื่อนไข</option>
            <option value="cash">💵 จ่ายสด (เรียบร้อย)</option>
            <option value="credit-pending">💳 เครดิต (ค้างจ่าย)</option>
            <option value="credit-paid">💳 เครดิต (จ่ายหนี้แล้ว)</option>
          </select>
        </div>
      </div>

      {/* บันทึกรายการผลิตภัณฑ์ */}
      {filteredStock.length === 0 ? (
        <div className="py-12 border border-dashed border-slate-100 dark:border-slate-800 rounded-xl text-center text-slate-400 text-sm">
          ไม่พบคู่รายการสินค้าตรงตามสเปคคัดกรอง หรือยังคลังว่างอยู่
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">น้ำยา / แผนกวิจัย</th>
                <th className="px-3 py-3 font-mono">LOT No.</th>
                <th className="px-3 py-3 text-right">จำนวนคลังคงอยู่</th>
                <th className="px-3 py-3 text-right">ราคารวม (เฉลี่ยต่อหน่วย)</th>
                <th className="px-3 py-3">วันหมดความเสี่ยง (Exp)</th>
                <th className="px-3 py-3">รายละเอียดชำระเครดิต / การเงิน</th>
                <th className="px-3 py-3 text-center">ปรับแต่งเตือนสต็อก</th>
                <th className="px-4 py-3 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredStock.map((item) => {
                const hasExp = isExpired(item.expiryDate);
                const alertInfo = getAlertLevel(item.currentQty, item.thresholds);
                const currentEditing = editingThresholdId === item.id;
                const creditPending = item.paymentType === 'credit' && item.paymentStatus === 'pending';
                const overdue = creditPending && isPastDue(item.paymentDueDate);

                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors ${
                      hasExp ? 'bg-rose-50/10' : ''
                    }`}
                  >
                    {/* ชื่อและหมวดหมู่แผนก */}
                    <td className="px-4 py-3.5">
                      <div>
                        <span className="px-2 py-0.5 text-[9px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/20 dark:text-teal-400 rounded-md mb-1 inline-block">
                          {item.sampleGroup}
                        </span>
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          รับสินค้าเมื่อ: {formatThaiDate(item.receiveDate)}
                        </div>
                      </div>
                    </td>

                    {/* LOT สินค้า */}
                    <td className="px-3 py-3.5 font-mono text-slate-700 dark:text-slate-300 font-semibold">
                      {item.lot}
                    </td>

                    {/* จำนวนคงเหลือและป้ายสีความพร้อม */}
                    <td className="px-3 py-3.5 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                          {item.currentQty} <span className="text-xs font-sans font-normal text-slate-500">/ {item.initialQty}</span>
                        </span>
                        {/* ป้ายเตือนสีสดของสต็อก */}
                        <span className={`mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${alertInfo.bgClass} ${alertInfo.colorClass} border ${alertInfo.borderClass}`}>
                          {alertInfo.textText}
                        </span>
                      </div>
                    </td>

                    {/* การเงินและราคาทั้งหมด */}
                    <td className="px-3 py-3.5 text-right whitespace-nowrap font-mono">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.totalPrice ? item.totalPrice.toLocaleString('th-TH') : '0'} บ.
                      </div>
                      <div className="text-[10px] text-slate-400">
                        ({item.pricePerUnit ? item.pricePerUnit.toLocaleString('th-TH', { maximumFractionDigits: 1 }) : '0'} บ./ชิ้น)
                      </div>
                    </td>

                    {/* ข้อมูลวันหมดอายุสารเคมี */}
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div>
                        <span className={`font-semibold ${hasExp ? 'text-rose-600 font-extrabold line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                          {formatThaiDate(item.expiryDate)}
                        </span>
                        {hasExp ? (
                          <span className="block text-[9px] font-bold text-rose-500">❌ หมดแผนการตรวจ!</span>
                        ) : (
                          <span className="block text-[9px] text-slate-400">ยังใช้งานปกติ</span>
                        )}
                      </div>
                    </td>

                    {/* เงื่อนไขการเงิน/หนี้สิน */}
                    <td className="px-3 py-3.5">
                      {item.paymentType === 'cash' ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-md text-[10px] inline-flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> จ่ายสดแล้ว
                        </span>
                      ) : (
                        <div className="space-y-1">
                          {item.paymentStatus === 'paid' ? (
                            <span className="text-teal-700 dark:text-teal-400 font-semibold bg-teal-50 dark:bg-teal-950/20 px-2 py-1 rounded-md text-[10px] inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> เครดิต (จ่ายหนี้คืนแล้ว)
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1.5 items-start">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                overdue 
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' 
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {overdue ? '⚠️ ค้างเครดิตเลยกำหนด!' : '⏳ ติดเครดิตคาดจ่าย'}
                              </span>
                              <span className="text-[10px] text-slate-500 block font-mono">
                                จ่ายภายใน: <span className={overdue ? 'text-rose-600 font-bold underline' : ''}>{formatThaiDate(item.paymentDueDate || '')}</span>
                              </span>
                              
                              {/* ปุ่มยืนยันจ่ายเงิน */}
                              <button
                                onClick={() => onUpdatePaymentStatus(item.id, 'paid')}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-md transition-all active:scale-95 cursor-pointer hover:shadow-xs"
                              >
                                💳 ยืนยันว่าจ่ายแล้ว
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* ปรับแต่งเตือนสิทธิ์เกณฑ์สี ( thresholds ) */}
                    <td className="px-3 py-3.5 text-center">
                      {currentEditing ? (
                        <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-left space-y-1.5 max-w-[140px] mx-auto">
                          <div>
                            <label className="text-[9px] font-bold text-rose-500 block">วิกฤต (แดง):</label>
                            <input
                              type="number"
                              value={editCrit}
                              onChange={(e) => setEditCrit(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full px-1 py-0.5 text-xs bg-white dark:bg-slate-900 border rounded"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-amber-500 block">เหลือน้อย (เหลือง):</label>
                            <input
                              type="number"
                              value={editLow}
                              onChange={(e) => setEditLow(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full px-1 py-0.5 text-xs bg-white dark:bg-slate-900 border rounded"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-emerald-500 block">เพียงพอ (เขียว):</label>
                            <input
                              type="number"
                              value={editHigh}
                              onChange={(e) => setEditHigh(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full px-1 py-0.5 text-xs bg-white dark:bg-slate-900 border rounded"
                            />
                          </div>
                          <div className="flex gap-1 pt-1">
                            <button
                              onClick={() => handleSaveThreshold(item.id)}
                              className="flex-1 text-[9px] bg-teal-600 text-white font-bold py-1 rounded"
                            >
                              บันทึก
                            </button>
                            <button
                              onClick={() => setEditingThresholdId(null)}
                              className="flex-1 text-[9px] bg-slate-300 text-slate-700 py-1 rounded"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          {item.thresholds ? (
                            <span className="text-[10px] text-slate-500 font-mono block">
                              🔴≤{item.thresholds.critical} | 🟡≤{item.thresholds.low} | 🟢&gt;{item.thresholds.high}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">ไม่ได้กำหนดเกณฑ์</span>
                          )}
                          <button
                            onClick={() => handleOpenEditThreshold(item)}
                            className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5"
                          >
                            <Edit3 className="w-3 h-3" /> แก้ไขเกณฑ์
                          </button>
                        </div>
                      )}
                    </td>

                    {/* ลบข้อมูลแถว */}
                    <td className="px-4 py-3.5 text-right">
                      {deleteConfirmId === item.id ? (
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <button
                            onClick={() => {
                              onDeleteItem(item.id);
                              setDeleteConfirmId(null);
                            }}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-md shadow-xs cursor-pointer"
                          >
                            ลบจริง
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 text-slate-700 font-bold text-[10px] rounded-md cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all active:scale-95 cursor-pointer inline-flex"
                          title="ลบน้ำยา"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
