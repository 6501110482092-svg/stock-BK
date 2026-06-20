import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FlaskConical, ClipboardList, PlusCircle, LayoutDashboard, 
  Settings, CreditCard, ShieldAlert, HeartPulse, CheckSquare, Sparkles, Database, FileText,
  BarChart3
} from 'lucide-react';

import { StockItem, WithdrawalLog, PaymentStatus, Thresholds } from './types';
import { 
  INITIAL_STOCK, INITIAL_LOGS,
  getAlertLevel, formatThaiDate
} from './utils';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc } from 'firebase/firestore';

import AddStockPanel from './components/AddStockPanel';
import WithdrawStockPanel from './components/WithdrawStockPanel';
import StockListPanel from './components/StockListPanel';
import StatsPanel from './components/StatsPanel';
import BackupExportPanel from './components/BackupExportPanel';

// Deep clean data for Firestore (remove undefined and format objects)
function cleanData(data: any): any {
  if (data === undefined) return null;
  if (data === null) return null;
  if (Array.isArray(data)) {
    return data.map(item => cleanData(item));
  }
  if (typeof data === 'object') {
    const clean: any = {};
    Object.keys(data).forEach(key => {
      const val = data[key];
      if (val !== undefined) {
        clean[key] = cleanData(val);
      }
    });
    return clean;
  }
  return data;
}

