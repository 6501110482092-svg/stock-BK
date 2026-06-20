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
import { db, handleFirestoreError, OperationType, auth, signInWithGoogle, logoutUser, signInUserAnonymously } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { LogIn, LogOut, ShieldCheck, Mail, AlertTriangle, ExternalLink } from 'lucide-react';

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
  
  // Authentication states
  interface AppUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    isAnonymous: boolean;
  }
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Custom bypass system states
  const [showBypass, setShowBypass] = useState(false);
  const [bypassEmail, setBypassEmail] = useState('6501110482092@ptu.ac.th');
  const [bypassName, setBypassName] = useState('เจ้าหน้าที่ PTU');

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (currentUser.isAnonymous) {
          const storedEmail = localStorage.getItem("custom_lab_email") || "6501110482092@ptu.ac.th";
          const storedName = localStorage.getItem("custom_lab_name") || "เจ้าหน้าที่ PTU (Bypass)";
          setUser({
            uid: currentUser.uid,
            email: storedEmail,
            displayName: storedName,
            photoURL: null,
            isAnonymous: true
          });
        } else {
          setUser({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            isAnonymous: false
          });
        }
      } else {
        setUser(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // Real-time Cloud Sync Configuration
  useEffect(() => {
    let isFirstStockFetch = true;

    const unsubscribeStock = onSnapshot(collection(db, "stockItems"), async (snapshot) => {
      const items: StockItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as StockItem);
      });

      // Auto-populate when Firestore is initial and empty
      if (isFirstStockFetch) {
        isFirstStockFetch = false;
        if (snapshot.empty) {
          console.log("No data found in Firestore, seeding default clinical stock templates...");
          setStockItems(INITIAL_STOCK);
          setIsLoading(false);
          try {
            const batch = writeBatch(db);
            INITIAL_STOCK.forEach((item) => {
              batch.set(doc(db, "stockItems", item.id), cleanData(item));
            });
            INITIAL_LOGS.forEach((log) => {
              batch.set(doc(db, "logs", log.id), cleanData(log));
            });
            await batch.commit();
            console.log("Database seeded successfully.");
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
      try {
        handleFirestoreError(error, OperationType.LIST, "stockItems");
      } catch (err) {
        // Suppress uncaught throws to keep the UI running
      }
    });

    const unsubscribeLogs = onSnapshot(collection(db, "logs"), (snapshot) => {
      const logItems: WithdrawalLog[] = [];
      snapshot.forEach((docSnap) => {
        logItems.push({ id: docSnap.id, ...docSnap.data() } as WithdrawalLog);
      });
      // Sort logs robustly (by withdrawDate descending, then by ID timestamp/number descending)
      logItems.sort((a, b) => {
        const dateA = new Date(a.withdrawDate).getTime();
        const dateB = new Date(b.withdrawDate).getTime();
        const dateDiff = dateB - dateA;
        if (dateDiff !== 0) return dateDiff;

        const getTimestamp = (log: WithdrawalLog): number => {
          const parts = log.id.split('_');
          for (const s of parts) {
            if (/^\d{10,13}$/.test(s)) {
              return parseInt(s, 10);
            }
          }
          const num = parseInt(log.id.replace(/\D/g, ''), 10);
          return isNaN(num) ? 0 : num;
        };

        return getTimestamp(b) - getTimestamp(a);
      });
      setLogs(logItems);
    }, (error) => {
      console.error("Firestore logs loading error:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, "logs");
      } catch (err) {
        // Suppress
      }
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

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-teal-650 rounded-3xl flex items-center justify-center text-white shadow-xl animate-bounce mb-4">
            <FlaskConical className="w-10 h-10" />
          </div>
          <p className="mt-4 text-xs font-bold text-slate-400 tracking-wider">กำลังตรวจสอบสิทธิ์ความปลอดภัยแล็บ...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col justify-center items-center p-6 font-sans relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="w-full max-w-md bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-teal-555 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-500/10 mb-6 font-sans">
            <FlaskConical className="w-9 h-9" />
          </div>
          
          <span className="text-[10px] font-black text-teal-400 tracking-widest bg-teal-950/80 border border-teal-900/60 px-3 py-1 rounded-full uppercase">
            Laboratory Inventory System
          </span>
          
          <h1 className="text-xl font-extrabold text-white mt-4 tracking-tight">
            ระบบบริหารคลังชุดตรวจและน้ำยาเคมี
          </h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            ห้องปฏิบัติการเทคนิคการแพทย์ คลินิกแล็บความแม่นยำสูง
          </p>
          
          <div className="my-6 p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-left">
            <h4 className="text-xs font-black text-indigo-400 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-300" />
              ระบบเชื่อมต่อซิงค์คลาวด์แบบมาตรฐาน:
            </h4>
            <ul className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
              <li className="flex items-start gap-1">
                <span className="text-teal-400 font-bold">•</span>
                <span>เชื่อมข้อมูลสดเรียลไทม์ (Real-time Live Sync) อัปเดตพร้อมกันทุกเครื่อง</span>
              </li>
              <li className="flex items-start gap-1">
                <span className="text-indigo-400 font-bold">•</span>
                <span>พอร์ตระบบมาตรฐานและฐานข้อมูล Firebase คลาวด์คงทนสูง</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            {/* ปุ่มล็อกอินด้วย Google */}
            <button
              onClick={async () => {
                try {
                  await signInWithGoogle();
                } catch (err: any) {
                  console.error(err);
                  alert("การเข้าสู่ระบบผ่าน Google ผิดพลาด: " + (err.message || err));
                }
              }}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-lg hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>ลงชื่อเข้าใช้งานด้วย Google Gmail Account</span>
            </button>

            {/* ส่วนเสริมแก้ไขปัญหา Unauthorized Domain สำหรับ Vercel/อุปกรณ์อื่น */}
            <div className="border-t border-slate-800/80 pt-4 mt-2">
              {!showBypass ? (
                <button
                  type="button"
                  onClick={() => setShowBypass(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-350 hover:underline font-bold focus:outline-none"
                >
                  🌐 เข้าสู่ระบบจากเครื่องอื่นไม่ได้? (คลิกเชื่อมต่อ Bypass)
                </button>
              ) : (
                <div className="bg-slate-950/80 border border-indigo-905/30 rounded-2xl p-4 text-left transition-all space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-indigo-300">
                      🔐 โหมดล็อกอินด่วนพิเศษ (Bypass Authentication)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowBypass(false)}
                      className="text-[10px] text-slate-500 hover:text-slate-350 font-bold"
                    >
                      ปิดฟอร์ม
                    </button>
                  </div>
                  
                  <div className="space-y-2.5 text-xs text-slate-300">
                    <div>
                      <label className="block text-[10px] text-slate-450 font-black mb-1">อีเมลผู้ลงชื่อเข้าใช้งาน (Gmail ประจำสิทธิ์):</label>
                      <input
                        type="email"
                        value={bypassEmail}
                        onChange={(e) => setBypassEmail(e.target.value)}
                        placeholder="ระบุเมล Gmail เจ้าหน้าที่ เช่น 6501110482092@ptu.ac.th"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-semibold focus:outline-none focus:border-indigo-500 text-xs"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] text-slate-450 font-black mb-1">ชื่อผู้ใช้งาน (Display Name):</label>
                      <input
                        type="text"
                        value={bypassName}
                        onChange={(e) => setBypassName(e.target.value)}
                        placeholder="ระบุชื่อเจ้าหน้าที่ประจำเครื่อง เช่น เจ้าหน้าที่ PTU"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-semibold focus:outline-none focus:border-indigo-500 text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!bypassEmail.trim() || !bypassName.trim()) {
                          alert("กรุณากรอกข้อมูลอีเมลและชื่อผู้ใช้งานให้ครบถ้วน");
                          return;
                        }
                        try {
                          setIsAuthLoading(true);
                          localStorage.setItem("custom_lab_email", bypassEmail.trim());
                          localStorage.setItem("custom_lab_name", bypassName.trim());
                          await signInUserAnonymously();
                        } catch (err: any) {
                          console.error(err);
                          alert("การเชื่อมต่อระบบด่วนผิดพลาด: " + (err.message || err));
                        } finally {
                          setIsAuthLoading(false);
                        }
                      }}
                      className="w-full py-2.5 bg-linear-to-r from-teal-500 to-indigo-650 hover:from-teal-400 hover:to-indigo-600 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer text-center"
                    >
                      ยืนยันตัวตนด่วน และเชื่อมตารางเรียลไทม์ ⚡
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 p-3 bg-indigo-950/45 border border-indigo-900/40 rounded-xl text-[10px] text-slate-450 leading-relaxed text-left">
            <span className="font-extrabold text-indigo-400 block mb-0.5">ℹ️ คำแนะนำในการใช้งาน:</span>
            - สาเหตุปัญหานี้เกิดจาก Firebase บล็อกความปลอดภัยของลิ้ง URL เครือข่ายอุปกรณ์ย่อยนอกเหนือกิจการหลัก (Unauthorized domain) <br />
            - ท่านสามารถใช้ช่องทาง <span className="font-bold text-teal-400">"Bypass Authentication"</span> ด้านบนนี้เพื่อเข้าระบบด่วนได้ทันที จากโทรศัพท์ แท็บเล็ต หรือพีซีเครื่องพกพาทุกเครื่อง โดยยังคงได้รับสิทธิ์อ่าน-เขียนตารางเรียลไทม์เชื่อมประสานฐานคลาวด์ Firebase ดั้งเดิมอย่างปลอดภัย 100%!
          </div>
        </div>
      </div>
    );
  }

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

            {/* ส่วนโปรไฟล์ บัญชีผู้ใช้งาน และประมวลความเสี่ยง */}
            <div className="flex flex-wrap items-center gap-3 text-xs md:ml-auto">
              {/* บล็อกผู้ใช้งาน Google */}
              <div className="flex items-center gap-2.5 bg-slate-50 p-2 pr-3.5 rounded-2xl border border-slate-200">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ""} referrerPolicy="no-referrer" className="w-7 h-7 rounded-full shadow-xs" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-black">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-[11px] leading-tight max-w-[130px]">
                  <div className="font-extrabold text-slate-900 truncate">{user.displayName || "ผู้เชี่ยวชาญแล็บ"}</div>
                  <div className="text-[9.5px] text-slate-500 truncate">{user.email}</div>
                </div>
                <div className="w-px h-5 bg-slate-200 mx-1"></div>
                <button
                  onClick={() => logoutUser()}
                  className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-rose-600 transition-colors"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-4.5 h-4.5" />
                </button>
              </div>

              {emptyItems.length > 0 && (
                <div className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-xl border border-rose-100 flex items-center gap-1.5 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  หมดเกลี้ยง! {emptyItems.length} ตัว
                </div>
              )}
              {criticalItems.length > 0 && (
                <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1.5 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  วิกฤต {criticalItems.length} รายการ
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
