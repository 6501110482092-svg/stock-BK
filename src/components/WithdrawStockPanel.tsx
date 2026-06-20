import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Filter, ArrowUpRight, CheckCircle, AlertTriangle, 
  RefreshCcw, Calendar, FlaskConical, Clock, Sparkles, Zap, ChevronRight, Check
} from 'lucide-react';
import { StockItem, WithdrawalLog } from '../types';
import { formatThaiDate, getAlertLevel } from '../utils';

interface WithdrawStockPanelProps {
  stockItems: StockItem[];
  onWithdraw: (itemId: string, qty: number, withdrawDate: string) => void;
  onWithdrawFEFO: (itemName: string, qty: number, withdrawDate: string) => any;
  onCancelWithdraw?: (logId: string) => void;
  logs: WithdrawalLog[];
  sampleGroups: string[];
}

export default function WithdrawStockPanel({ 
  stockItems, 
  onWithdraw, 
  onWithdrawFEFO, 
  onCancelWithdraw,
  logs, 
  sampleGroups 
}: WithdrawStockPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [cancelingLogId, setCancelingLogId] = useState<string | null>(null);
  
  // สเตตเบิกแบบล็อตตรงๆ
  const [withdrawalQtys, setWithdrawalQtys] = useState<{ [itemId: string]: string }>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [recentWithdrawAlerts, setRecentWithdrawAlerts] = useState<{ [itemId: string]: string }>({});

  // สเตตเบิกอัจฉริยะ (Auto-FEFO Mode)
  const [fefoItemName, setFefoItemName] = useState('');
  const [fefoQty, setFefoQty] = useState<number | ''>('');
  const [fefoSuccessMsg, setFefoSuccessMsg] = useState<string | null>(null);

  // หาน้ำยาที่มีสต็อกเกิน 0 เพื่อเบิกตามระบบ FEFO
  const activeDistinctNames = useMemo(() => {
    const list = stockItems
      .filter((item) => item.currentQty > 0)
      .map((item) => item.name);
    return Array.from(new Set(list));
  }, [stockItems]);

  // ค้นหาล็อตของน้ำยาที่ถูกเลือกสำหรับแสดงลำดับคิวเบิก (FEFO Check Lineage)
  const selectedItemLots = useMemo(() => {
    if (!fefoItemName) return [];
    return stockItems
      .filter((item) => item.name.trim().toLowerCase() === fefoItemName.trim().toLowerCase() && item.currentQty > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }, [fefoItemName, stockItems]);

  // คำนวณสต็อกคงเหลือรวมสารตรวจชื่อนี้ทุกล็อตสะสม
  const selectedItemTotalQty = useMemo(() => {
    return selectedItemLots.reduce((sum, item) => sum + item.currentQty, 0);
  }, [selectedItemLots]);

  const handleQtyChange = (itemId: string, value: string) => {
    setWithdrawalQtys((prev) => ({
      ...prev,
      [itemId]: value
    }));
  };

  // เบิกแบบระบุเจาะจงล็อตเอง
  const handleWithdrawClick = (item: StockItem) => {
    const rawVal = withdrawalQtys[item.id];
    let withdrawQty = 1;
    if (rawVal !== undefined && rawVal.trim() !== '') {
      const parsed = parseInt(rawVal, 10);
      if (!isNaN(parsed) && parsed > 0) {
        withdrawQty = parsed;
      } else {
        alert('กรุณากรอกจำนวนเบิกที่เป็นตัวเลขมากกว่า 0 เท่านั้น');
        return;
      }
    }

    if (item.currentQty <= 0) {
      alert('สินค้านี้หมดคลังแล้ว ไม่สามารถเบิกเพิ่มได้');
      return;
    }

    if (withdrawQty > item.currentQty) {
      alert(`ไม่สามารถเบิกได้เนื่องจากสต็อกคงเหลือ (${item.currentQty} ชุด) น้อยกว่าจำนวนที่ต้องการเบิก (${withdrawQty} ชุด)`);
      return;
    }

    onWithdraw(item.id, withdrawQty, selectedDate);

    const remaining = item.currentQty - withdrawQty;
    const alertMsg = `เบิกสำเร็จเมื่อครู่: นำออกไปใช้ ${withdrawQty} ชุด คงเหลือจริง ${remaining} ชุด (เบิกเมื่อวันที่ ${formatThaiDate(selectedDate)})`;
    setRecentWithdrawAlerts((prev) => ({
      ...prev,
      [item.id]: alertMsg
    }));

    setWithdrawalQtys((prev) => ({
      ...prev,
      [item.id]: ''
    }));

    setTimeout(() => {
      setRecentWithdrawAlerts((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    }, 6000);
  };

  // เบิกอัตโนมัติตามระบบ FEFO
  const handleFefoWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fefoItemName) {
      alert('กรุณาเลือกชื่อน้ำยาก่อนทำการเบิก');
      return;
    }
    const qty = Number(fefoQty);
    if (!qty || qty <= 0) {
      alert('กรุณาระบุจำนวนที่ตักเบิกมากกว่า 0');
      return;
    }

    if (qty > selectedItemTotalQty) {
      alert(`ยอดสต็อกรวมทุกคลังของ "${fefoItemName}" มีเพียง ${selectedItemTotalQty} ชุด ไม่พอเบิกจำนวน ${qty} ชุด`);
      return;
    }

    // เรียกหลังบ้านทำการปันส่วนและหักลบ
    const deductions = onWithdrawFEFO(fefoItemName, qty, selectedDate);
    
    if (deductions && deductions.length > 0) {
      // ประกอบข้อความแจ้งผลความก้าวหน้า
      const listText = deductions.map((d: any) => `ล็อต ${d.item.lot} (-${d.qtyDeducted} ชุด, คงเหลือ ${d.after})`).join(', ');
      setFefoSuccessMsg(`เบิกด่วน FEFO สำเร็จแล้ว! ปริมาตรรวม ${qty} ชุด โดยหักออกอัจฉริยะจาก: ${listText}`);
      setFefoQty('');
      
      // ล็อคปิดแจ้งเตือนภายหลัง 8 วินาที
      setTimeout(() => {
        setFefoSuccessMsg(null);
      }, 10000);
    }
  };

  const isExpired = (expiryDateString: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDateString);
    return expiry < today;
  };

  // ดึงรายละเอียดยืนยันว่าล็อตนี้เป็นล็อตแรกที่กำลังจะหมดอายุในบรรดาล็อตของน้ำยาชื่อเดียวกันหรือไม่
  const checkIsFefoTarget = (item: StockItem) => {
    if (item.currentQty <= 0) return false;
    const sameNamedActiveLots = stockItems
      .filter((i) => i.name.trim().toLowerCase() === item.name.trim().toLowerCase() && i.currentQty > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    
    return sameNamedActiveLots.length > 0 && sameNamedActiveLots[0].id === item.id;
  };

  // คัดกรอง
  const filteredItems = stockItems.filter((item) => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lot.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sampleGroup.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGroup = selectedGroup === '' || item.sampleGroup === selectedGroup;

    return matchesSearch && matchesGroup;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* ส่วนตัวตั้งเวลาและกล่องเบิกออฟไลน์ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-sans tracking-tight">
              โหมดเบิกจ่ายน้ำยาตรวจและสารเคมีแล็บ
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              รองรับระบบความปลอดภัย FEFO อัตโนมัติ (หยิบล็อตหมดอายุเร็วสุดก่อน) ป้องกันปัญหายาหมดอายุคาคลังสต็อกที่เกิดจากการเลือกเอง
            </p>
          </div>

          <div className="flex items-center gap-2 bg-teal-500/5 p-2.5 rounded-xl border border-teal-500/10">
            <span className="text-xs font-bold text-teal-700 flex items-center gap-1.5 whitespace-nowrap">
              <Calendar className="w-4 h-4" />
              กำหนดบันทึกวันเบิกสารเคมี:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2 py-1 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* ================= SECTION A: SMART FEFO AUTO-WITHDRAW ================= */}
      <div className="bg-linear-to-br from-teal-900 via-teal-950 to-slate-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        {/* เมคอัพแบ็คกราวด์ */}
        <div className="absolute right-0 bottom-0 translate-x-24 translate-y-24 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl"></div>
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-teal-300 animate-bounce" /> Auto-FEFO System
              </span>
              <span className="text-[10px] text-teal-300/80 font-mono">ISO 15189 Quality Compliant</span>
            </div>
            
            <h3 className="text-xl font-extrabold text-white font-sans tracking-tight">
              ⚡ ศูนย์เบิกน้ำยาระบบ FEFO อัจฉริยะ (ไม่ต้องเลือกกล่องเอง)
            </h3>
            
            <p className="text-xs text-teal-100/70 leading-relaxed">
              เพียงเลือกชื่อน้ำยาที่แพทย์ต้องการใช้งานและระบุจำนวนที่ต้องการ ดึงข้อมูลหักลบล็อตที่หมดเหยียดเร็วที่สุดให้อัตโนมัติ ป้องกันสารเคมีเน่าเสียหรือหมดอายุคลัง
            </p>

            {/* แสดงคิวล็อตที่จะโดนหักถอนเมื่อเลือกสินค้า */}
            {fefoItemName && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs space-y-1.5"
              >
                <div className="flex justify-between items-center text-teal-300 font-bold">
                  <span>📊 ข้อมูลรวมน้ำยา "{fefoItemName}" ในคลัง:</span>
                  <span className="font-mono bg-teal-400/20 px-2 py-0.5 rounded text-white">รวมทุกล็อต = {selectedItemTotalQty} ชุด</span>
                </div>
                
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-teal-200/60 block font-semibold uppercase tracking-wider">ลำดับคิวการใช้วัสดุ (FEFO Order):</span>
                  {selectedItemLots.map((lotItem, index) => (
                    <div key={lotItem.id} className="flex justify-between items-center text-[11px] text-teal-100/90 font-mono">
                      <span className="flex items-center gap-1 text-teal-200">
                        {index === 0 ? <Check className="w-3 h-3 text-teal-400" /> : <ChevronRight className="w-3 h-3 text-teal-600" />}
                        คิวที่ {index + 1}: ล็อต <strong className="text-white">{lotItem.lot}</strong>
                        {index === 0 && <span className="bg-teal-500/20 text-teal-300 text-[9px] px-1.5 py-0.2 rounded ml-1 border border-teal-500/20 font-sans">🔥 เบิกก่อน</span>}
                      </span>
                      <span>สต็อก {lotItem.currentQty} ชุด (หมดอายุ {formatThaiDate(lotItem.expiryDate)})</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* บล็อกแบบฟอร์มเบิกสำหรับ Auto-FEFO */}
          <div className="lg:col-span-6">
            <form onSubmit={handleFefoWithdrawSubmit} className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-teal-300 mb-1.5">
                  1. เลือกชื่อน้ำยาตรวจที่ต้องการเบิก <span className="text-red-400">*</span>
                </label>
                <select
                  value={fefoItemName}
                  onChange={(e) => {
                    setFefoItemName(e.target.value);
                    setFefoQty('');
                  }}
                  className="w-full px-3 py-2.5 bg-slate-950 text-white border border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">-- รวมรายชื่อสารเคมีที่มีของ ({activeDistinctNames.length} ชนิด) --</option>
                  {activeDistinctNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-teal-300 mb-1.5">
                  2. ปริมาณที่ต้องนำไปใช้งาน (ชุด/กล่อง) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedItemTotalQty || undefined}
                  disabled={!fefoItemName}
                  placeholder={fefoItemName ? `ระบุปริมาณ (สต็อกคงคลังเหลือสูงสุด ${selectedItemTotalQty} ชุด)` : "กรุณาเลือกน้ำยาก่อน..."}
                  value={fefoQty}
                  onChange={(e) => setFefoQty(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value)))}
                  className="w-full px-3 py-2.5 bg-slate-950 text-white border border-slate-800 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={!fefoItemName || !fefoQty}
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 disabled:text-slate-500 cursor-pointer disabled:cursor-not-allowed transition-all text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-teal-500/5 select-none"
              >
                <Zap className="w-4 h-4 text-slate-950" />
                เบิกน้ำยาจ่ายคลังด้วยระบบ FEFO ทันที
              </button>
            </form>
          </div>

        </div>

        {/* บล็อกแจ้งผลเบิกด่วน FEFO สำเร็จพร้อมพยากรณ์การเฉือนสต็อก */}
        <AnimatePresence>
          {fefoSuccessMsg && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-4 bg-teal-550 shadow-inner rounded-2xl border border-teal-400 flex items-start gap-3 text-slate-950 z-20 font-sans"
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-slate-950 mt-0.5" />
              <div className="text-xs">
                <span className="font-extrabold uppercase">ประมวลผลอพยพตามคิวสำเร็จ!</span> {fefoSuccessMsg}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ================= SECTION B: REGULAR LOTS WITH FEFO ADVICE BADGE ================= */}
      <div className="border-t border-slate-200 mt-8 pt-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                📦 ทะเบียนคลังน้ำยาแบบรายล็อต (Manual Lot Selection)
              </h3>
              <p className="text-xs text-slate-500">
                หากแพทย์มีความจำเป็นในการเบิกใช้เจาะจงล็อตเป็นพิเศษ สามารถเลือกทำเบิกทีละรายการได้ด้านล่างนี้ (มีป้ายกำกับช่วยแนะนำล็อต FEFO)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อน้ำยา, หมวดหมู่, ล็อต..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="">กลุ่มตัวอย่างทั้งหมด ({sampleGroups.length})</option>
                {sampleGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end text-xs text-slate-500">
              พบสารเคมีพร้อมใช้งานทั้งหมด <span className="font-bold text-teal-600 px-1">{filteredItems.length}</span> รายการ
            </div>
          </div>
        </div>

        {/* ยินยอมการแสดงข้อมูลน้ำยา */}
        {filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center text-slate-400">
            <FlaskConical className="w-12 h-12 mx-auto stroke-1.5 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-base font-semibold">ไม่พบข้อมูลน้ำยาหรือวัสดุทางทุกล็อตที่ตรงกับการค้นหา</p>
            <p className="text-xs text-slate-400 mt-1">กรุณาทดลองพิมพ์หาคำอื่นใหม่</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredItems.map((item) => {
              const hasExp = isExpired(item.expiryDate);
              const alertInfo = getAlertLevel(item.currentQty, item.thresholds);
              const userQtyInput = withdrawalQtys[item.id] || '';
              const successAlert = recentWithdrawAlerts[item.id];
              const isFefoTarget = checkIsFefoTarget(item);

              return (
                <motion.div
                  key={item.id}
                  layout
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 relative flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md transition-all ${
                    hasExp 
                      ? 'border-rose-300 dark:border-rose-900' 
                      : item.currentQty <= 0 
                        ? 'border-slate-200 dark:border-slate-800 opacity-60' 
                        : isFefoTarget
                          ? 'border-teal-500/50 dark:border-teal-850 ring-2 ring-teal-500/10'
                          : 'border-slate-100 dark:border-slate-800'
                  }`}
                >
                  {/* แถบสีสถานะระดับของคลัง (เขียว เหลือง แดง เทา) */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                    alertInfo.level === 'green' ? 'bg-emerald-500' :
                    alertInfo.level === 'yellow' ? 'bg-amber-400' :
                    alertInfo.level === 'red' ? 'bg-rose-500' : 'bg-slate-400'
                  }`} />

                  {/* แถบสีบับเบิร์ลสำหรับ FEFO */}
                  {isFefoTarget && (
                    <div className="absolute top-1.5 right-6 bg-teal-500 text-slate-950 font-black font-sans px-2.5 py-0.5 rounded-b-lg text-[9px] uppercase tracking-wide flex items-center gap-1 shadow-xs animate-pulse">
                      <Sparkles className="w-3 h-3 text-slate-950" />
                      FEFO แนะนำดึงก่อน
                    </div>
                  )}

                  <div>
                    {/* หัวการ์ดและป้ายกำกับ */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <span className="px-2 py-0.5 text-[10px] font-bold text-slate-550 bg-slate-100 dark:bg-slate-800 rounded">
                        {item.sampleGroup}
                      </span>
                      <div className="flex gap-1">
                        {hasExp && (
                          <span className="px-2 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 rounded-md flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> หมดอายุ!
                          </span>
                        )}
                        
                        {/* อัตราแรเงาสี */}
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${alertInfo.colorClass} ${alertInfo.bgClass} ${alertInfo.borderClass}`}>
                          {alertInfo.textText}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-2 pr-12">
                      {item.name}
                    </h3>

                    {/* สเปคข้อมูลแรกเข้า */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 my-4 pt-3 border-t border-dashed border-slate-105 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-500">ล็อตสินค้า:</span>{' '}
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{item.lot}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">วันที่รับสินค้า:</span>{' '}
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">{formatThaiDate(item.receiveDate)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500">วันหมดอายุสาร:</span>{' '}
                        <span className={`font-semibold ${hasExp ? 'text-rose-600 underline' : 'text-slate-800 dark:text-slate-200'}`}>
                          {formatThaiDate(item.expiryDate)}
                        </span>
                      </div>
                    </div>

                    {/* ปริมาณในระบบ */}
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3 rounded-xl mb-3">
                      <div>
                        <span className="text-[10px] text-slate-505 block uppercase font-bold tracking-wider">สต็อกล็อตนี้คงเหลือ</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-slate-800 dark:text-slate-100 font-mono">
                            {item.currentQty}
                          </span>
                          <span className="text-xs text-slate-500">/ {item.initialQty} ชุด</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">ราคาเฉลี่ยป้าย</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                          {item.pricePerUnit.toLocaleString('th-TH')} บาท
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* กล่องสำเร็จประวัติการเบิก */}
                  <AnimatePresence>
                    {successAlert && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-950 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-400 absolute inset-x-5 bottom-[4.5rem] shadow-sm z-10"
                      >
                        <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                        <p className="text-[10px] leading-tight font-medium">{successAlert}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* แบบฟอร์มทำเบิกในตัวการ์ดสแกนล็อต */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-12 gap-2 h-11 items-center">
                    <div className="col-span-6 relative">
                      <input
                        type="number"
                        min="1"
                        placeholder="จำนวนเบิก (ว่าง=1)"
                        disabled={item.currentQty <= 0}
                        value={userQtyInput}
                        onChange={(e) => handleQtyChange(item.id, e.target.value)}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-850 dark:text-slate-100 focus:outline-none"
                      />
                    </div>

                    <button
                      onClick={() => handleWithdrawClick(item)}
                      disabled={item.currentQty <= 0 || hasExp}
                      className={`col-span-6 h-full text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-all select-none ${
                        item.currentQty <= 0 
                          ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed' 
                          : hasExp
                            ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/20 border border-rose-250 cursor-not-allowed'
                            : isFefoTarget
                              ? 'bg-teal-500 hover:bg-teal-600 text-slate-950 font-black shadow-sm'
                              : 'bg-slate-800 text-white hover:bg-slate-900'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      นำล็อตนี้ออกใช้
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ตารางแสดงประวัติสารเคมีล่าสุด */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 mt-8">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-teal-600" />
          ประวัติล็อกเบิกจ่ายสารตรวจและอุปกรณ์ล่าสุด (เกาะติดเส้นทางเบิกสิทธิ์จริง)
        </h3>

        {logs.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl">
            ยังไม่มีบันทึกข้อมูลการใช้งานสารตรวจในคลังเวลานี้
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-505 uppercase">
                  <th className="px-4 py-3">วันทีทำการเบิกใช้</th>
                  <th className="px-4 py-3">หมวดงานห้องแล็บ</th>
                  <th className="px-4 py-3">ชื่อน้ำยา / อุปกรณ์</th>
                  <th className="px-4 py-3 font-mono">LOT No.</th>
                  <th className="px-4 py-3 text-right">ยอดดึงเบิก</th>
                  <th className="px-4 py-3 text-right text-rose-600">สิทธิ์หักคลัง</th>
                  <th className="px-4 py-3 text-right text-teal-600">สต็อกคงเหลือล็อตปัจจุบัน</th>
                  <th className="px-4 py-3 text-center">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {logs.slice().reverse().map((log) => {
                  const isFefotag = log.id.startsWith('log_fefo_');
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatThaiDate(log.withdrawDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">
                          {log.sampleGroup}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {log.itemName}
                          </span>
                          {isFefotag && (
                            <span className="text-[9px] text-teal-600 font-bold uppercase tracking-wider">
                              ⚡ ดำเนินการอัจฉริยะด้วย Auto-FEFO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 font-semibold">{log.lot}</td>
                      <td className="px-4 py-3 text-right font-mono">{log.withdrawQty} ชุด</td>
                      <td className="px-4 py-3 text-right text-rose-600 font-bold font-mono">
                        -{log.withdrawQty} ชุด
                      </td>
                      <td className="px-4 py-3 text-right text-teal-600 font-bold font-mono bg-teal-500/5">
                        {log.remainingQtyAfter} ชุด
                      </td>
                      <td className="px-4 py-3 text-center">
                        {onCancelWithdraw && (
                          cancelingLogId === log.id ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  onCancelWithdraw(log.id);
                                  setCancelingLogId(null);
                                }}
                                className="px-2 py-1 bg-rose-600 text-white font-bold text-[9px] rounded-md shadow-xs cursor-pointer"
                              >
                                ยืนยันคืนคลัง
                              </button>
                              <button
                                onClick={() => setCancelingLogId(null)}
                                className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-350 text-[9px] rounded-md cursor-pointer"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setCancelingLogId(log.id)}
                              className="px-2.5 py-1 text-[9px] font-bold bg-amber-50 dark:bg-amber-955 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer transition-all active:scale-95"
                            >
                              ยกเลิกเบิก (คืนสต็อก)
                            </button>
                          )
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
    </div>
  );
}