export default function App() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [logs, setLogs] = useState<WithdrawalLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'withdraw' | 'add' | 'list' | 'stats' | 'backup'>('withdraw');

  // Real-time Cloud Sync Configuration
  useEffect(() => {
    let isFirstStockFetch = true;

    const unsubscribeStock = onSnapshot(collection(db, "stockItems"), async (snapshot) => {
      const items: StockItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as StockItem);
      });

      // Auto-populate when Firestore is initial and empty
      if (isFirstStockFetch) {
        isFirstStockFetch = false;
        if (snapshot.empty) {
          console.log("No data found in Firestore, seeding default clinical stock templates...");
          try {
            const batch = writeBatch(db);
            INITIAL_STOCK.forEach((item) => {
              batch.set(doc(db, "stockItems", item.id), cleanData(item));
            });
            INITIAL_LOGS.forEach((log) => {
              batch.set(doc(db, "logs", log.id), cleanData(log));
            });
            await batch.commit();
          } catch (err) {
            console.error("Auto seeding failed:", err);
          }
          return;
        }
      }

      // Sort items by createdAt descending
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setStockItems(items);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore loading error:", error);
      setIsLoading(false);
    });

    const unsubscribeLogs = onSnapshot(collection(db, "logs"), (snapshot) => {
      const logItems: WithdrawalLog[] = [];
      snapshot.forEach((doc) => {
        logItems.push({ id: doc.id, ...doc.data() } as WithdrawalLog);
      });
      // Sort logs by id/timestamp descending
      logItems.sort((a, b) => b.id.localeCompare(a.id));
      setLogs(logItems);
    });

    return () => {
      unsubscribeStock();
      unsubscribeLogs();
    };
  }, []);

  // บันทึกและดึงกลุ่มตัวอย่างเพื่อใช้เป็นตัวกรองโดยดึงเฉพาะกลุ่มที่มีอยู่จริง
  const sampleGroups = useMemo(() => {
    const groups = stockItems.map(item => item.sampleGroup);
    return Array.from(new Set(groups)).filter(Boolean);
  }, [stockItems]);

  // ฟังก์ชันเพิ่มสต็อกใหม่
  const handleAddItem = async (newItem: StockItem) => {
    try {
      await setDoc(doc(db, "stockItems", newItem.id), cleanData(newItem));
    } catch (e) {
      console.error("Error adding item:", e);
      alert("ไม่สามารถเพิ่มข้อมูลในคลังระบบคลาวด์ได้");
    }
  };

  // ฟังก์ชันเบิกของออกใช้งานทีละล็อตโดยเจาะจง
  const handleWithdrawItem = async (itemId: string, qty: number, withdrawDate: string) => {
    const item = stockItems.find(i => i.id === itemId);
    if (!item) return;

    const remainingQtyBefore = item.currentQty;
    const remainingQtyAfter = Math.max(0, item.currentQty - qty);
    
    // บันทึกลง Log เพิ่มเติม
    const newLog: WithdrawalLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      itemId,
      itemName: item.name,
      lot: item.lot,
      sampleGroup: item.sampleGroup,
      withdrawQty: qty,
      withdrawDate,
      remainingQtyBefore,
      remainingQtyAfter
    };

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "stockItems", itemId), { currentQty: remainingQtyAfter });
      batch.set(doc(db, "logs", newLog.id), cleanData(newLog));
      await batch.commit();
    } catch (e) {
      console.error("Error withdrawing:", e);
      alert("เกิดข้อผิดพลาดในการบันทึกการเบิกน้ำยา");
    }
  };

  // ฟังก์ชันเบิกน้ำยาอัจฉริยะ (FEFO - First Expired, First Out)
  // หากชื่อน้ำยาเดียวกัน จะหักลดล็อตที่ใกล้หมดอายุก่อนตามหลักการแล็บมาตรฐานแบบอัตโนมัติ
  const handleWithdrawFEFO = async (itemName: string, totalQtyToWithdraw: number, withdrawDate: string) => {
    // ดึงทุกล็อตที่ชื่อพ้องกันและยังมีของคงเหลืออยู่
    const sameNamedLots = stockItems
      .filter((item) => item.name.trim().toLowerCase() === itemName.trim().toLowerCase() && item.currentQty > 0)
      // เรียงจากวันหมดอายุที่หมดก่อน (FEFO)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    const totalAvailable = sameNamedLots.reduce((sum, item) => sum + item.currentQty, 0);
    if (totalAvailable < totalQtyToWithdraw) {
      alert(`ยอดคงเหลือรวมทุกล็อตสะสมสำหรับ "${itemName}" มีเพียง ${totalAvailable} ชุด ไม่พอเบิกจำนวน ${totalQtyToWithdraw} ชุด`);
      return null;
    }

    let remainingToWithdraw = totalQtyToWithdraw;
    const deductions: { item: StockItem; qtyDeducted: number; before: number; after: number }[] = [];

    // ดำเนินการปันส่วนหักสต็อกล็อตที่หมดอายุเร็วก่อน
    for (const lot of sameNamedLots) {
      if (remainingToWithdraw <= 0) break;
      const qtyDeducted = Math.min(lot.currentQty, remainingToWithdraw);
      remainingToWithdraw -= qtyDeducted;
      
      deductions.push({
        item: lot,
        qtyDeducted,
        before: lot.currentQty,
        after: lot.currentQty - qtyDeducted
      });
    }

    try {
      const batch = writeBatch(db);
      const addedLogs: WithdrawalLog[] = deductions.map((d, index) => {
        const logId = 'log_fefo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) + '_' + index;
        const log: WithdrawalLog = {
          id: logId,
          itemId: d.item.id,
          itemName: d.item.name,
          lot: d.item.lot,
          sampleGroup: d.item.sampleGroup,
          withdrawQty: d.qtyDeducted,
          withdrawDate,
          remainingQtyBefore: d.before,
          remainingQtyAfter: d.after
        };
        batch.set(doc(db, "logs", logId), cleanData(log));
        batch.update(doc(db, "stockItems", d.item.id), { currentQty: d.after });
        return log;
      });

      await batch.commit();
      return deductions; // คืนอาร์เรย์สรุปการหัก เพื่อนำไปป้อนผลแจ้งเตือนบนหน้าความคืบหน้าของ UI
    } catch (e) {
      console.error("Error withdrawing FEFO:", e);
      alert("เกิดข้อผิดพลาดในการบันทึกการเบิกน้ำยาแบบถ้วนหน้า");
      return null;
    }
  };

  // ฟังก์ชันยกเลิกการเบิก (คืนสต็อกเข้าคลังเหมือนเดิม)
  const handleCancelWithdrawal = async (logId: string) => {
    const targetLog = logs.find((l) => l.id === logId);
    if (!targetLog) return;

    const item = stockItems.find(i => i.id === targetLog.itemId);
    try {
      const batch = writeBatch(db);
      if (item) {
        const potentialQty = item.currentQty + targetLog.withdrawQty;
        const finalQty = Math.min(item.initialQty, potentialQty);
        batch.update(doc(db, "stockItems", item.id), { currentQty: finalQty });
      }
      batch.delete(doc(db, "logs", logId));
      await batch.commit();
    } catch (e) {
      console.error("Error canceling withdrawal:", e);
      alert("ไม่สามารถยกเลิกการเบิกคลังได้");
    }
  };

  // ลบไอเทม
  const handleDeleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, "stockItems", id));
    } catch (e) {
      console.error("Error deleting item:", e);
      alert("ไม่สามารถลบทิ้งน้ำยาสำเร็จรูปจากระบบคลาวด์ได้");
    }
  };

  // ปรับอัปเดตสถานะเครดิต
  const handleUpdatePaymentStatus = async (id: string, status: PaymentStatus) => {
    try {
      await setDoc(doc(db, "stockItems", id), { paymentStatus: status }, { merge: true });
    } catch (e) {
      console.error("Error updating payment status:", e);
      alert("ไม่สามารถอัปเดตสถานะการจ่ายเงินได้");
    }
  };

  // ปรับเกณฑ์เตือนสีเฉพาะตัว
  const handleUpdateThresholds = async (id: string, critical: number, low: number, high: number) => {
    try {
      await setDoc(
        doc(db, "stockItems", id),
        { thresholds: { critical, low, high } },
        { merge: true }
      );
    } catch (e) {
      console.error("Error updating thresholds:", e);
      alert("ไม่สามารถแก้เกณฑ์แจ้งเตือนสีได้");
    }
  };

  // ฟังก์ชันแทนที่อัปเดตข้อมูลสำรองทั้งหมด
  const handleImportBackup = async (importedStock: StockItem[], importedLogs: WithdrawalLog[]) => {
    try {
      const promises: Promise<any>[] = [];
      importedStock.forEach(item => {
        promises.push(setDoc(doc(db, "stockItems", item.id), cleanData(item)));
      });
      importedLogs.forEach(log => {
        promises.push(setDoc(doc(db, "logs", log.id), cleanData(log)));
      });
      await Promise.all(promises);
      alert("นำเข้าและสลับฐานข้อมูลกลางระบบซิงค์เรียบร้อยแล้ว!");
    } catch (e) {
      console.error("Error importing backup:", e);
      alert("เกิดข้อผิดพลาดในการโหลดไฟล์ข้อมูล");
    }
  };

  // รีเซ็ตข้อมูลกลับคืนตัวอย่างเริ่มต้น
  const handleResetMocks = async () => {
    if (!window.confirm("คุณแน่ใจหรือไม่ที่จะล้างคลังทั้งหมดและรีเซ็ตค่าเป็นชุดน้ำยาจำลองเริ่มต้น?")) return;
    try {
      setIsLoading(true);
      const deletePromises: Promise<any>[] = [];
      stockItems.forEach(item => {
        deletePromises.push(deleteDoc(doc(db, "stockItems", item.id)));
      });
      logs.forEach(log => {
        deletePromises.push(deleteDoc(doc(db, "logs", log.id)));
      });
      await Promise.all(deletePromises);

      const writePromises: Promise<any>[] = [];
      INITIAL_STOCK.forEach(item => {
        writePromises.push(setDoc(doc(db, "stockItems", item.id), cleanData(item)));
      });
      INITIAL_LOGS.forEach(log => {
        writePromises.push(setDoc(doc(db, "logs", log.id), cleanData(log)));
      });
      await Promise.all(writePromises);
      alert("รีเซ็ตคลังสำเร็จ ระบบบันทึกข้อมูลตั้งต้นลงสู่กลุ่มคลาวด์ของคุณแล้ว!");
    } catch (e) {
      console.error("Reset mocks failed:", e);
      alert("เกิดข้อผิดพลาดในการล้างข้อมูลเพื่อรีเซ็ต");
    } finally {
      setIsLoading(false);
    }
  };


  // รายการเตือนวิกฤต (สีแดง) เพื่อจดจ่อเตือนด่วนบน Dashboard
  const criticalItems = useMemo(() => {
    return stockItems.filter(item => {
      if (!item.thresholds) return false;
      return item.currentQty <= item.thresholds.critical && item.currentQty > 0;
    });
  }, [stockItems]);

  // รายการสินค้าหมดเกลี้ยง (Qty = 0)
  const emptyItems = useMemo(() => {
    return stockItems.filter(item => item.currentQty === 0);
  }, [stockItems]);

  // ตรวจตั๋วป้ายหนี้ติดเครดิต เลยกำหนด
  const overdueCreditsCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return stockItems.filter(item => {
      if (item.paymentType === 'credit' && item.paymentStatus === 'pending' && item.paymentDueDate) {
        const due = new Date(item.paymentDueDate);
        return due < today;
      }
      return false;
    }).length;
  }, [stockItems]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      
      {/* ส่วนแถบประดับด้านบน ( clinic headers ) */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            
            {/* โลโก้และชื่อคลินิก */}
            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-600 rounded-2xl text-white shadow-md shadow-teal-600/10">
                <FlaskConical className="w-8 h-8" id="logo-icon" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] font-bold text-teal-600 tracking-wider bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100 uppercase">
                    Medical Technology Laboratory
                  </span>
                  {isLoading ? (
                    <span className="text-[10px] font-bold text-amber-600 tracking-wider bg-amber-50 px-2 sm:px-2.5 py-0.5 rounded-full border border-amber-100 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      กำลังเชื่อมต่อคลาวด์...
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-600 tracking-wider bg-emerald-50 px-2 sm:px-2.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      เรียลไทม์คลาวด์ Active
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 font-sans mt-1">
                  ระบบบริหารสต็อกน้ำยา & ชุดตรวจคลินิกเทคนิคการแพทย์
                </h1>
                <p className="text-xs text-slate-500">
                  ควบคุมสารเคมีวิเคราะห์วิจัย, เกณฑ์สีเตือนของขาด, ประวัติการเบิกใช้น้ำยา และบันทึกเครดิตหนี้สิน
                </p>
              </div>
            </div>

            {/* หมุดประมวลผลด่วนของแดชบอร์ด */}
            <div className="flex flex-wrap gap-2 text-xs">
              {emptyItems.length > 0 && (
                <div className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-xl border border-rose-100 flex items-center gap-1.5 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  สินค้าหมดเกลี้ยง!คลังค้างอยู่ {emptyItems.length} ตัวอย่าง
                </div>
              )}
              {criticalItems.length > 0 && (
                <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1.5 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  จุดวิกฤตความเสี่ยงสีแดง {criticalItems.length} รายการ
                </div>
              )}
              {overdueCreditsCount > 0 && (
                <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-100 flex items-center gap-1.5 font-semibold">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  เลยกำหนดชำระเครดิตคู่ค้า {overdueCreditsCount} ใบแจ้งหนี้
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* แถบการเลือกโหมดใช้งานหลัก */}
      <section className="bg-slate-100 border-b border-slate-200 py-3 sticky top-20 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            {/* แท็บเมนู */}
            <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
              <button
                onClick={() => setActiveTab('withdraw')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer select-none ${
                  activeTab === 'withdraw'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                โหมดเบิกของไปใช้งาน
              </button>

              <button
                onClick={() => setActiveTab('add')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer select-none ${
                  activeTab === 'add'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                โหมดเพิ่มสต็อกสารเคมี
              </button>

              <button
                onClick={() => setActiveTab('list')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer select-none ${
                  activeTab === 'list'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                ฐานข้อมูลคลัง & ชำระเงิน
              </button>

              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer select-none ${
                  activeTab === 'stats'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                โหมดวิเคราะห์ & สถิติการใช้
              </button>

              <button
                onClick={() => setActiveTab('backup')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer select-none ${
                  activeTab === 'backup'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Database className="w-4 h-4" />
                เซฟข้อมูลสำรอง
              </button>
            </div>

            {/* แสดงโหมดปัจจุบันเป็นตัวอักษรบอกนัยผู้ใช้งาน */}
            <div className="text-[11px] text-slate-500 font-medium">
              เซสชันปัจจุบันเก็บไอเทมคลังทั้งหมด <span className="font-bold text-slate-800">{stockItems.length}</span> ตัวอย่างน้ำยา
            </div>

          </div>
        </div>
      </section>

      {/* หน้าโหมดนำเข้า/เบิกของใช้งานหลัก */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'withdraw' && (
              <WithdrawStockPanel
                stockItems={stockItems}
                onWithdraw={handleWithdrawItem}
                onWithdrawFEFO={handleWithdrawFEFO}
                onCancelWithdraw={handleCancelWithdrawal}
                logs={logs}
                sampleGroups={sampleGroups}
              />
            )}

            {activeTab === 'add' && (
              <AddStockPanel
                onAddItem={handleAddItem}
                sampleGroups={sampleGroups}
                stockItems={stockItems}
              />
            )}

            {activeTab === 'list' && (
              <StockListPanel
                stockItems={stockItems}
                onDeleteItem={handleDeleteItem}
                onUpdatePaymentStatus={handleUpdatePaymentStatus}
                onUpdateThresholds={handleUpdateThresholds}
                sampleGroups={sampleGroups}
              />
            )}

            {activeTab === 'stats' && (
              <StatsPanel
                stockItems={stockItems}
                logs={logs}
              />
            )}

            {activeTab === 'backup' && (
              <BackupExportPanel
                stockItems={stockItems}
                logs={logs}
                onImportBackup={handleImportBackup}
                onResetMocks={handleResetMocks}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ความรับผิดชอบในส่วนท้าย */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>
            © 2026 ระบบการจัดการคลังแล็บเทคโนโลยีทางการแพทย์. ข้อมูลประสานทางไกลแบบคู่ขนาน มีระบบเก็บข้อมูลอย่างปลอดภัยบนห้องปฏิบัติการของคุณ
          </p>
          <div className="flex gap-3">
            <span className="text-emerald-600 font-bold">● ซิงค์ข้อมูลข้ามเครื่องเรียลไทม์ (บันทึกอัตโนมัติ)</span>
            <span className="text-slate-300">|</span>
            <button 
              onClick={() => setActiveTab('backup')} 
              className="text-indigo-600 hover:underline font-semibold"
            >
              📥 ดาวน์โหลด JSON สำรองด่วน
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
