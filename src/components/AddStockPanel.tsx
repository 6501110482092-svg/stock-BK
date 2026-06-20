import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { PlusCircle, Info, DollarSign, Calendar, Tag, ShieldAlert, CheckCircle, Sparkles } from 'lucide-react';
import { StockItem, PaymentType } from '../types';

interface AddStockPanelProps {
  onAddItem: (newItem: StockItem) => void;
  sampleGroups: string[];
  stockItems: StockItem[];
}

export default function AddStockPanel({ onAddItem, sampleGroups, stockItems }: AddStockPanelProps) {
  // ฟอร์มสเตต
  const [name, setName] = useState('');
  const [sampleGroup, setSampleGroup] = useState('');
  const [customSampleGroup, setCustomSampleGroup] = useState('');
  const [lot, setLot] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [initialQty, setInitialQty] = useState<number | ''>('');
  const [totalPrice, setTotalPrice] = useState<number | ''>('');
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  
  // ตรวจจับชื่อซ้ำเพื่อดึงข้อมูลเชิงลึก
  const [hasAutoFilled, setHasAutoFilled] = useState(false);

  // รายชื่อยา/น้ำยาที่มีอยู่แล้วในระบบเพื่อแนะนำการกดปุ่ม
  const savedReagentNames = useMemo(() => {
    return Array.from(new Set(stockItems.map(item => item.name))).filter(Boolean);
  }, [stockItems]);
  
  // การจ่ายเงิน
  const [paymentType, setPaymentType] = useState<PaymentType>('cash');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  
  // แจ้งเตือนเกณฑ์สีขั้นต่ำ (สามารถใส่หรือไม่ใส่ก็ได้)
  const [useThresholds, setUseThresholds] = useState(true);
  const [criticalQty, setCriticalQty] = useState<number | ''>(5);
  const [lowQty, setLowQty] = useState<number | ''>(15);
  const [highQty, setHighQty] = useState<number | ''>(30);

  // สถานะหลังจากบันทึก
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedItemName, setSavedItemName] = useState('');

  // คำนวณราคาต่อชุดอัตโนมัติเมื่อจำนวนหรือราคารวมเปลี่ยน
  useEffect(() => {
    const qty = Number(initialQty);
    const total = Number(totalPrice);
    if (qty > 0 && total >= 0) {
      setPricePerUnit(Number((total / qty).toFixed(2)));
    } else {
      setPricePerUnit(0);
    }
  }, [initialQty, totalPrice]);

  // ตรวจจับชื่อซ้ำเพื่อดึงข้อมูลกลุ่มตัวอย่างและเกณฑ์แจ้งเตือนที่มีอยู่เดิมมาใส่ให้อัตโนมัติ ป้องกันชื่อสะกดผิดและลดภาระการคีย์
  useEffect(() => {
    if (!name || name.trim() === '') {
      setHasAutoFilled(false);
      return;
    }

    const matchedItem = stockItems.find(
      item => item.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

    if (matchedItem) {
      if (sampleGroups.includes(matchedItem.sampleGroup)) {
        setSampleGroup(matchedItem.sampleGroup);
      } else {
        setSampleGroup('custom');
        setCustomSampleGroup(matchedItem.sampleGroup);
      }

      if (matchedItem.thresholds) {
        setUseThresholds(true);
        setCriticalQty(matchedItem.thresholds.critical);
        setLowQty(matchedItem.thresholds.low);
        setHighQty(matchedItem.thresholds.high);
      } else {
        setUseThresholds(false);
      }
      setHasAutoFilled(true);
    } else {
      setHasAutoFilled(false);
    }
  }, [name, stockItems, sampleGroups]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || (!sampleGroup && !customSampleGroup) || !lot || !expiryDate || !receiveDate || !initialQty) {
      alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    const qty = Number(initialQty);
    if (qty <= 0) {
      alert('จำนวนชุดต้องมากกว่า 0');
      return;
    }

    const finalSampleGroup = sampleGroup === 'custom' || !sampleGroup ? customSampleGroup : sampleGroup;
    if (!finalSampleGroup) {
      alert('กรุณาระบุกลุ่มตัวอย่าง');
      return;
    }

    // จัดทําอ็อบเจกต์ Threshold
    let thresholds = null;
    if (useThresholds) {
      thresholds = {
        critical: Number(criticalQty || 0),
        low: Number(lowQty || 0),
        high: Number(highQty || 0),
      };
    }

    const newItem: StockItem = {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: name.trim(),
      sampleGroup: finalSampleGroup.trim(),
      lot: lot.trim(),
      expiryDate,
      receiveDate,
      initialQty: qty,
      currentQty: qty, // เริ่มต้นเท่ากับจำนวนชุดเต็ม
      totalPrice: Number(totalPrice || 0),
      pricePerUnit,
      paymentType,
      paymentStatus: paymentType === 'cash' ? 'paid' : 'pending',
      paymentDueDate: paymentType === 'credit' ? paymentDueDate : undefined,
      thresholds,
      createdAt: new Date().toISOString(),
    };

    onAddItem(newItem);
    setSavedItemName(newItem.name);
    setShowSuccess(true);

    // รีเซ็ตฟอร์ม
    setName('');
    setLot('');
    setExpiryDate('');
    setInitialQty('');
    setTotalPrice('');
    setPaymentDueDate('');
    
    // ตั้งหน่วงเวลาปิดกล่องความสำเร็จ
    setTimeout(() => {
      setShowSuccess(false);
    }, 4000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="p-2.5 bg-teal-50 dark:bg-teal-900/30 rounded-xl text-teal-600 dark:text-teal-400">
          <PlusCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            โหมดเพิ่มสต็อกน้ำยาและอุปกรณ์คลินิก
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ระบบจดบันทึกสารเคมี น้ำยา ชุดตรวจ หรือวัสดุสิ้นเปลืองทางการแพทย์เข้าสู่คลังแล็บ
          </p>
        </div>
      </div>

      {showSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300"
        >
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <div className="text-sm">
            <span className="font-semibold">บันทึกสำเร็จ!</span> เพิ่มน้ำยา <span className="font-mono underline">{savedItemName}</span> เข้าคลังเรียบร้อยแล้ว
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ส่วนที่ 1: ข้อมูลพื้นฐาน */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                ชื่อน้ำยา / ชุดตรวจ / ชื่ออุปกรณ์ <span className="text-rose-500">*</span>
              </label>
              {hasAutoFilled && (
                <span className="text-[11px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 animate-spin" /> ดึงข้อมูลกลุ่มตัวอย่างและเกณฑ์สีอัตโนมัติแล้ว!
                </span>
              )}
            </div>
            <input
              type="text"
              required
              list="saved-reagents"
              placeholder="เช่น CBC Diluent, Anti-A Reagent, ชุดตรวจตั้งครรภ์ hCG test, หลอดสูญญากาศ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all shadow-sm"
            />
            <datalist id="saved-reagents">
              {savedReagentNames.map((rName) => (
                <option key={rName} value={rName} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              กลุ่มตัวอย่าง / แผนกวิจัย <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2">
              <select
                value={sampleGroup}
                onChange={(e) => {
                  setSampleGroup(e.target.value);
                  if (e.target.value !== 'custom') {
                    setCustomSampleGroup('');
                  }
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all shadow-sm"
              >
                <option value="">-- เลือกกลุ่มตัวอย่างที่มี --</option>
                {sampleGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
                <option value="custom">✍️ พิมพ์กำหนดเองใหม่...</option>
              </select>

              {(sampleGroup === 'custom' || sampleGroups.length === 0) && (
                <input
                  type="text"
                  required
                  placeholder="พิมพ์กลุ่มตัวอย่าง เช่น โลหิตวิทยา, เคมีคลินิก, ภูมิคุ้มกันวิทยา, ปัสสาวะ"
                  value={customSampleGroup}
                  onChange={(e) => setCustomSampleGroup(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-emerald-50/50 dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all shadow-sm"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              หมายเลขล็อต (LOT No.) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น LOT2026B1, AA9876"
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              วันที่รับของเข้าคลัง <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={receiveDate}
              onChange={(e) => setReceiveDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-rose-400" />
              วันหมดอายุสารเคมี (Expiry Date) <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-rose-50/20 dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* ส่วนที่ 2: จำนวนและราคา (คำนวณราคาต่อชุด) */}
        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300 mb-3 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-500" /> 
            ข้อมูลราคาและปริมาณนำเข้า
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                จำนวนนำเข้า (กี่ชุด/กี่ชิ้น) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                placeholder="เช่น 100"
                value={initialQty}
                onChange={(e) => setInitialQty(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 font-sans">
                ราคารวมทั้งหมด (บาท)
              </label>
              <input
                type="number"
                min="0"
                placeholder="เช่น 15000"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="flex flex-col justify-end bg-teal-500/5 dark:bg-teal-500/10 border border-teal-500/20 px-4 py-2.5 rounded-lg">
              <span className="text-xs text-slate-500 dark:text-slate-400">ระบบคำนวณราคาต่อหน่วย:</span>
              <span className="text-lg font-bold text-teal-700 dark:text-teal-400 font-mono">
                {pricePerUnit.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท <span className="text-xs font-sans text-slate-500">/ ชุด</span>
              </span>
            </div>
          </div>
        </div>

        {/* ส่วนที่ 3: เกณฑ์สต็อกแจ้งเตือนสี (ใส่หรือไม่ใส่ก็ได้) */}
        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-500" />
              การแจ้งเตือนระดับจำนวนคงเหลือด้วยสี (รายไอเทม)
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={useThresholds}
                onChange={(e) => setUseThresholds(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
              <span className="ml-2 text-xs font-medium text-slate-600 dark:text-slate-400">เปิดใช้งานเตือน</span>
            </label>
          </div>

          {useThresholds ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-400">
                    สีเขียว (สต็อกเพียงพอ)
                  </label>
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="เช่น > 30"
                  value={highQty}
                  onChange={(e) => setHighQty(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value)))}
                  className="w-full px-2.5 py-1.5 text-sm rounded-md border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">ขึ้นสีเขียวเมื่อมีมากกว่าค่านี้</span>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <label className="block text-xs font-bold text-amber-800 dark:text-amber-400">
                    สีเหลือง (เริ่มเหลือน้อย)
                  </label>
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="เช่น <= 15"
                  value={lowQty}
                  onChange={(e) => setLowQty(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value)))}
                  className="w-full px-2.5 py-1.5 text-sm rounded-md border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">เตือนสีเหลืองเมื่อจํานวนลดลงมาต่ำกว่าหรือเท่ากับค่านี้</span>
              </div>

              <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                  <label className="block text-xs font-bold text-rose-800 dark:text-rose-400">
                    สีแดง (ระดับวิกฤต/ต้องสั่งเพิ่ม)
                  </label>
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="เช่น <= 5"
                  value={criticalQty}
                  onChange={(e) => setCriticalQty(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value)))}
                  className="w-full px-2.5 py-1.5 text-sm rounded-md border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">เตือนสีแดงเข้มเมือคงเหลือน้อยกว่าหรือเท่ากับระดับวิกฤตนี้</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 p-2 italic bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
              ปิดระบบเตือนระดับสี (รายการนี้จะเป็นสถานะกลางปกติสีเทา)
            </p>
          )}
        </div>

        {/* ส่วนที่ 4: เครดิต/เงินสด */}
        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300 mb-3 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-indigo-500" />
            การชำระเงินค่าสินค้า
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                รูปแบบการจ่ายเงิน <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-teal-500 transition-all shadow-sm">
                  <input
                    type="radio"
                    name="paymentType"
                    checked={paymentType === 'cash'}
                    onChange={() => setPaymentType('cash')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">เงินสด (จ่ายแล้ว)</span>
                </label>

                <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-teal-500 transition-all shadow-sm">
                  <input
                    type="radio"
                    name="paymentType"
                    checked={paymentType === 'credit'}
                    onChange={() => setPaymentType('credit')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">เครดิต (ค้างชำระ)</span>
                </label>
              </div>
            </div>

            {paymentType === 'credit' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-1"
              >
                <label className="block text-xs font-bold text-rose-700 dark:text-rose-400 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  วันที่ต้องชำระเครดิต (Due Date) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required={paymentType === 'credit'}
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-950 bg-rose-50/10 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <span className="text-[10px] text-slate-500 block">แจ้งเตือนปฎิทินหนี้เพื่อไม่ให้เลยกำหนด</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* ปุ่มบันทึก */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-3 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] transition-all text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md select-none"
          >
            <PlusCircle className="w-5 h-5" />
            บันทึกข้อมูลและนำเข้าคลัง
          </button>
        </div>
      </form>
    </div>
  );
}
