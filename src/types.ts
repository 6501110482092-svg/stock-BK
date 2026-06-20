export interface Thresholds {
  high: number;      // Green if quantity > high
  low: number;       // Yellow if quantity <= low and > critical
  critical: number;  // Red if quantity <= critical
}

export type PaymentType = 'cash' | 'credit';
export type PaymentStatus = 'paid' | 'pending';

export interface StockItem {
  id: string;
  name: string;          // ชื่อน้ำยา / อุปกรณ์
  sampleGroup: string;   // กลุ่มตัวอย่าง เช่น เคมีคลินิก, โลหิตวิทยา
  lot: string;           // LOT
  expiryDate: string;    // วันหมดอายุ
  receiveDate: string;   // วันที่รับ
  initialQty: number;    // จำนวนชุดเริ่มต้นที่เพิ่มเข้ามา
  currentQty: number;    // จำนวนชุดคงเหลือปัจจุบัน
  totalPrice: number;    // ราคารวม
  pricePerUnit: number;  // ราคาต่อชุด (คำนวณอัตโนมัติ: totalPrice / initialQty)
  paymentType: PaymentType; // เงินสด หรือ เครดิต
  paymentDueDate?: string;  // วันที่ต้องจ่าย (สำหรับเครดิต)
  paymentStatus: PaymentStatus; // สถานะชำระเงิน
  thresholds: Thresholds | null; // ตั้งค่าการแจ้งเตือนสี (เขียว เหลือง แดง)
  createdAt: string;     // เวลาที่สร้างรายการ
  notes?: string;        // บันทึกเพิ่มเติม
}

export interface WithdrawalLog {
  id: string;
  itemId: string;        // อ้างอิง ID ไอเทม
  itemName: string;      // แฟลตชื่อเพื่อกันรายการต้นทางถูกลบหรือแก้ไข
  lot: string;
  sampleGroup: string;
  withdrawQty: number;   // จำนวนชุดที่เบิก
  withdrawDate: string;  // เอาไปวันที่เท่าไหร่
  remainingQtyBefore: number; // คงเหลือการเบิกล่าสุด
  remainingQtyAfter: number;  // คงเหลือการเบิกหลังหักออก
}
