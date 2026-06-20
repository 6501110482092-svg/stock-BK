import { StockItem, WithdrawalLog } from './types';

// พ่วงข้อมูลเริ่มต้น (Mock Data) สำหรับเปิดใช้งานครั้งแรกอย่างรวดเร็ว
export const INITIAL_STOCK: StockItem[] = [
  {
    id: 'mock-1',
    name: 'Anti-A Reagent (ชุดตรวจหมู่เลือดน้ำยาตรวจ)',
    sampleGroup: 'Immunology & Blood Bank',
    lot: 'LOT2026A5',
    expiryDate: '2026-12-31',
    receiveDate: '2026-06-01',
    initialQty: 50,
    currentQty: 32,
    totalPrice: 12500,
    pricePerUnit: 250,
    paymentType: 'cash',
    paymentStatus: 'paid',
    thresholds: {
      high: 30,
      low: 15,
      critical: 5
    },
    createdAt: '2026-06-01T08:30:00Z',
    notes: 'เก็บไว้ที่อุณหภูมิ 2-8 องศาเซลเซียส'
  },
  {
    id: 'mock-2',
    name: 'Urine Strip 10 Parameters (แถบตรวจปัสสาวะ)',
    sampleGroup: 'Clinical Microscopy',
    lot: 'LOT99831',
    expiryDate: '2026-09-15',
    receiveDate: '2026-06-10',
    initialQty: 100,
    currentQty: 12,
    totalPrice: 8000,
    pricePerUnit: 80,
    paymentType: 'credit',
    paymentDueDate: '2026-07-10',
    paymentStatus: 'pending',
    thresholds: {
      high: 40,
      low: 20,
      critical: 5
    },
    createdAt: '2026-06-10T10:15:00Z',
    notes: 'กล่องละ 100 แผ่น ห้ามโดนแสงและความชื้น'
  },
  {
    id: 'mock-3',
    name: 'HBsAg Rapid Test Kit (ชุดตรวจไวรัสตับอักเสบบี)',
    sampleGroup: 'Serology',
    lot: 'LOT-HBS-44',
    expiryDate: '2026-05-20',
    receiveDate: '2026-06-15',
    initialQty: 25,
    currentQty: 4,
    totalPrice: 3125,
    pricePerUnit: 125,
    paymentType: 'credit',
    paymentDueDate: '2026-07-25',
    paymentStatus: 'pending',
    thresholds: {
      high: 20,
      low: 10,
      critical: 5
    },
    createdAt: '2026-06-15T14:00:00Z',
    notes: 'ชุดตรวจแบบรวดเร็วกล่องละ 25 ชุดทดสอบ'
  },
  {
    id: 'mock-4',
    name: 'CBC Diluent / Isotonac (น้ำยาเตรียมสไลด์และนับเม็ดเลือด)',
    sampleGroup: 'Hematology',
    lot: 'CBC-D-909',
    expiryDate: '2027-01-10',
    receiveDate: '2026-06-18',
    initialQty: 10,
    currentQty: 8,
    totalPrice: 15000,
    pricePerUnit: 1500,
    paymentType: 'cash',
    paymentStatus: 'paid',
    thresholds: null, // ไม่มีตั้งการแจ้งเตือน
    createdAt: '2026-06-18T09:00:00Z',
    notes: 'ถังละ 20 ลิตร สำหรับเครื่องนับเม็ดเลือดอัตโนมัติ'
  }
];

