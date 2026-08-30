import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, Plus, Search, Filter, Edit3, Trash2, Link2, 
  CheckCircle2, AlertTriangle, PackageX, Sparkles, Printer, Copy, 
  Download, ChevronDown, ChevronUp, Layers, HelpCircle, ArrowRight,
  TrendingUp, Boxes, DollarSign, Calendar, RefreshCw, X, ShieldAlert,
  Check, Info, FileSpreadsheet, Building2, Package
} from 'lucide-react';
import { StockItem, WithdrawalLog, ProcurementTarget } from '../types';
import { formatThaiDate } from '../utils';

interface ProcurementOrderPanelProps {
  stockItems: StockItem[];
  logs: WithdrawalLog[];
  sampleGroups: string[];
  procurementTargets: ProcurementTarget[];
  onSaveTarget: (target: ProcurementTarget) => Promise<void> | void;
  onDeleteTarget: (id: string) => Promise<void> | void;
  onBatchSaveTargets?: (targets: ProcurementTarget[]) => Promise<void> | void;
}

export default function ProcurementOrderPanel({
  stockItems,
  logs,
  sampleGroups,
  procurementTargets,
  onSaveTarget,
  onDeleteTarget,
  onBatchSaveTargets
}: ProcurementOrderPanelProps) {
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'need-order' | 'sufficient' | 'urgent'>('all');

  // Expanded details for linked LOTs
  const [expandedTestIds, setExpandedTestIds] = useState<Record<string, boolean>>({});

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Partial<ProcurementTarget> | null>(null);

  // Delete Confirmation Modal state
  const [targetToDelete, setTargetToDelete] = useState<ProcurementTarget | null>(null);

  // Link Stock Modal state
  const [isLinkStockModalOpen, setIsLinkStockModalOpen] = useState(false);
  const [targetForLinking, setTargetForLinking] = useState<ProcurementTarget | null>(null);
  const [selectedStockIdsForLink, setSelectedStockIdsForLink] = useState<string[]>([]);

  // Print & PO Preview Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Toast / Copy notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Toggle accordion for LOT breakdown
  const toggleExpand = (id: string) => {
    setExpandedTestIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Helper to find matching stock items for a given test
  // If target.linkedStockIds is defined and non-empty, use those specific stock items.
  // Otherwise, match stockItems whose name matches the testName or is included in testName.
  const getLinkedStockItems = (target: ProcurementTarget): StockItem[] => {
    if (target.linkedStockIds && target.linkedStockIds.length > 0) {
      return stockItems.filter(item => target.linkedStockIds!.includes(item.id));
    }
    // Default fallback: Match by exact or normalized name
    return stockItems.filter(item => {
      const normalizedTarget = target.testName.trim().toLowerCase();
      const normalizedItem = item.name.trim().toLowerCase();
      return normalizedItem === normalizedTarget || 
             normalizedItem.includes(normalizedTarget) || 
             normalizedTarget.includes(normalizedItem);
    });
  };

  // Calculate stats and aggregated inventory for each procurement target
  const aggregatedData = useMemo(() => {
    return procurementTargets.map(target => {
      const linkedItems = getLinkedStockItems(target);
      const currentStock = linkedItems.reduce((sum, item) => sum + (item.currentQty || 0), 0);
      const totalDemand = (target.monthlyTargetQty || 0) + (target.safetyStockQty || 0);
      const rawNeeded = Math.max(0, totalDemand - currentStock);
      
      // Calculate packaging boxes/packs if packSize > 1
      const packSize = target.packSize > 0 ? target.packSize : 1;
      const packsNeeded = rawNeeded > 0 ? Math.ceil(rawNeeded / packSize) : 0;
      const actualOrderQty = rawNeeded > 0 ? packsNeeded * packSize : 0;

      // Estimated price (from target or average from linked stock items)
      let pricePerUnit = target.estimatedPricePerUnit || 0;
      if (pricePerUnit === 0 && linkedItems.length > 0) {
        const validPrices = linkedItems.map(i => i.pricePerUnit).filter(p => p > 0);
        if (validPrices.length > 0) {
          pricePerUnit = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
        }
      }
      const estimatedCost = actualOrderQty * pricePerUnit;

      // Status determination
      let status: 'urgent' | 'need-order' | 'sufficient' | 'surplus' = 'sufficient';
      if (currentStock === 0 || currentStock <= (target.monthlyTargetQty * 0.25)) {
        status = 'urgent';
      } else if (rawNeeded > 0) {
        status = 'need-order';
      } else if (currentStock >= totalDemand * 1.5) {
        status = 'surplus';
      } else {
        status = 'sufficient';
      }

      // Past 30-day average usage from logs
      const matchedLogs = logs.filter(log => {
        return linkedItems.some(i => i.id === log.itemId) || 
               log.itemName.toLowerCase().includes(target.testName.toLowerCase());
      });
      const totalPastWithdrawn = matchedLogs.reduce((sum, l) => sum + l.withdrawQty, 0);

      return {
        target,
        linkedItems,
        currentStock,
        totalDemand,
        rawNeeded,
        packsNeeded,
        actualOrderQty,
        pricePerUnit,
        estimatedCost,
        status,
        totalPastWithdrawn,
        stockCoveragePercent: totalDemand > 0 ? Math.round((currentStock / totalDemand) * 100) : 100
      };
    });
  }, [procurementTargets, stockItems, logs]);

  // Filtered rows for display
  const filteredData = useMemo(() => {
    return aggregatedData.filter(item => {
      const matchSearch = item.target.testName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.target.sampleGroup.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.target.supplier && item.target.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          item.linkedItems.some(li => li.lot.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchGroup = selectedGroup === '' || item.target.sampleGroup === selectedGroup;

      let matchStatus = true;
      if (statusFilter === 'need-order') {
        matchStatus = item.status === 'need-order' || item.status === 'urgent';
      } else if (statusFilter === 'urgent') {
        matchStatus = item.status === 'urgent';
      } else if (statusFilter === 'sufficient') {
        matchStatus = item.status === 'sufficient' || item.status === 'surplus';
      }

      return matchSearch && matchGroup && matchStatus;
    });
  }, [aggregatedData, searchTerm, selectedGroup, statusFilter]);

  // KPI calculations
  const kpis = useMemo(() => {
    const totalTests = aggregatedData.length;
    const needOrderItems = aggregatedData.filter(d => d.status === 'need-order' || d.status === 'urgent');
    const urgentItems = aggregatedData.filter(d => d.status === 'urgent');
    const sufficientItems = aggregatedData.filter(d => d.status === 'sufficient' || d.status === 'surplus');
    
    const totalUnitsToOrder = needOrderItems.reduce((sum, d) => sum + d.actualOrderQty, 0);
    const totalEstimatedBudget = needOrderItems.reduce((sum, d) => sum + d.estimatedCost, 0);

    return {
      totalTests,
      needOrderCount: needOrderItems.length,
      urgentCount: urgentItems.length,
      sufficientCount: sufficientItems.length,
      totalUnitsToOrder,
      totalEstimatedBudget
    };
  }, [aggregatedData]);

  // Open Edit Modal for a target
  const handleOpenEditModal = (target?: ProcurementTarget) => {
    if (target) {
      setEditingTarget({ ...target });
    } else {
      // Create new empty target
      setEditingTarget({
        id: 'target_' + Date.now(),
        testName: '',
        sampleGroup: sampleGroups[0] || 'Immunology & Blood Bank',
        monthlyTargetQty: 50,
        safetyStockQty: 5,
        unitName: 'ชุด',
        packSize: 1,
        estimatedPricePerUnit: 100,
        supplier: '',
        notes: '',
        linkedStockIds: []
      });
    }
    setIsEditModalOpen(true);
  };

  // Save target
  const handleSaveModal = async () => {
    if (!editingTarget || !editingTarget.testName?.trim()) {
      alert('กรุณาระบุชื่อ Test / น้ำยาตรวจ');
      return;
    }

    const payload: ProcurementTarget = {
      id: editingTarget.id || 'target_' + Date.now(),
      testName: editingTarget.testName.trim(),
      sampleGroup: editingTarget.sampleGroup || sampleGroups[0] || 'Immunology & Blood Bank',
      monthlyTargetQty: Number(editingTarget.monthlyTargetQty) || 0,
      safetyStockQty: Number(editingTarget.safetyStockQty) || 0,
      unitName: editingTarget.unitName?.trim() || 'ชุด',
      packSize: Number(editingTarget.packSize) || 1,
      estimatedPricePerUnit: Number(editingTarget.estimatedPricePerUnit) || 0,
      supplier: editingTarget.supplier?.trim() || '',
      linkedStockIds: editingTarget.linkedStockIds || [],
      notes: editingTarget.notes?.trim() || '',
      updatedAt: new Date().toISOString()
    };

    await onSaveTarget(payload);
    setIsEditModalOpen(false);
    setEditingTarget(null);
    showToast(`✅ บันทึกเป้าหมายการสั่งซื้อ "${payload.testName}" เรียบร้อยแล้ว`);
  };

  // Open Manage Linked Stock Modal
  const handleOpenLinkModal = (target: ProcurementTarget) => {
    setTargetForLinking(target);
    const currentlyLinked = target.linkedStockIds && target.linkedStockIds.length > 0
      ? target.linkedStockIds
      : stockItems
          .filter(item => {
            const normalizedTarget = target.testName.trim().toLowerCase();
            const normalizedItem = item.name.trim().toLowerCase();
            return normalizedItem === normalizedTarget || 
                   normalizedItem.includes(normalizedTarget) || 
                   normalizedTarget.includes(normalizedItem);
          })
          .map(item => item.id);

    setSelectedStockIdsForLink(currentlyLinked);
    setIsLinkStockModalOpen(true);
  };

  // Save linked stocks
  const handleSaveLinkedStocks = async () => {
    if (!targetForLinking) return;
    const updatedTarget: ProcurementTarget = {
      ...targetForLinking,
      linkedStockIds: selectedStockIdsForLink,
      updatedAt: new Date().toISOString()
    };
    await onSaveTarget(updatedTarget);
    setIsLinkStockModalOpen(false);
    setTargetForLinking(null);
    showToast(`🔗 อัปเดตการรวมสต็อกสำหรับ "${targetForLinking.testName}" สำเร็จ (${selectedStockIdsForLink.length} รายการ)`);
  };

  // Auto-sync / import unique tests from current stockItems if missing
  const handleAutoImportFromStock = async () => {
    const existingTestNames = new Set(procurementTargets.map(t => t.testName.trim().toLowerCase()));
    const newTargetsToCreate: ProcurementTarget[] = [];

    // Group current stock by item name
    const groupedByName: Record<string, StockItem[]> = {};
    stockItems.forEach(item => {
      const key = item.name.trim();
      if (!groupedByName[key]) groupedByName[key] = [];
      groupedByName[key].push(item);
    });

    Object.entries(groupedByName).forEach(([name, items]) => {
      if (!existingTestNames.has(name.toLowerCase())) {
        const totalQty = items.reduce((s, i) => s + i.currentQty, 0);
        const avgPrice = items.reduce((s, i) => s + i.pricePerUnit, 0) / (items.length || 1);
        const firstItem = items[0];

        newTargetsToCreate.push({
          id: 'target_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          testName: name,
          sampleGroup: firstItem.sampleGroup || 'Immunology & Blood Bank',
          monthlyTargetQty: Math.max(10, Math.round(totalQty * 1.2)),
          safetyStockQty: Math.max(2, Math.round(totalQty * 0.1)),
          unitName: 'ชุด',
          packSize: 1,
          estimatedPricePerUnit: Math.round(avgPrice),
          supplier: '',
          linkedStockIds: items.map(i => i.id),
          notes: 'สร้างอัตโนมัติจากสต็อกคลัง',
          updatedAt: new Date().toISOString()
        });
      }
    });

    if (newTargetsToCreate.length === 0) {
      showToast('ℹ️ ทุกรายการน้ำยาในคลังปัจจุบันมีอยู่ในแผนการสั่งซื้อเรียบร้อยแล้ว');
      return;
    }

    if (onBatchSaveTargets) {
      await onBatchSaveTargets([...procurementTargets, ...newTargetsToCreate]);
    } else {
      for (const t of newTargetsToCreate) {
        await onSaveTarget(t);
      }
    }
    showToast(`✨ นำเข้าน้ำยาและชุดตรวจจากคลังเพิ่ม ${newTargetsToCreate.length} รายการสำเร็จ!`);
  };

  // Copy order summary to clipboard
  const handleCopyOrderSummary = () => {
    const needOrderItems = aggregatedData.filter(d => d.actualOrderQty > 0);
    if (needOrderItems.length === 0) {
      showToast('ℹ️ ขณะนี้สต็อกเพียงพอทุกรายการ ไม่มีรายการที่ต้องสั่งซื้อ');
      return;
    }

    const dateStr = formatThaiDate(new Date().toISOString());
    let text = `📋 แผนรายการสั่งซื้อน้ำยาและชุดตรวจทางห้องปฏิบัติการ (ประจำเดือนถัดไป)\n`;
    text += `📅 วันที่สรุปแผน: ${dateStr}\n`;
    text += `--------------------------------------------------\n`;
    text += `สรุปรายการที่ต้องสั่งซื้อทั้งหมด: ${needOrderItems.length} รายการ\n`;
    text += `งบประมาณจัดซื้อโดยประมาณ: ${kpis.totalEstimatedBudget.toLocaleString()} บาท\n\n`;

    needOrderItems.forEach((d, idx) => {
      text += `${idx + 1}. ${d.target.testName} (${d.target.sampleGroup})\n`;
      text += `   - เป้าหมายใช้/เดือน: ${d.target.monthlyTargetQty} ${d.target.unitName} (สำรอง +${d.target.safetyStockQty})\n`;
      text += `   - สต็อกคงเหลือในคลังขณะนี้: ${d.currentStock} ${d.target.unitName} (รวม ${d.linkedItems.length} ล็อต)\n`;
      text += `   - 🎯 ปริมาณที่ต้องสั่งซื้อ: ${d.actualOrderQty} ${d.target.unitName}`;
      if (d.target.packSize > 1) {
        text += ` (จำนวน ${d.packsNeeded} กล่อง @ ${d.target.packSize} ${d.target.unitName}/กล่อง)`;
      }
      if (d.pricePerUnit > 0) {
        text += ` | ประมาณราคา: ${d.estimatedCost.toLocaleString()} บาท`;
      }
      if (d.target.supplier) {
        text += ` | ตัวแทน: ${d.target.supplier}`;
      }
      text += `\n\n`;
    });

    text += `--------------------------------------------------\n`;
    text += `* ออกรายงานโดยระบบจัดการคลังและวางแผนสั่งซื้อน้ำยาคลินิกแล็บ`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 คัดลอกรายการสั่งซื้อสำหรับส่ง LINE / Email เรียบร้อยแล้ว!');
    }).catch(() => {
      alert('ไม่สามารถคัดลอกข้อความได้อัตโนมัติ');
    });
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'ชื่อ Test/น้ำยา',
      'กลุ่มงาน',
      'เป้าหมายใช้/เดือน',
      'สต็อกสำรอง (Safety Stock)',
      'ความต้องการรวม',
      'สต็อกคงเหลือปัจจุบัน',
      'จำนวนล็อตที่รวม',
      'ปริมาณที่ต้องสั่งซื้อเดือนหน้า',
      'ขนาดบรรจุ/กล่อง',
      'จำนวนกล่องที่สั่ง',
      'หน่วยนับ',
      'ราคาต่อหน่วย (บาท)',
      'งบประมาณจัดซื้อ (บาท)',
      'สถานะ',
      'ตัวแทนจำหน่าย/ผู้ขาย',
      'หมายเหตุ'
    ];

    const rows = aggregatedData.map(d => [
      `"${d.target.testName.replace(/"/g, '""')}"`,
      `"${d.target.sampleGroup.replace(/"/g, '""')}"`,
      d.target.monthlyTargetQty,
      d.target.safetyStockQty,
      d.totalDemand,
      d.currentStock,
      d.linkedItems.length,
      d.actualOrderQty,
      d.target.packSize,
      d.packsNeeded,
      `"${d.target.unitName}"`,
      d.pricePerUnit,
      d.estimatedCost,
      d.status === 'urgent' ? 'วิกฤต/ต้องสั่งด่วน' : d.status === 'need-order' ? 'ต้องสั่งซื้อเพิ่ม' : 'สต็อกเพียงพอ',
      `"${(d.target.supplier || '').replace(/"/g, '""')}"`,
      `"${(d.target.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lab_procurement_order_plan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📊 ดาวน์โหลดไฟล์ Excel/CSV สำเร็จแล้ว!');
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Alert */}
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-teal-500 flex items-center gap-3 text-xs font-semibold"
        >
          <span>{toastMessage}</span>
        </motion.div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-md border border-teal-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-40 bottom-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full text-xs font-medium tracking-wide">
              <ShoppingCart className="w-3.5 h-3.5" />
              ระบบวางแผนสั่งซื้อน้ำยา & ชุดตรวจอัตโนมัติ (Lab Reagent Procurement)
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>โหมดวางแผนการสั่งซื้อน้ำยาเดือนถัดไป</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              กำหนดเป้าหมายการใช้งานต่อเดือน (Target Monthly Usage) ระบบจะรวมยอดคงเหลือจากสต็อกทุกล็อตที่ตรงกับแต่ละ Test 
              และคำนวณปริมาณที่ต้องสั่งซื้อเดือนหน้าให้โดยอัตโนมัติ ป้องกันปัญหาน้ำยาขาดห้องแล็บ
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleOpenEditModal()}
              className="px-4 py-2.5 bg-teal-500 hover:bg-teal-450 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-900/30 flex items-center gap-2 transition-all cursor-pointer select-none"
            >
              <Plus className="w-4 h-4" />
              เพิ่ม Test ในแผนสั่งซื้อ
            </button>

            <button
              onClick={handleAutoImportFromStock}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-teal-200 border border-teal-450/30 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer select-none"
              title="ดึงรายการน้ำยาที่มีในคลังมาสร้างเป็นเป้าหมายสั่งซื้ออัตโนมัติ"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              ซิงค์น้ำยาจากคลัง
            </button>

            <button
              onClick={handleCopyOrderSummary}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer select-none"
              title="คัดลอกข้อความสรุปสำหรับส่งผู้บริหารหรือร้านค้า"
            >
              <Copy className="w-3.5 h-3.5" />
              คัดลอกรายการ
            </button>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer select-none shadow-sm"
              title="เปิดใบขออนุมัติสั่งซื้อสำหรับพิมพ์เอกสาร"
            >
              <Printer className="w-3.5 h-3.5" />
              พิมพ์ใบขอซื้อ (PO)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* งบประมาณจัดซื้อโดยประมาณ */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">งบประมาณสั่งซื้อเดือนหน้า (ประมาณการ)</span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              ฿{kpis.totalEstimatedBudget.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">บาท</span>
          </div>
          <div className="mt-2 text-[11px] text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            คำนวณจากราคาเฉลี่ยต่อหน่วย
          </div>
        </div>

        {/* รายการที่ต้องสั่งซื้อ */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">รายการที่ต้องสั่งซื้อเพิ่ม</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {kpis.needOrderCount}
            </span>
            <span className="text-xs font-medium text-slate-500">จากทั้งหมด {kpis.totalTests} Test</span>
          </div>
          <div className="mt-2 text-[11px] text-rose-500 font-medium flex items-center gap-1">
            {kpis.urgentCount > 0 ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                มี {kpis.urgentCount} รายการระดับวิกฤต/หมดสต็อก
              </>
            ) : (
              <span className="text-slate-400">ไม่มีรายการวิกฤตเร่งด่วน</span>
            )}
          </div>
        </div>

        {/* จำนวนหน่วยที่ต้องสั่งซื้อรวม */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">ปริมาณที่ต้องจัดซื้อรวม</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {kpis.totalUnitsToOrder.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">หน่วย/ชุดทดสอบ</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            รวมสต็อกสำรองความปลอดภัย (Safety Stock)
          </div>
        </div>

        {/* สต็อกเพียงพอแล้ว */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">สต็อกคงเหลือเพียงพอ</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {kpis.sufficientCount}
            </span>
            <span className="text-xs font-medium text-slate-500">Test (ไม่ต้องสั่งเพิ่ม)</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            มีปริมาณครอบคลุมความต้องการเดือนหน้า
          </div>
        </div>

      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ Test, กลุ่มงาน, หรือ LOT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:text-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sample Group Filter */}
          <div className="min-w-[160px]">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 dark:text-white"
            >
              <option value="">กลุ่มงานทั้งหมด ({sampleGroups.length})</option>
              {sampleGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({aggregatedData.length})
            </button>
            <button
              onClick={() => setStatusFilter('need-order')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'need-order'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              }`}
            >
              <span>ต้องสั่งซื้อ ({kpis.needOrderCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('urgent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'urgent'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
              }`}
            >
              <span>วิกฤต/ขาด ({kpis.urgentCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('sufficient')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'sufficient'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
              }`}
            >
              <span>เพียงพอ ({kpis.sufficientCount})</span>
            </button>
          </div>
        </div>

        {/* CSV Export */}
        <button
          onClick={handleExportCSV}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all select-none cursor-pointer"
          title="ดาวน์โหลดตารางเป็นไฟล์ CSV/Excel"
        >
          <Download className="w-3.5 h-3.5" />
          ส่งออก Excel
        </button>

      </div>

      {/* Main Aggregated Table / Card List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              ตารางวิเคราะห์ความต้องการสั่งซื้อราย Test ({filteredData.length} รายการ)
            </h3>
            <span className="text-xs text-slate-400">
              (รวมยอดจากทุก Lot ในคลังปัจจุบัน)
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            สูตรคำนวณ: ปริมาณที่ต้องซื้อ = (เป้าหมาย/เดือน + สำรอง) - ยอดคงเหลือในสต็อกรวม
          </span>
        </div>

        {filteredData.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <PackageX className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-semibold">ไม่พบข้อมูล Test ตามเงื่อนไขที่ค้นหา</p>
            <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "เพิ่ม Test ในแผนสั่งซื้อ" หรือ "ซิงค์น้ำยาจากคลัง"</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredData.map((item) => {
              const isExpanded = !!expandedTestIds[item.target.id];

              return (
                <div 
                  key={item.target.id}
                  className={`p-5 transition-colors ${
                    item.status === 'urgent' 
                      ? 'bg-rose-50/20 dark:bg-rose-950/10 hover:bg-rose-50/30' 
                      : item.status === 'need-order'
                      ? 'bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-50/30'
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    
                    {/* Test Info */}
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {item.target.sampleGroup}
                        </span>

                        {/* Status Badge */}
                        {item.status === 'urgent' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            วิกฤต/ต้องสั่งด่วน (ขาด {item.actualOrderQty} {item.target.unitName})
                          </span>
                        )}
                        {item.status === 'need-order' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                            <ShoppingCart className="w-3 h-3 text-amber-700" />
                            ต้องสั่งซื้อเพิ่ม (ขาด {item.actualOrderQty} {item.target.unitName})
                          </span>
                        )}
                        {item.status === 'sufficient' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            สต็อกเพียงพอ (คงเหลือพอใช้)
                          </span>
                        )}
                        {item.status === 'surplus' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <ShieldAlert className="w-3 h-3 text-blue-700" />
                            สต็อกสำรองสูง ({item.stockCoveragePercent}% ของเป้าหมาย)
                          </span>
                        )}

                        {item.target.supplier && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {item.target.supplier}
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {item.target.testName}
                      </h4>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-teal-600" />
                          หน่วยนับ: <strong className="text-slate-700 dark:text-slate-200">{item.target.unitName}</strong>
                          {item.target.packSize > 1 && (
                            <span className="text-slate-400">({item.target.packSize} {item.target.unitName}/กล่อง)</span>
                          )}
                        </span>

                        {item.pricePerUnit > 0 && (
                          <span className="flex items-center gap-1">
                            ราคาต่อหน่วย: <strong>฿{item.pricePerUnit.toLocaleString()}</strong>
                          </span>
                        )}

                        {item.totalPastWithdrawn > 0 && (
                          <span className="text-indigo-600 dark:text-indigo-400 text-[11px]">
                            ⚡ ยอดเบิกที่ผ่านมา: {item.totalPastWithdrawn} {item.target.unitName}
                          </span>
                        )}

                        {item.target.notes && (
                          <span className="text-slate-400 italic text-[11px]">
                            📝 {item.target.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Numbers: Target vs Current Stock vs Needed */}
                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 sm:gap-6 bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs min-w-[340px]">
                      
                      {/* เป้าหมายใช้/เดือน */}
                      <div className="text-center px-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">เป้าหมาย/เดือน</span>
                        <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
                          {item.target.monthlyTargetQty}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {item.target.safetyStockQty > 0 ? `+สำรอง ${item.target.safetyStockQty}` : 'ไม่มีสำรอง'}
                        </span>
                      </div>

                      <div className="text-slate-300 dark:text-slate-600 font-light text-lg">−</div>

                      {/* ยอดคงเหลือในสต็อกปัจจุบัน */}
                      <div className="text-center px-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">คงเหลือในสต็อกรวม</span>
                        <div className={`text-base font-black mt-0.5 ${
                          item.currentStock === 0 
                            ? 'text-rose-600' 
                            : item.currentStock < item.target.monthlyTargetQty 
                            ? 'text-amber-600' 
                            : 'text-emerald-600'
                        }`}>
                          {item.currentStock} <span className="text-[10px] font-normal text-slate-500">{item.target.unitName}</span>
                        </div>
                        <button
                          onClick={() => toggleExpand(item.target.id)}
                          className="text-[10px] text-teal-600 hover:text-teal-700 hover:underline font-semibold flex items-center justify-center gap-0.5 mx-auto mt-0.5 cursor-pointer select-none"
                        >
                          <span>{item.linkedItems.length} ล็อต</span>
                          {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                        </button>
                      </div>

                      <div className="text-slate-300 dark:text-slate-600 font-light text-lg">=</div>

                      {/* ปริมาณที่ต้องซื้อเดือนหน้า */}
                      <div className="text-center px-3 py-1 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700 min-w-[100px]">
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                          ต้องสั่งซื้อเดือนหน้า
                        </span>
                        <div className={`text-base font-black mt-0.5 ${
                          item.actualOrderQty > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                        }`}>
                          {item.actualOrderQty > 0 ? (
                            <span>{item.actualOrderQty} <span className="text-[10px] font-normal">{item.target.unitName}</span></span>
                          ) : (
                            <span className="text-emerald-600 text-xs font-bold">0 (เพียงพอ)</span>
                          )}
                        </div>
                        {item.actualOrderQty > 0 && item.target.packSize > 1 && (
                          <span className="text-[10px] text-indigo-600 font-semibold block">
                            ({item.packsNeeded} กล่อง)
                          </span>
                        )}
                        {item.estimatedCost > 0 && (
                          <span className="text-[10px] text-slate-400 block font-medium">
                            ~฿{item.estimatedCost.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Action Menu */}
                      <div className="flex items-center gap-1 border-l border-slate-100 dark:border-slate-700 pl-2">
                        <button
                          onClick={() => handleOpenLinkModal(item.target)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="จัดการเลือกล็อตสต็อกที่นำมารวมใน Test นี้"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(item.target)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="แก้ไขเป้าหมายการใช้งาน"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setTargetToDelete(item.target)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="ลบออกจากแผน"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>

                  </div>

                  {/* Accordion: Breakdown of linked Stock Items / LOTs */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/80 overflow-hidden"
                      >
                        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-teal-600" />
                              แจกแจงรายการสต็อกและล็อต (LOT Breakdown) ที่ถูกนับรวมใน Test นี้:
                            </h5>
                            <button
                              onClick={() => handleOpenLinkModal(item.target)}
                              className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <Link2 className="w-3 h-3" />
                              เลือกหรือเพิ่มสต็อกอื่นเข้ามานับรวม
                            </button>
                          </div>

                          {item.linkedItems.length === 0 ? (
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-400 text-center border border-dashed border-slate-200">
                              ยังไม่มีรายการน้ำยาในสต็อกปัจจุบันเชื่อมโยงกับ Test นี้ (ระบบจะคำนวณยอดคงเหลือ = 0)
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                              {item.linkedItems.map(li => (
                                <div 
                                  key={li.id}
                                  className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shadow-2xs"
                                >
                                  <div>
                                    <div className="font-bold text-slate-800 dark:text-slate-200">
                                      LOT: {li.lot}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      หมดอายุ: {formatThaiDate(li.expiryDate)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-black text-teal-600 text-sm">
                                      {li.currentQty}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block">
                                      / {li.initialQty} ชุด
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Modal: Add/Edit Procurement Target */}
      <AnimatePresence>
        {isEditModalOpen && editingTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-teal-600" />
                  {editingTarget.id?.startsWith('target_') ? 'ตั้งค่าเป้าหมายการสั่งซื้อ Test ใหม่' : 'แก้ไขเป้าหมายการสั่งซื้อ'}
                </h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                
                {/* ชื่อ Test */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อ Test / ชื่อน้ำยาตรวจวิเคราะห์ *
                  </label>
                  <input
                    type="text"
                    value={editingTarget.testName || ''}
                    onChange={(e) => setEditingTarget({ ...editingTarget, testName: e.target.value })}
                    placeholder="เช่น Anti-A Reagent, Urine Strip 10 Parameters, CBC Diluent"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 dark:text-white"
                  />
                </div>

                {/* กลุ่มงาน & หน่วยนับ */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      กลุ่มงานทางแล็บ
                    </label>
                    <select
                      value={editingTarget.sampleGroup || sampleGroups[0]}
                      onChange={(e) => setEditingTarget({ ...editingTarget, sampleGroup: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                    >
                      {sampleGroups.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      หน่วยนับ
                    </label>
                    <input
                      type="text"
                      value={editingTarget.unitName || 'ชุด'}
                      onChange={(e) => setEditingTarget({ ...editingTarget, unitName: e.target.value })}
                      placeholder="เช่น ชุด, กล่อง, แถบ, ขวด"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                    />
                  </div>
                </div>

                {/* ปริมาณเป้าหมายต่อเดือน & สำรองฉุกเฉิน */}
                <div className="grid grid-cols-2 gap-3 bg-teal-50/50 dark:bg-teal-950/20 p-3.5 rounded-xl border border-teal-100 dark:border-teal-900/40">
                  <div>
                    <label className="block text-xs font-bold text-teal-900 dark:text-teal-200 mb-1">
                      เป้าหมายความต้องการ/เดือน *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingTarget.monthlyTargetQty ?? 50}
                      onChange={(e) => setEditingTarget({ ...editingTarget, monthlyTargetQty: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 rounded-lg text-xs font-bold text-teal-700 dark:text-teal-300"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">ปริมาณที่คาดว่าจะใช้ใน 1 เดือน</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-teal-900 dark:text-teal-200 mb-1">
                      สต็อกสำรอง (Safety Buffer)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingTarget.safetyStockQty ?? 5}
                      onChange={(e) => setEditingTarget({ ...editingTarget, safetyStockQty: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 rounded-lg text-xs font-bold text-teal-700 dark:text-teal-300"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">สำรองกันกรณีแล็บมีเคสด่วน</span>
                  </div>
                </div>

                {/* ขนาดบรรจุต่อกล่อง & ราคาต่อหน่วย */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ขนาดบรรจุต่อกล่อง/แพ็ค
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingTarget.packSize ?? 1}
                      onChange={(e) => setEditingTarget({ ...editingTarget, packSize: Number(e.target.value) })}
                      placeholder="เช่น 25 ชุด/กล่อง"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">ช่วยคำนวณจำนวนกล่องที่ต้องสั่ง</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ราคาเฉลี่ยต่อหน่วย (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingTarget.estimatedPricePerUnit ?? 0}
                      onChange={(e) => setEditingTarget({ ...editingTarget, estimatedPricePerUnit: Number(e.target.value) })}
                      placeholder="เช่น 250"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                    />
                  </div>
                </div>

                {/* บริษัทตัวแทนจำหน่าย */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    บริษัทคู่ค้า / ตัวแทนจำหน่าย (Supplier)
                  </label>
                  <input
                    type="text"
                    value={editingTarget.supplier || ''}
                    onChange={(e) => setEditingTarget({ ...editingTarget, supplier: e.target.value })}
                    placeholder="เช่น BioLab Supply Thailand, MedDiagnostic"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                  />
                </div>

                {/* หมายเหตุ */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    หมายเหตุเพิ่มเติม
                  </label>
                  <input
                    type="text"
                    value={editingTarget.notes || ''}
                    onChange={(e) => setEditingTarget({ ...editingTarget, notes: e.target.value })}
                    placeholder="เช่น ต้องสั่งล่วงหน้า 5 วันทำการ, เก็บที่ 2-8°C"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                  />
                </div>

              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  {editingTarget.id && !editingTarget.id.startsWith('target_') && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentT = procurementTargets.find(t => t.id === editingTarget.id);
                        if (currentT) {
                          setIsEditModalOpen(false);
                          setTargetToDelete(currentT);
                        }
                      }}
                      className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      ลบรายการนี้
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveModal}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
                  >
                    บันทึกเป้าหมายสั่งซื้อ
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Link / Consolidate Multiple Stock Items into a Test */}
      <AnimatePresence>
        {isLinkStockModalOpen && targetForLinking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-teal-600" />
                    เลือกรวมสต็อกเข้าสู่ Test: "{targetForLinking.testName}"
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    ติ๊กเลือกรายการสต็อก/LOTs ที่ต้องการให้ระบบรวมยอดคงเหลือเข้ามาร่วมคำนวณใน Test นี้
                  </p>
                </div>
                <button
                  onClick={() => setIsLinkStockModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                  <span>เลือกแล้ว <strong>{selectedStockIdsForLink.length}</strong> รายการ</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStockIdsForLink(stockItems.map(s => s.id))}
                      className="text-teal-600 hover:underline font-semibold text-[11px]"
                    >
                      เลือกทั้งหมด
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedStockIdsForLink([])}
                      className="text-rose-600 hover:underline font-semibold text-[11px]"
                    >
                      ยกเลิกทั้งหมด
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {stockItems.map(item => {
                    const isSelected = selectedStockIdsForLink.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStockIdsForLink(selectedStockIdsForLink.filter(id => id !== item.id));
                          } else {
                            setSelectedStockIdsForLink([...selectedStockIdsForLink, item.id]);
                          }
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700 shadow-xs'
                            : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div
                            className="w-4 h-4 text-teal-600 rounded-md border-slate-300 pointer-events-none"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>LOT: <strong>{item.lot}</strong></span>
                              <span>•</span>
                              <span>กลุ่ม: {item.sampleGroup}</span>
                              <span>•</span>
                              <span>หมดอายุ: {formatThaiDate(item.expiryDate)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-teal-600">
                            {item.currentQty}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            ชุดคงเหลือ
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  ยอดคงเหลือรวมที่เลือก: <strong className="text-teal-600 font-bold">
                    {stockItems.filter(i => selectedStockIdsForLink.includes(i.id)).reduce((s, i) => s + i.currentQty, 0)}
                  </strong> ชุด
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLinkStockModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 rounded-xl"
                  >
                    ปิด
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveLinkedStocks}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
                  >
                    บันทึกการรวมสต็อก
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Printable PO Form (ใบขออนุมัติสั่งซื้อน้ำยาและเวชภัณฑ์ห้องแล็บ) */}
      <AnimatePresence>
        {isPrintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs print-po-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden print-po-modal-container"
            >
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-100 print-po-modal-header print-hidden">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  <span className="font-bold text-sm">ตัวอย่างเอกสารใบขอจัดซื้อน้ำยาแล็บ (Purchase Order Preview)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    สั่งพิมพ์เอกสาร (Print)
                  </button>
                  <button
                    onClick={() => setIsPrintModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Content */}
              <div className="p-6 md:p-8 overflow-y-auto flex-1 text-slate-900 font-sans space-y-4 print:space-y-3 print:p-0 print-po-paper">
                
                {/* Header */}
                <div className="text-center border-b-2 border-slate-800 pb-3 print:pb-2">
                  <h2 className="text-lg md:text-xl font-bold uppercase tracking-wide print:text-base">
                    ใบขออนุมัติสั่งซื้อน้ำยาและชุดตรวจวิเคราะห์ทางห้องปฏิบัติการ
                  </h2>
                  <h3 className="text-xs md:text-sm font-semibold text-slate-600 mt-0.5 print:text-xs">
                    BK Lab Plus
                  </h3>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2 print:text-[10px]">
                    <span>เลขที่เอกสาร: PO-{new Date().getFullYear() + 543}-{String(new Date().getMonth() + 1).padStart(2, '0')}-001</span>
                    <span>วันที่จัดทำ: {formatThaiDate(new Date().toISOString())}</span>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs print:text-[10px] border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 print:bg-slate-200 text-slate-800 font-bold">
                        <th className="border border-slate-300 print:border-slate-500 p-1.5 text-center w-8">ลำดับ</th>
                        <th className="border border-slate-300 print:border-slate-500 p-1.5 text-left">รายการ Test / น้ำยาตรวจ</th>
                        <th className="border border-slate-300 print:border-slate-500 p-1.5 text-center">กลุ่มงาน</th>
                        <th className="border border-slate-300 print:border-slate-500 p-1.5 text-center">เป้าหมาย/ด.</th>
                        <th className="border border-slate-300 print:border-slate-500 p-1.5 text-center">คงเหลือ</th>
                        <th className="border border-slate-300 print:border-slate-500 p-1.5 text-center">จำนวนขอซื้อ</th>
                        <th className="border border-slate-300 print:border-slate-500 p-1.5 text-center">หน่วยนับ</th>
                        <th className="border border-slate-300 print:border-slate-500 p-1.5 text-right">ราคา/หน่วย (฿)</th>
                        <th className="border border-slate-300 print:border-slate-500 p-1.5 text-right">รวมเงิน (฿)</th>
                        <th className="border border-slate-300 print:border-slate-500 p-1.5 text-left">ผู้จัดจำหน่าย</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregatedData.filter(d => d.actualOrderQty > 0).map((item, idx) => (
                        <tr key={item.target.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50 print:bg-white'}>
                          <td className="border border-slate-300 print:border-slate-500 p-1.5 text-center font-bold">{idx + 1}</td>
                          <td className="border border-slate-300 print:border-slate-500 p-1.5 font-semibold">{item.target.testName}</td>
                          <td className="border border-slate-300 print:border-slate-500 p-1.5 text-center">{item.target.sampleGroup}</td>
                          <td className="border border-slate-300 print:border-slate-500 p-1.5 text-center">{item.target.monthlyTargetQty}</td>
                          <td className="border border-slate-300 print:border-slate-500 p-1.5 text-center">{item.currentStock}</td>
                          <td className="border border-slate-300 print:border-slate-500 p-1.5 text-center font-bold text-indigo-700 print:text-black">{item.actualOrderQty}</td>
                          <td className="border border-slate-300 print:border-slate-500 p-1.5 text-center">{item.target.unitName}</td>
                          <td className="border border-slate-300 print:border-slate-500 p-1.5 text-right">{item.pricePerUnit.toLocaleString()}</td>
                          <td className="border border-slate-300 print:border-slate-500 p-1.5 text-right font-bold">{item.estimatedCost.toLocaleString()}</td>
                          <td className="border border-slate-300 print:border-slate-500 p-1.5 text-slate-600 print:text-black">{item.target.supplier || '-'}</td>
                        </tr>
                      ))}
                      {aggregatedData.filter(d => d.actualOrderQty > 0).length === 0 && (
                        <tr>
                          <td colSpan={10} className="border border-slate-300 print:border-slate-500 p-4 text-center text-slate-400">
                            ไม่มีรายการที่ต้องสั่งซื้อ (สต็อกปัจจุบันเพียงพอทุกรายการ)
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 print:bg-slate-200 font-bold text-slate-900">
                        <td colSpan={5} className="border border-slate-300 print:border-slate-500 p-1.5 text-right">
                          รวมทั้งสิ้น ({aggregatedData.filter(d => d.actualOrderQty > 0).length} รายการ):
                        </td>
                        <td className="border border-slate-300 print:border-slate-500 p-1.5 text-center font-black text-indigo-700 print:text-black">
                          {kpis.totalUnitsToOrder.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 print:border-slate-500 p-1.5 text-center">หน่วย</td>
                        <td className="border border-slate-300 print:border-slate-500 p-1.5 text-right">งบประมาณรวม:</td>
                        <td className="border border-slate-300 print:border-slate-500 p-1.5 text-right font-black text-slate-900">
                          ฿{kpis.totalEstimatedBudget.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 print:border-slate-500 p-1.5"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Signature Lines */}
                <div className="grid grid-cols-3 gap-4 pt-4 print:pt-6 text-center text-xs print:text-[10px] signature-block">
                  <div className="space-y-6 print:space-y-6">
                    <p className="font-semibold text-slate-700">ผู้จัดทำคำขอซื้อ (นักเทคนิคการแพทย์)</p>
                    <div>
                      <p className="border-b border-dotted border-slate-400 w-4/5 mx-auto pb-1"></p>
                      <p className="text-[11px] print:text-[9.5px] text-slate-500 mt-1">(.........................................................)</p>
                      <p className="text-[10px] print:text-[9px] text-slate-400 mt-0.5">วันที่ ......../......../............</p>
                    </div>
                  </div>

                  <div className="space-y-6 print:space-y-6">
                    <p className="font-semibold text-slate-700">ผู้ตรวจสอบความต้องการคลัง</p>
                    <div>
                      <p className="border-b border-dotted border-slate-400 w-4/5 mx-auto pb-1"></p>
                      <p className="text-[11px] print:text-[9.5px] text-slate-500 mt-1">(.........................................................)</p>
                      <p className="text-[10px] print:text-[9px] text-slate-400 mt-0.5">วันที่ ......../......../............</p>
                    </div>
                  </div>

                  <div className="space-y-6 print:space-y-6">
                    <p className="font-semibold text-slate-700">ผู้อนุมัติการจัดซื้อ (หัวหน้าห้องปฏิบัติการ)</p>
                    <div>
                      <p className="border-b border-dotted border-slate-400 w-4/5 mx-auto pb-1"></p>
                      <p className="text-[11px] print:text-[9.5px] text-slate-500 mt-1">(.........................................................)</p>
                      <p className="text-[10px] print:text-[9px] text-slate-400 mt-0.5">วันที่ ......../......../............</p>
                    </div>
                  </div>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Confirm Delete Target */}
      <AnimatePresence>
        {targetToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100 dark:border-rose-900 shadow-xs">
                  <Trash2 className="w-7 h-7" />
                </div>
                
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ยืนยันการลบเป้าหมายการสั่งซื้อ
                </h3>
                
                <div className="my-3.5 p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 text-left">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {targetToDelete.testName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-2">
                    <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                      {targetToDelete.sampleGroup}
                    </span>
                    <span>
                      เป้าหมาย: <strong>{targetToDelete.monthlyTargetQty} {targetToDelete.unitName}/เดือน</strong>
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  คุณต้องการลบเป้าหมายนี้ออกจากแผนการจัดซื้อใช่หรือไม่? <br />
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    (รายการสต็อกคงเหลือและประวัติการเบิกในคลังจะไม่ถูกลบ)
                  </span>
                </p>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetToDelete(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const id = targetToDelete.id;
                      const name = targetToDelete.testName;
                      setTargetToDelete(null);
                      await onDeleteTarget(id);
                      showToast(`🗑️ ลบเป้าหมาย "${name}" ออกจากแผนเรียบร้อยแล้ว`);
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    ยืนยันการลบ
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
