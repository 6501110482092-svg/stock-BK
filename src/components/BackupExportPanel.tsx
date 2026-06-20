import React, { useRef, useState } from 'react';
import { Download, Upload, RefreshCcw, Database, FileCode, Check } from 'lucide-react';
import { StockItem, WithdrawalLog } from '../types';
import { INITIAL_STOCK, INITIAL_LOGS } from '../utils';

interface BackupExportPanelProps {
  stockItems: StockItem[];
  logs: WithdrawalLog[];
  onImportBackup: (importedStock: StockItem[], importedLogs: WithdrawalLog[]) => void;
  onResetMocks: () => void;
}

export default function BackupExportPanel({ stockItems, logs, onImportBackup, onResetMocks }: BackupExportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const handleExport = () => {
    const backupData = {
      app: 'MedicalTechnologyClinicalStockSystem',
      exportVersion: '1.0',
      exportDate: new Date().toISOString(),
      stockItems,
      logs
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href",     dataStr);
    
    const formattedDate = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute("download", `clinical_stock_backup_${formattedDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('💾 ส่งออกข้อมูลสำรองสำเร็จ! ดาวน์โหลดไฟล์ของคุณเรียบร้อย');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonContent = JSON.parse(event.target?.result as string);
        if (
          jsonContent &&
          Array.isArray(jsonContent.stockItems) &&
          Array.isArray(jsonContent.logs)
        ) {
          onImportBackup(jsonContent.stockItems, jsonContent.logs);
          showToast('⚡ นำเข้าชุดข้อมูลสำรองในห้องปฏิบัติการเรียบร้อย!');
        } else {
          alert('รูปแบบไฟล์ข้อมูลสำรองไม่ถูกต้อง เกณฑ์ข้อมูลไม่ครบถ้วน');
        }
      } catch (err) {
        alert('ไม่สามารถอ่านไฟล์ได้ กรุณาใช้ไฟล์ชนิด .json ที่ได้จากการส่งออกจากเว็บคู่มือนี้');
      }
    };
    reader.readAsText(file);

    // ล้างแฟ้มเพื่อให้สามารถคลิกซ้ำได้
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg('');
    }, 4000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 max-w-4xl mx-auto mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg text-indigo-600">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 font-sans">
            การสำรองข้อมูลและความปลอดภัยของคลังคลินิก (Backup / Recovery)
          </h3>
          <p className="text-xs text-slate-500">
            ระบบจัดเก็บเป็น Local Storage บนเบราว์เซอร์ เพื่อป้องกันภัยข้อมูลสูญหาย ท่านสามารถสำรองข้อมูลเก็บไว้เป็นไฟล์เดี่ยวได้
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        
        {/* ส่งออก */}
        <div className="bg-slate-50 dark:bg-slate-950/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
              <Download className="w-4 h-4 text-teal-600" />
              ดาวน์โหลดสำรองข้อมูล
            </h4>
            <p className="text-[11px] text-slate-400">
              บันทึกโครงไฟล์ปัจจุบัน ({stockItems.length} ตัวอย่าง, {logs.length} บันทึกเบิก) เป็น .json ลงคอมพิวเตอร์
            </p>
          </div>
          <button
            onClick={handleExport}
            className="mt-3 w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5" />
            ดาวน์โหลดไฟล์สำรอง
          </button>
        </div>

        {/* นำเข้า */}
        <div className="bg-slate-50 dark:bg-slate-950/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
              <Upload className="w-4 h-4 text-indigo-600" />
              กู้คืนจากไฟล์สำรอง
            </h4>
            <p className="text-[11px] text-slate-400">
              อัปโหลดไฟล์สำรองข้อมูล (JSON) กลับเข้าไปในระบบคลัง เพื่อแทนที่ข้อมูลปัจจุบันทันที
            </p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            เลือกอัปโหลดสำรอง
          </button>
        </div>

        {/* รีเซ็ตล้าง/ข้อมูลสมมติ */}
        <div className="bg-slate-50 dark:bg-slate-950/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
              <RefreshCcw className="w-4 h-4 text-amber-500" />
              ล้างสต็อก & รีโหลดตัวอย่าง
            </h4>
            <p className="text-[11px] text-slate-400">
              ล้างข้อมูลในระบบออกทั้งหมด และโหลดเซ็ตตัวอย่างน้ำยา (Mock Reagents) เข้าไปเพื่อทดลองกดหรือทดสอบระบบเบิกจ่าย
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm('คุณต้องการรีเซ็ตคลังน้ำยาและนำเข้าชุดตัวอย่าง Mock Reagents หรือไม่? ข้อมูลเดิมของคุณที่มีในเซสชันปัจจุบันจะถูกแทนที่ทั้งหมด!')) {
                onResetMocks();
                showToast('🧪 ล้างคลังและป้อนสินค้าตัวอย่างกลับคืนสำเร็จ!');
              }
            }}
            className="mt-3 w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            แทนที่ด้วยข้อมูลทดลองน้ำยา
          </button>
        </div>

      </div>
    </div>
  );
}