export const INITIAL_LOGS: WithdrawalLog[] = [
  {
    id: 'log-1',
    itemId: 'mock-1',
    itemName: 'Anti-A Reagent (ชุดตรวจหมู่เลือดน้ำยาตรวจ)',
    lot: 'LOT2026A5',
    sampleGroup: 'Immunology & Blood Bank',
    withdrawQty: 10,
    withdrawDate: '2026-06-10',
    remainingQtyBefore: 50,
    remainingQtyAfter: 40
  },
  {
    id: 'log-2',
    itemId: 'mock-1',
    itemName: 'Anti-A Reagent (ชุดตรวจหมู่เลือดน้ำยาตรวจ)',
    lot: 'LOT2026A5',
    sampleGroup: 'Immunology & Blood Bank',
    withdrawQty: 8,
    withdrawDate: '2026-06-15',
    remainingQtyBefore: 40,
    remainingQtyAfter: 32
  },
  {
    id: 'log-3',
    itemId: 'mock-2',
    itemName: 'Urine Strip 10 Parameters (แถบตรวจปัสสาวะ)',
    lot: 'LOT99831',
    sampleGroup: 'Clinical Microscopy',
    withdrawQty: 88,
    withdrawDate: '2026-06-19',
    remainingQtyBefore: 100,
    remainingQtyAfter: 12
  }
];

// ตั้งค่าดึงข้อมูลและบันทึกข้อมูล
export const getStoredStock = (): StockItem[] => {
  if (typeof window === 'undefined') return INITIAL_STOCK;
  const stored = localStorage.getItem('clinic_stock_items');
  if (!stored) {
    localStorage.setItem('clinic_stock_items', JSON.stringify(INITIAL_STOCK));
    return INITIAL_STOCK;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return INITIAL_STOCK;
  }
};

export const setStoredStock = (items: StockItem[]) => {
  localStorage.setItem('clinic_stock_items', JSON.stringify(items));
};

export const getStoredLogs = (): WithdrawalLog[] => {
  if (typeof window === 'undefined') return INITIAL_LOGS;
  const stored = localStorage.getItem('clinic_stock_withdrawal_logs');
  if (!stored) {
    localStorage.setItem('clinic_stock_withdrawal_logs', JSON.stringify(INITIAL_LOGS));
    return INITIAL_LOGS;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return INITIAL_LOGS;
  }
};

export const setStoredLogs = (logs: WithdrawalLog[]) => {
  localStorage.setItem('clinic_stock_withdrawal_logs', JSON.stringify(logs));
};

// ฟังก์ชันแปลงรูปแบบวันที่เป็นไทยสวยงาม
export const formatThaiDate = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543; // แปลงพุทธศักราชเพื่อความคุ้นเคยในไทย
    return `${day} ${month} ${year}`;
  } catch (e) {
    return dateString;
  }
};

// เช็กระดับความเสี่ยงของจำนวนชุดคงเหลือ
export interface AlertLevelInfo {
  level: 'green' | 'yellow' | 'red' | 'neutral';
  colorClass: string;
  bgClass: string;
  borderClass: string;
  textText: string;
}

export const getAlertLevel = (currentQty: number, thresholds: StockItem['thresholds']): AlertLevelInfo => {
  if (!thresholds) {
    return {
      level: 'neutral',
      colorClass: 'text-slate-600 dark:text-slate-300',
      bgClass: 'bg-slate-50 dark:bg-slate-800/50',
      borderClass: 'border-slate-200 dark:border-slate-700/60',
      textText: 'ปกติ (ไม่ได้ตั้งค่าเตือน)'
    };
  }

  const { high, low, critical } = thresholds;

  if (currentQty <= critical) {
    return {
      level: 'red',
      colorClass: 'text-rose-600',
      bgClass: 'bg-rose-50',
      borderClass: 'border-rose-200',
      textText: `วิกฤต (เลิก/ใกล้หมด ≤ ${critical})`
    };
  }

  if (currentQty <= low) {
    return {
      level: 'yellow',
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
      textText: `เตือนใกล้หมด (≤ ${low})`
    };
  }

  if (currentQty > high) {
    return {
      level: 'green',
      colorClass: 'text-teal-600',
      bgClass: 'bg-teal-50',
      borderClass: 'border-teal-200',
      textText: `เพียงพอ (> ${high})`
    };
  }

  // อยู่ระหว่างเตือนใกล้หมดกับเพียงพอ
  return {
    level: 'neutral',
    colorClass: 'text-sky-600',
    bgClass: 'bg-sky-50',
    borderClass: 'border-sky-200',
    textText: `ปานกลาง (${currentQty} ชุด)`
  };
};
