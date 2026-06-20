import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, Calendar, AlertTriangle, CheckCircle2, AlertCircle, 
  Sparkles, Filter, Database, BarChart3, ChevronRight, ShoppingCart, ShieldAlert,
  Printer, FileDown, Activity
} from 'lucide-react';
import { StockItem, WithdrawalLog } from '../types';
import { formatThaiDate } from '../utils';

interface StatsPanelProps {
  stockItems: StockItem[];
  logs: WithdrawalLog[];
}

type PeriodType = '1m' | '3m' | '6m' | '1y';

export default function StatsPanel({ stockItems, logs }: StatsPanelProps) {
  const [period, setPeriod] = useState<PeriodType>('3m');
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // ฟิลเตอร์สเตตสำหรับกราฟแท่งความต้องการใช้น้ำยารายปี
  const [selectedChartTest, setSelectedChartTest] = useState<string>('');
  const [selectedChartYear, setSelectedChartYear] = useState<number>(2026);

  // หาทุกรายการตรวจหลักที่มีสะสมเพื่อเป็นหัวข้อเลือกในกราฟ
  const allTestNames = useMemo(() => {
    return Array.from(new Set(stockItems.map(item => item.name.trim()))).filter(Boolean);
  }, [stockItems]);

  // ดึงปีที่เป็นไปได้ทั้งหมดจากสถิติหรือใช้ค่าดีฟอลต์ (ค.ศ. 2026 เป็นหลัก)
  const availableYears = useMemo(() => {
    const years = logs.map(log => new Date(log.withdrawDate).getFullYear());
    years.push(2026);
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }, [logs]);

  // ตั้งค่าเริ่มต้นของชื่อยาเมื่อตรวจพบรายการตรวจ
  useEffect(() => {
    if (!selectedChartTest && allTestNames.length > 0) {
      setSelectedChartTest(allTestNames[0]);
    }
  }, [allTestNames, selectedChartTest]);

  // ดึงหมวดหมู่กลุ่มตัวอย่างทั้งหมด
  const sampleGroups = useMemo(() => {
    const groups = stockItems.map(item => item.sampleGroup);
    return Array.from(new Set(groups)).filter(Boolean);
  }, [stockItems]);

  // หาวันที่ย้อนหลังสำหรับฟิลเตอร์
  const filterDateThreshold = useMemo(() => {
    // อิงตามเวลาจำลองในระบบ 2026-06-19
    const baseDate = new Date('2026-06-19T07:46:13');
    const targetDate = new Date(baseDate);
    
    if (period === '1m') targetDate.setDate(baseDate.getDate() - 30);
    else if (period === '3m') targetDate.setDate(baseDate.getDate() - 90);
    else if (period === '6m') targetDate.setDate(baseDate.getDate() - 180);
    else if (period === '1y') targetDate.setDate(baseDate.getDate() - 365);
    
    return targetDate;
  }, [period]);

  // กรอง Log ตามช่วงเวลาและกลุ่มตัวอย่าง
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const logDate = new Date(log.withdrawDate);
      const matchesPeriod = logDate >= filterDateThreshold;
      const matchesGroup = !selectedGroup || log.sampleGroup === selectedGroup;
      return matchesPeriod && matchesGroup;
    });
  }, [logs, filterDateThreshold, selectedGroup]);

  // 1. สถิติภาพรวม: ยอดเบิกสะสม
  const totalWithdrawnQty = useMemo(() => {
    return filteredLogs.reduce((sum, log) => sum + log.withdrawQty, 0);
  }, [filteredLogs]);

  // 2. จัดอันดับการใช้น้ำยา/อุปกรณ์ (Leaderboard)
  const reagentUsageLeaderboard = useMemo(() => {
    const usageMap: { [name: string]: { name: string; group: string; qty: number; count: number } } = {};
    
    filteredLogs.forEach(log => {
      const key = log.itemName.trim();
      if (!usageMap[key]) {
        usageMap[key] = {
          name: log.itemName,
          group: log.sampleGroup,
          qty: 0,
          count: 0
        };
      }
      usageMap[key].qty += log.withdrawQty;
      usageMap[key].count += 1;
    });

    return Object.values(usageMap).sort((a, b) => b.qty - a.qty);
  }, [filteredLogs]);

  // 3. วิเคราะห์ความถี่การใช้ตามกลุ่มตัวอย่าง (Sample Group distribution)
  const groupDistribution = useMemo(() => {
    const distMap: { [group: string]: number } = {};
    filteredLogs.forEach(log => {
      distMap[log.sampleGroup] = (distMap[log.sampleGroup] || 0) + log.withdrawQty;
    });
    return Object.entries(distMap)
      .map(([group, qty]) => ({ group, qty }))
      .sort((a, b) => b.qty - a.qty);
  }, [filteredLogs]);

  // 4. หายอดสต็อกคงเหลือปัจจุบันของแต่ละชื่อตรวจสารเคมีแบบ Grouped by Name เพื่อคำนวณอัตราความเสี่ยงขาดสต็อก
  const itemCurrentStockByName = useMemo(() => {
    const stockMap: { [name: string]: number } = {};
    stockItems.forEach(item => {
      const key = item.name.trim();
      stockMap[key] = (stockMap[key] || 0) + item.currentQty;
    });
    return stockMap;
  }, [stockItems]);

  // 5. ประเมินความเสี่ยงของขาดคลัง (Stockout Risk Analysis)
  // คำนวณหาปริมาตรการใช้เฉลี่ยรายเดือนของแต่ละไอเทม เพื่อประเมินว่าจะหมดภายในกี่วัน
  const stockoutRiskAnalysis = useMemo(() => {
    const periodInMonths = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : 12;
    
    return Object.keys(itemCurrentStockByName).map(name => {
      // หาปริมาณการเบิกใช้ของกลุ่มนี้ในช่วงเวลาที่เลือก
      const usageInPeriod = reagentUsageLeaderboard.find(u => u.name.trim() === name.trim())?.qty || 0;
      const avgMonthlyUsage = usageInPeriod / periodInMonths;
      const currentStock = itemCurrentStockByName[name] || 0;
      const correspondingItem = stockItems.find(item => item.name.trim() === name.trim());
      const group = correspondingItem?.sampleGroup || 'ไม่ระบุ';

      let daysOfInventory = Infinity;
      let riskLevel: 'critical' | 'warn' | 'safe' | 'no-usage' = 'safe';
      let riskText = 'ปลอดภัย';
      let colorClass = 'text-teal-600 bg-teal-50 border-teal-200';

      if (avgMonthlyUsage > 0) {
        // คำนวณเป็นวันคงพะวง (เฉลี่ย 1 เดือน = 30 วัน)
        const monthsLeft = currentStock / avgMonthlyUsage;
        daysOfInventory = Math.round(monthsLeft * 30);
        
        if (daysOfInventory <= 15) {
          riskLevel = 'critical';
          riskText = '🚨 วิกฤต! (ของหมดภายใน 15 วัน)';
          colorClass = 'text-rose-600 bg-rose-50 border-rose-200 animate-pulse';
        } else if (daysOfInventory <= 30) {
          riskLevel = 'warn';
          riskText = '⚠️ เตือน! (ของหมดภายใน 30 วัน)';
          colorClass = 'text-amber-600 bg-amber-50 border-amber-200';
        } else {
          riskLevel = 'safe';
          riskText = `ปลอดภัย (เหลือใช้ได้ประมาณ ${daysOfInventory} วัน)`;
          colorClass = 'text-teal-600 bg-teal-50 border-teal-100';
        }
      } else {
        riskLevel = 'no-usage';
        riskText = currentStock === 0 ? '❌ หมดสต็อก และไม่มีการใช้' : '💤 สต็อกคงค้าง (ยังไม่มีการเบิกใช้)';
        colorClass = currentStock === 0 ? 'text-slate-500 bg-slate-100 border-slate-200' : 'text-slate-600 bg-slate-100 border-slate-200';
      }

      return {
        name,
        group,
        currentStock,
        avgMonthlyUsage,
        daysOfInventory,
        riskLevel,
        riskText,
        colorClass
      };
    }).sort((a, b) => {
      // เรียงความเสี่ยงพะวงอันตรายขึ้นก่อน
      const score = { 'critical': 4, 'warn': 3, 'no-usage': 2, 'safe': 1 };
      const scoreA = score[a.riskLevel] || 0;
      const scoreB = score[b.riskLevel] || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.daysOfInventory - b.daysOfInventory;
    });
  }, [itemCurrentStockByName, reagentUsageLeaderboard, period, stockItems]);

  // คำนวณหาค่าเฉลี่ย 3 เดือน, 6 เดือน, และ 1 ปี (12 ด.) ของชื่อผลิตภัณฑ์เดียวกัน เพื่อเปรียบเทียบตามคำขอ
  const averagesByName = useMemo(() => {
    const baseDate = new Date('2026-06-19T07:46:13');
    const cut3m = new Date(baseDate); cut3m.setDate(baseDate.getDate() - 90);
    const cut6m = new Date(baseDate); cut6m.setDate(baseDate.getDate() - 180);
    const cut1y = new Date(baseDate); cut1y.setDate(baseDate.getDate() - 365);

    const nameMap: { 
      [name: string]: { 
        qty3m: number; 
        qty6m: number; 
        qty1y: number;
      } 
    } = {};

    // ดึงชื่อผลิตภัณฑ์ทั้งหมดที่มีในระบบ หรือในประวัติเบิก
    const distinctNames = Array.from(new Set([
      ...stockItems.map(item => item.name.trim()),
      ...logs.map(log => log.itemName.trim())
    ]));

    distinctNames.forEach(name => {
      nameMap[name] = { qty3m: 0, qty6m: 0, qty1y: 0 };
    });

    logs.forEach(log => {
      const logName = log.itemName.trim();
      const logDate = new Date(log.withdrawDate);
      
      if (nameMap[logName] !== undefined) {
        if (logDate >= cut3m) {
          nameMap[logName].qty3m += log.withdrawQty;
        }
        if (logDate >= cut6m) {
          nameMap[logName].qty6m += log.withdrawQty;
        }
        if (logDate >= cut1y) {
          nameMap[logName].qty1y += log.withdrawQty;
        }
      }
    });

    const result: { 
      [name: string]: { 
        avg3m: number; 
        avg6m: number; 
        avg1y: number; 
      } 
    } = {};

    distinctNames.forEach(name => {
      result[name] = {
        avg3m: nameMap[name].qty3m / 3,
        avg6m: nameMap[name].qty6m / 6,
        avg1y: nameMap[name].qty1y / 12,
      };
    });

    return result;
  }, [logs, stockItems]);

  // คำนวณรวบรวมสถิติรายเดือน (12 เดือน) ของชื่อผลิตภัณฑ์ที่สืบค้น เพื่อนำไปวาดชาร์ตรายปี
  const monthlyDataForChart = useMemo(() => {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const fullMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    
    const data = Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i,
      monthName: months[i],
      fullName: fullMonths[i],
      qty: 0,
      count: 0
    }));

    if (!selectedChartTest) return data;

    logs.forEach(log => {
      const logDate = new Date(log.withdrawDate);
      const isSameYear = logDate.getFullYear() === selectedChartYear;
      const isSameTest = log.itemName.trim().toLowerCase() === selectedChartTest.trim().toLowerCase();

      if (isSameYear && isSameTest) {
        const monthNum = logDate.getMonth(); // 0-11
        if (monthNum >= 0 && monthNum <= 11) {
          data[monthNum].qty += log.withdrawQty;
          data[monthNum].count += 1;
        }
      }
    });

    return data;
  }, [selectedChartTest, selectedChartYear, logs]);

  const maxMonthlyQty = useMemo(() => {
    const values = monthlyDataForChart.map(m => m.qty);
    const maxVal = Math.max(...values);
    return maxVal === 0 ? 10 : maxVal;
  }, [monthlyDataForChart]);

  const maxUsageQty = useMemo(() => {
    if (reagentUsageLeaderboard.length === 0) return 1;
    return Math.max(...reagentUsageLeaderboard.map(u => u.qty));
  }, [reagentUsageLeaderboard]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* ส่วนหัวแดชบอร์ดสถิติ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 overflow-hidden relative">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-teal-600/5 rounded-full blur-2xl"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-full border border-teal-100 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                สต็อกอัจฉริยะ (Forecasting Module)
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              📊 ศูนย์ข้อมูลสถิติ & ประเมินการใช้น้ำยาตรวจอย่างยั่งยืน
            </h2>
            <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
              วิเคราะห์ประวัติการเบิกออกไปใช้ตามรอบเวลา ประเมินเฉลี่ยความถี่ และส่งสัญญาณความเสี่ยงล่วงหน้าเพื่อปิดความเสี่ยงขาดแคลนสารเคมีแล็บ
            </p>
          </div>

          {/* แถบฟิลเตอร์ความกว้างของช่วงเวลา ร่วมกับ ปุ่มออกรายงาน PDF */}
          <div className="flex flex-col sm:flex-row md:items-center gap-3 no-print">
            <div className="flex flex-wrap gap-1.5 items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700">
              <button
                onClick={() => setPeriod('1m')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  period === '1m'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                รายเดือน
              </button>
              <button
                onClick={() => setPeriod('3m')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  period === '3m'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                3 เดือน
              </button>
              <button
                onClick={() => setPeriod('6m')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  period === '6m'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                6 เดือน
              </button>
              <button
                onClick={() => setPeriod('1y')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  period === '1y'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                รายปี
              </button>
            </div>

            <button
              onClick={() => {
                window.print();
              }}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white dark:text-slate-950 dark:bg-teal-400 dark:hover:bg-teal-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer select-none"
              title="สั่งพิมพ์รายงานหน้าสถิติปัจจุบันออกคลังเป็นแบบแผนประเมิน PDF"
            >
              <Printer className="w-4 h-4 text-current" />
              <span>พิมพ์รายงาน / บันทึก PDF 📝</span>
            </button>
          </div>
        </div>

        {/* CSS สไตล์ลิ่งพิเศษสำหรับการแปลงไฟล์ PDF / การจัดหน้ากระดาษเอสี่ */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            header, footer, nav, .no-print, button, select {
              display: none !important;
            }
            .space-y-8 {
              margin-top: 0px !important;
              gap: 15px !important;
            }
            /* จัดขอบหน้าพิมพ์ให้สวยงามสำหรับใบรายงานแพทย์ */
            @page {
              size: A4 portrait;
              margin: 15mm 15mm 15mm 15mm;
            }
            .print-card {
              border: 1px solid #cbd5e1 !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
              page-break-inside: avoid !important;
              border-radius: 12px !important;
              padding: 16px !important;
            }
            .print-text-dark {
              color: #0f172a !important;
            }
          }
        `}} />

        {/* จุดคัดกรองตามแผนกแล็บ */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" /> กองคัดกรองตามหมวดหมู่ตัวอย่าง:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedGroup('')}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                selectedGroup === ''
                  ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700 dark:border-slate-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
              }`}
            >
              ทั้งหมด
            </button>
            {sampleGroups.map(group => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                  selectedGroup === group
                    ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700 dark:border-slate-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* บล็อกสถิติสรุปตัวเลขเด่น (Dashboard Indicators) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">จำนวนเบิกใช้รวม</span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-200">{totalWithdrawnQty.toLocaleString('th-TH')} ชุด</span>
            <span className="text-[10px] text-slate-500 block">ในช่วง {period === '1m' ? '30' : period === '3m' ? '90' : period === '6m' ? '180' : '365'} วันที่ผ่านมา</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">สารตรวจที่ใช้จริง</span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-200">{reagentUsageLeaderboard.length} ชนิด</span>
            <span className="text-[10px] text-slate-500 block">จากน้ำยาทั้งหมดในคลังแล็บ</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-amber-50 dark:bg-amber-900/10 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">รายการวิกฤตความเสี่ยงสูง</span>
            <span className="text-2xl font-black text-rose-600">
              {stockoutRiskAnalysis.filter(r => r.riskLevel === 'critical').length} รายการ
            </span>
            <span className="text-[10px] text-slate-500 block">ต้องการสั่งนำเข้าคลังด่วนที่สุด</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">ปลอดภัยในการดูแล</span>
            <span className="text-2xl font-black text-emerald-600">
              {stockoutRiskAnalysis.filter(r => r.riskLevel === 'safe').length} รายการ
            </span>
            <span className="text-[10px] text-slate-500 block">มีระยะสต็อกใช้งานเกิน 30 วัน</span>
          </div>
        </div>

      </div>

      {/* ท่อน 1: สถิติอันดับสารเคมีที่มีการเบิกใช้อย่างหนัก (Leaderboard Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* คาราวานชาร์ตแสดงอันดับความต้องการใช้ */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm lg:col-span-12">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-600" />
              <h3 className="font-black text-slate-850 dark:text-slate-100 text-lg">
                🏆 อันดับปริมาณการใช้สารเคมีและน้ำยาทางการแพทย์สูงสุด
              </h3>
            </div>
            <span className="text-xs text-slate-400">เปรียบเทียบตามปริมาณจำนวนที่เบิกใช้จริง</span>
          </div>

          {reagentUsageLeaderboard.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-semibold text-sm">ยังไม่มีความต้องการใช้งานเบิกจ่ายบันทึกอยู่ในประวัติตามเงื่อนไขปัจจุบัน</p>
              <p className="text-xs text-slate-400 mt-1">ลองสลับเงื่อนไขเวลา หรือเริ่มบันทึกเบิกของในหน้าแรก</p>
            </div>
          ) : (
            <div className="space-y-5">
              {reagentUsageLeaderboard.slice(0, 10).map((unit, index) => {
                const percentage = Math.round((unit.qty / totalWithdrawnQty) * 100);
                const widthPercent = `${(unit.qty / maxUsageQty) * 100}%`;
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-start text-xs">
                      <div className="flex gap-2 items-center">
                        <span className="w-5 h-5 flex items-center justify-center bg-teal-500/10 text-teal-700 dark:text-teal-400 font-bold rounded-lg text-[10px] border border-teal-500/20">
                          {index + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                            {unit.name}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-2 bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-md">
                            {unit.group}
                          </span>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-extrabold text-teal-600 text-sm">{unit.qty} ชุด</span>{' '}
                        <span className="text-slate-400">({percentage}%)</span>
                      </div>
                    </div>
                    {/* แถบกราฟความก้าวหน้า (Custom Tailwind visual progress bar) */}
                    <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: widthPercent }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="h-full bg-linear-to-r from-teal-500 to-indigo-600 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* คาร์ดกราฟแท่งแนวโน้มความต้องการใช้น้ำยาตรวจรายปี (Interactive Annual Bar Chart) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm lg:col-span-12 print-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-black text-slate-850 dark:text-slate-100 text-lg">
                  📊 วิเคราะห์สถิติมุมมองรายปี (Interactive Annual Bar Chart)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  แท่งกราฟรายงานความถี่และการใช้น้ำยาตรวจประจำปี (จำแนกตามรายชื่อตรวจ เดือน ม.ค. - ธ.ค. แกน Y: จำนวนเบิกใช้)
                </p>
              </div>
            </div>
            
            {/* ฟอร์มตัวเลือกดึงสถิติตลอดทั้งปี */}
            <div className="flex flex-wrap items-center gap-1.5 no-print">
              <span className="text-xs text-slate-500 font-semibold">เลือกน้ำยา:</span>
              <select
                value={selectedChartTest}
                onChange={(e) => setSelectedChartTest(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none"
              >
                {allTestNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              <span className="text-xs text-slate-500 font-semibold ml-2">เลือกปี:</span>
              <select
                value={selectedChartYear}
                onChange={(e) => setSelectedChartYear(Number(e.target.value))}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>ค.ศ. {year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ป้ายแสดงรายละเอียดกรณีเข้าสู่ Print Layout */}
          <div className="hidden print:block mb-4 p-4.5 bg-slate-100 border-l-4 border-indigo-600 rounded-xl text-xs text-slate-900 leading-relaxed">
            <h4 className="font-extrabold uppercase text-[13px] text-slate-900 mb-1">ข้อมูลสารสนเทศรายงานเบิกจำแนกรายชื่อตรวจ</h4>
            <div>• ชื่อรายการตรวจทดสอบ: <span className="font-black text-indigo-700">{selectedChartTest || 'ยังไม่ได้ระบุน้ำยา'}</span></div>
            <div>• สรุปสถิติรอบประจำปี ค.ศ.: <span className="font-bold underline text-indigo-600">{selectedChartYear}</span></div>
            <div>• จัดพิมพ์โดย: <span className="font-semibold text-slate-700">6501110482092@ptu.ac.th</span> เมื่อ <span className="font-mono text-slate-700">2026-06-19 08:24:25 UTC</span></div>
          </div>

          {/* การเรนเดอร์ชาร์ตแท่งด้วยโค้ด React & Tailwind ความแม่นยำสูง */}
          {allTestNames.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-10 bg-slate-50 dark:bg-slate-950 rounded-xl">
              ยังไม่มีประวัติผลิตภัณฑ์เพื่อนำมาแสดงผลชาร์ตในขณะนี้
            </p>
          ) : (
            <div className="relative pt-6 pb-2 px-1">
              {/* วาดเส้นแรเงาแผลหลังยอดความจุพารลัล */}
              <div className="absolute inset-x-0 top-0 h-48 border-b border-dashed border-slate-200 dark:border-slate-800/80 pointer-events-none flex flex-col justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                <div>{maxMonthlyQty.toFixed(0)} ชุด</div>
                <div className="border-t border-dashed border-slate-100 dark:border-slate-800/60 w-full"></div>
                <div>{(maxMonthlyQty / 2).toFixed(0)} ชุด</div>
                <div className="border-t border-dashed border-slate-100 dark:border-slate-800/60 w-full"></div>
                <div>0 ชุด</div>
              </div>

              {/* แท่งกราฟ 12 เดือนเสมือนจริง */}
              <div className="h-48 flex items-end justify-between gap-1.5 sm:gap-4 relative pt-4 z-10">
                {monthlyDataForChart.map((d) => {
                  const heightPercent = d.qty > 0 ? `${(d.qty / maxMonthlyQty) * 100}%` : '4px';
                  
                  return (
                    <div key={d.monthIndex} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                      {/* Tooltip บอลลูนเมื่อเมาส์ชี้ */}
                      <div className="absolute bottom-full mb-1 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 px-2 py-1 text-[9px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md whitespace-nowrap z-20">
                        ดึงใช้ {d.qty} ชุด | อิงเบิกในแผ่น {d.count} ครั้ง
                      </div>

                      {/* แท่งสีวาดด้วย CSS animation */}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: heightPercent }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={`w-full rounded-t-md relative transition-all ${
                          d.qty > 0
                            ? 'bg-linear-to-t from-indigo-600 to-teal-400 group-hover:from-indigo-500 group-hover:to-teal-300 drop-shadow-sm shadow-indigo-500/10'
                            : 'bg-slate-100 dark:bg-slate-800/80'
                        }`}
                      >
                        {/* อัตราคะแนนตัวเลขเหนือแท่งชาร์ต */}
                        {d.qty > 0 && (
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 text-[10px] font-black font-mono text-indigo-700 dark:text-teal-400 block tracking-tighter">
                            {d.qty}
                          </span>
                        )}
                      </motion.div>
                    </div>
                  );
                })}
              </div>

              {/* เพลตชื่อแกน X ด้านล่าง */}
              <div className="flex justify-between gap-1.5 sm:gap-4 mt-2.5 border-t border-slate-200 dark:border-slate-800 pt-2 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">
                {monthlyDataForChart.map((d) => (
                  <div key={d.monthIndex} className="flex-1 text-center truncate" title={d.fullName}>
                    {d.monthName}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ตารางสต็อกวิเคราะห์ความเสี่ยงขาดสต็อก (Inventory Projections & Restock Planning) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm lg:col-span-12 print-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h3 className="font-black text-slate-850 dark:text-slate-100 text-lg flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                🧭 แผงพยากรณ์รวมยอดเบิกสะสมรายเดือนแบ่งช่วง 3M / 6M / Yearly
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เปรียบเทียบยอดอัตราใช้เฉลี่ยรายเดือนของผลิตภัณฑ์เดียวกันคนละล็อตในรอบ 3 เดือน, 6 เดือน และ 1 ปี เพื่อความยืดหยุ่นในการสั่งrestock
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4 text-xs font-semibold no-print">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span> วิกฤต (≤ 15 วัน)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> ควรเตือนสั่งซื้อ (≤ 30 วัน)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> ปลอดภัย (&gt; 30 วัน)</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase">
                  <th className="px-4 py-3">ชื่อสารเคมี / ชุดน้ำยา</th>
                  <th className="px-4 py-3">กลุ่มงานแผนก</th>
                  <th className="px-4 py-3 text-right">สต็อกรวมในคลัง</th>
                  <th className="px-3 py-3 text-right text-indigo-600 dark:text-indigo-400 font-bold">เฉลี่ย 3 เดือน</th>
                  <th className="px-3 py-3 text-right text-teal-650 dark:text-teal-400 font-bold">เฉลี่ย 6 เดือน</th>
                  <th className="px-3 py-3 text-right text-rose-600 dark:text-rose-400 font-bold">เฉลี่ยรายปี (12 ด.)</th>
                  <th className="px-3 py-3 text-right bg-slate-100/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-350">เฉลี่ยรอบฟิลเตอร์</th>
                  <th className="px-4 py-3 text-center">ประมาณเวลาที่เหลืออยู่</th>
                  <th className="px-4 py-3 text-center">สถานะความเสี่ยง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {stockoutRiskAnalysis.map((risk, index) => {
                  const testAverages = averagesByName[risk.name] || { avg3m: 0, avg6m: 0, avg1y: 0 };
                  return (
                    <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40">
                      <td className="px-4 py-3 font-semibold text-slate-950 dark:text-slate-100">
                        {risk.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px]">
                          {risk.group}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-200">
                        {risk.currentStock} ชุด
                      </td>
                      
                      {/* เฉลี่ยราย 3 เดือน */}
                      <td className="px-3 py-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                        {testAverages.avg3m === 0 ? '-' : `${testAverages.avg3m.toFixed(1)} ชุด/ด.`}
                      </td>

                      {/* เฉลี่ยราย 6 เดือน */}
                      <td className="px-3 py-3 text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                        {testAverages.avg6m === 0 ? '-' : `${testAverages.avg6m.toFixed(1)} ชุด/ด.`}
                      </td>

                      {/* เฉลี่ยราย 1 ปี / 12 ด. */}
                      <td className="px-3 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {testAverages.avg1y === 0 ? '-' : `${testAverages.avg1y.toFixed(1)} ชุด/ด.`}
                      </td>

                      {/* เฉลี่ยระดับช่วงเวลาฟิลเตอร์ */}
                      <td className="px-3 py-3 text-right font-mono bg-slate-100/30 dark:bg-slate-800/10 text-slate-600 dark:text-slate-400">
                        {risk.avgMonthlyUsage === 0 
                          ? '-' 
                          : `${risk.avgMonthlyUsage.toFixed(1)} ชุด/ด.`
                        }
                      </td>

                      <td className="px-4 py-3 text-center font-bold">
                        {risk.daysOfInventory === Infinity ? (
                          <span className="text-slate-400">ระบุไม่ได้</span>
                        ) : (
                          <span className={risk.riskLevel === 'critical' ? 'text-rose-600' : risk.riskLevel === 'warn' ? 'text-amber-600' : 'text-teal-600'}>
                            ประมาณ {risk.daysOfInventory} วัน
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider ${risk.colorClass}`}>
                          {risk.riskText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="hidden print:block mt-8 pt-8 border-t border-dashed border-slate-300 flex justify-between items-center text-xs text-slate-600">
            <div>
              <p>ผู้ลงนามรับรองสถิติ: นักเทคนิคการแพทย์ หัวหน้าห้องปฏิบัติการทางการแพทย์คลินิก</p>
              <p className="mt-8">ลงชื่อ: ____________________________________ วันที่: ______/______/______</p>
            </div>
            <div className="text-right">
              <p>ระบบใบงานพยากรณ์สุขภาพคลังแล็บอัจฉริยะแบบบูรณาการ</p>
              <p>เอกสารรับรองความถูกต้องด้วยฟังก์ชัน FEFO Auto-Queue System</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
