import React, { useState } from 'react';
import { Download, Database, FileCode, Check, ShieldCheck } from 'lucide-react';
import { StockItem, WithdrawalLog, ProcurementTarget } from '../types';

interface BackupExportPanelProps {
  stockItems: StockItem[];
  logs: WithdrawalLog[];
  procurementTargets?: ProcurementTarget[];
}

export default function BackupExportPanel({ 
  stockItems, 
  logs, 
  procurementTargets = []
}: BackupExportPanelProps) {
  const [successMsg, setSuccessMsg] = useState('');

  const handleExport = () => {
    const backupData = {
      app: 'MedicalTechnologyClinicalStockSystem',
      exportVersion: '1.2',
      exportDate: new Date().toISOString(),
      stockItems,
      logs,
      procurementTargets
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const formattedDate = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    downloadAnchor.setAttribute("download", `clinical_stock_backup_${formattedDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('💾 ดาวน์โหลดไฟล์สำรองข้อมูลสำเร็จเรียบร้อย! (บันทึกไฟล์ .json ลงเครื่องแล้ว)');
  };

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg('');
    }, 4000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 max-w-3xl mx-auto mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-teal-50 dark:bg-teal-950/30 rounded-xl text-teal-600 dark:text-teal-400">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 font-sans">
            การดาวน์โหลดสำรองข้อมูลคลังคลินิก (Backup Export / JSON)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ระบบจัดเก็บและซิงค์ข้อมูลบนคลาวด์แบบเรียลไทม์ ท่านสามารถดาวน์โหลดข้อมูลเก็บไว้เป็นไฟล์ .json บนคอมพิวเตอร์ได้ตลอดเวลา
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1">
              <Download className="w-4 h-4 text-teal-600" />
              ดาวน์โหลดสำรองข้อมูลคลังปัจจุบัน
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              โครงสร้างข้อมูลประกอบด้วย: รายการน้ำยา {stockItems.length} รายการ, ประวัติการเบิกจ่าย {logs.length} รายการ, และเป้าหมายสั่งซื้อ {procurementTargets.length} รายการ
            </p>
          </div>
          
          <button
            onClick={handleExport}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all select-none cursor-pointer shrink-0"
          >
            <FileCode className="w-4 h-4" />
            ดาวน์โหลดไฟล์สำรอง (.json)
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>การดาวน์โหลดสำรองข้อมูลมีความปลอดภัย 100% ไม่มีผลกระทบหรือการแก้ไขเปลี่ยนแปลงข้อมูลใดๆ ในระบบคลัง</span>
        </div>
      </div>
    </div>
  );
}
