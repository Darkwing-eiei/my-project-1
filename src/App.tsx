import { useState, useEffect } from 'react';
// 📌 แก้ไข: ลบ ShoppingCart ออก
import { Receipt, BarChart3, Home, Plus, Minus, Trash2, TrendingUp, DollarSign, Package, Users, Settings, Edit, Save, X, Menu as MenuIcon, Package2, ListOrdered, Printer } from 'lucide-react'; 
// 📌 นำเข้าคอมโพเนนต์กราฟจาก Recharts
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'; 

// ====================================================================
// ส่วนที่ 1: การกำหนดประเภทข้อมูล (Interfaces)
// ====================================================================

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
}

interface OrderItem extends MenuItem {
  quantity: number;
}

interface Bill {
  id: number;
  date: string;
  items: OrderItem[];
  total: number;
  status: string;
}

interface ShopSettings {
  shopName: string;
  promptPayId: string;
  promptPayName: string;
}

// ====================================================================
// 📌 ส่วนที่ 2: ฟังก์ชันสำหรับ PromptPay QR Code (CRC Calculation)
// ====================================================================

// ฟังก์ชันสำหรับคำนวณ CRC16-CCITT Checksum (XMODEM)
const crc16ccitt = (data: string): string => {
  let crc = 0xffff;
  const polynomial = 0x1021;
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    bytes[i] = data.charCodeAt(i);
  }

  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
};


// ฟังก์ชันหลักสำหรับสร้าง URL ของ QR Code PromptPay
const generatePromptPayQR = (amount: number, settings: ShopSettings): string => {
    // 1. เตรียมข้อมูลพื้นฐาน
    const promptPayId = settings.promptPayId.replace(/[^0-9]/g, ''); // ลบอักขระที่ไม่ใช่ตัวเลข
    const paddedPromptPayId = promptPayId.padStart(13, '0');
    
    // กำหนดว่า QR จะระบุยอดเงินหรือไม่ (ถ้าจำนวนเงินเป็น 0 ให้เป็น QR แบบให้กรอกยอดเอง)
    const amountFloat = parseFloat(amount.toFixed(2));
    const hasAmount = amountFloat > 0;
    const amountStr = hasAmount ? amountFloat.toFixed(2) : '';

    // 2. สร้างโครงสร้างข้อมูล TLV (Tag-Length-Value)
    
    // Tag 00: Payload Format Indicator (Fixed)
    const tlv00 = '000201'; 
    
    // Tag 01: Point of Initiation (11=Static without amount, 12=Static with amount)
    const tlv01 = `0102${hasAmount ? '12' : '11'}`; 
    
    // Tag 29: Merchant Account Information
    // 00=A000000677010111 (PromptPay)
    // 01=PromptPay ID (13 หลัก)
    const tlv29_00 = '0016A000000677010111';
    const tlv29_01_Value = paddedPromptPayId;
    const tlv29_01 = `01${tlv29_01_Value.length.toString().padStart(2, '0')}${tlv29_01_Value}`;
    const tlv29_Value = `${tlv29_00}${tlv29_01}`;
    const tlv29 = `29${tlv29_Value.length.toString().padStart(2, '0')}${tlv29_Value}`;
    
    // Tag 53: Currency Code (764 = THB)
    const tlv53 = '5303764'; 
    
    // Tag 54: Transaction Amount
    let tlv54 = '';
    if (hasAmount) {
        tlv54 = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;
    }
    
    // Tag 58: Country Code (TH)
    const tlv58 = '5802TH'; 

    // Tag 63: CRC (เหลือ 4 หลักสุดท้าย)
    const tlv63_prefix = '6304'; 

    // 3. รวมสตริงทั้งหมดก่อน CRC
    const dataForCrc = `${tlv00}${tlv01}${tlv29}${tlv53}${tlv54}${tlv58}${tlv63_prefix}`;

    // 4. คำนวณ CRC และสร้าง Checksum ตัวจริง
    const crcValue = crc16ccitt(dataForCrc);
    
    // 5. สร้าง Data String สมบูรณ์
    const finalDataString = `${dataForCrc}${crcValue}`;
    
    // 6. สร้าง URL QR Code
    // console.log("Final Data String:", finalDataString); // ใช้สำหรับ Debug
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(finalDataString)}`;
};


// ====================================================================
// ส่วนที่ 3: คอมโพเนนต์ย่อย (ถูกปรับปรุง UI/UX)
// ====================================================================

// 3.1 Stat Card (สำหรับ Dashboard)
const StatCard = ({ icon: Icon, label, value, color, textColor, iconColor }: { icon: any, label: string, value: string, color: string, textColor: string, iconColor: string }) => (
  <div className={`${color} p-5 rounded-xl border border-slate-200 shadow-md`}>
    <div className="flex items-center justify-between">
      <div>
        <p className={`${textColor} text-sm font-medium`}>{label}</p>
        <p className="text-3xl font-extrabold text-slate-800 mt-1">{value}</p>
      </div>
      <Icon className={`${iconColor}`} size={30} />
    </div>
  </div>
);


// 3.2 Shop Settings Form
interface ShopSettingsFormProps {
  initialSettings: ShopSettings;
  onSave: (settings: ShopSettings) => void;
  onCancel: () => void;
}

const ShopSettingsForm = ({ initialSettings, onSave, onCancel }: ShopSettingsFormProps) => {
  const [currentSettings, setCurrentSettings] = useState<ShopSettings>(initialSettings);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 mb-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">⚙️ ตั้งค่าข้อมูลร้าน & PromptPay</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="col-span-1 md:col-span-2">
          <label htmlFor="shop-name-input" className="block text-sm font-medium text-slate-700 mb-2">ชื่อร้าน</label>
          <input
            id="shop-name-input"
            type="text"
            value={currentSettings.shopName}
            onChange={(e) => setCurrentSettings({ ...currentSettings, shopName: e.target.value })}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-150"
            placeholder="ระบุชื่อร้าน"
          />
        </div>
        <div>
          <label htmlFor="promptpay-id-input" className="block text-sm font-medium text-slate-700 mb-2">
            เลขที่ PromptPay (เบอร์โทร หรือ เลขประจำตัว)
          </label>
          <input
            id="promptpay-id-input"
            type="text"
            value={currentSettings.promptPayId}
            onChange={(e) => setCurrentSettings({ ...currentSettings, promptPayId: e.target.value })}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-150"
            placeholder="เช่น 0812345678 หรือ 1234567890123"
          />
        </div>
        <div>
          <label htmlFor="promptpay-name-input" className="block text-sm font-medium text-slate-700 mb-2">ชื่อเจ้าของบัญชี</label>
          <input
            id="promptpay-name-input"
            type="text"
            value={currentSettings.promptPayName}
            onChange={(e) => setCurrentSettings({ ...currentSettings, promptPayName: e.target.value })}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-150"
            placeholder="ระบุชื่อเจ้าของบัญชี"
          />
        </div>
      </div>
      <div className="flex justify-end space-x-3 mt-6">
        <button
          onClick={onCancel}
          className="px-6 py-3 text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-100 transition duration-200 font-medium"
        >
          ยกเลิก
        </button>
        <button
          onClick={() => onSave(currentSettings)}
          className="px-6 py-3 bg-teal-500 text-white rounded-xl shadow-md hover:bg-teal-600 transition duration-200 font-medium"
        >
          <Save size={20} className="inline mr-2" /> บันทึกการตั้งค่า
        </button>
      </div>
    </div>
  );
};

// 3.3 New Item Form
interface NewItemFormProps {
  onAddItem: (itemData: Omit<MenuItem, 'id'>) => void;
  onCancel: () => void;
}

const NewItemForm = ({ onAddItem, onCancel }: NewItemFormProps) => {
  const [newItem, setNewItem] = useState({ name: '', price: '', category: '' });

  const handleAddItem = () => {
    if (!newItem.name || !newItem.price || !newItem.category || parseInt(newItem.price) <= 0) return;

    onAddItem({
      name: newItem.name,
      price: parseInt(newItem.price),
      category: newItem.category
    });

    setNewItem({ name: '', price: '', category: '' });
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 mb-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">➕ เพิ่มเมนูใหม่</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="item-name-input" className="block text-sm font-medium text-slate-700 mb-2">ชื่อเมนู</label>
          <input
            id="item-name-input"
            type="text"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-150"
            placeholder="ระบุชื่อเมนู"
          />
        </div>
        <div>
          <label htmlFor="item-price-input" className="block text-sm font-medium text-slate-700 mb-2">ราคา</label>
          <input
            id="item-price-input"
            type="number"
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-150"
            placeholder="ระบุราคา"
          />
        </div>
        <div>
          <label htmlFor="item-category" className="block text-sm font-medium text-slate-700 mb-2">
             หมวดหมู่
          </label> 
          <select
            id="item-category" // แก้ไข: เพิ่ม ID ให้ตรงกับ htmlFor ใน Label
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-150"
          >
            <option value="">เลือกหมวดหมู่</option>
            <option value="ข้าว">ข้าว</option>
            <option value="เส้น">เส้น</option>
            <option value="แกง">แกง</option>
            <option value="เครื่องดื่ม">เครื่องดื่ม</option>
            <option value="ของหวาน">ของหวาน</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end space-x-3 mt-6">
        <button
          onClick={onCancel}
          className="px-6 py-3 text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-100 transition duration-200 font-medium"
        >
          ยกเลิก
        </button>
        <button
          onClick={handleAddItem}
          className="px-6 py-3 bg-teal-500 text-white rounded-xl shadow-md hover:bg-teal-600 transition duration-200 font-medium"
        >
          <Plus size={20} className="inline mr-2" /> เพิ่มเมนู
        </button>
      </div>
    </div>
  );
};

// 3.4 Menu Item Edit Form
interface MenuItemEditFormProps {
  item: MenuItem;
  onSave: (updatedItem: Partial<MenuItem>) => void;
  onCancel: () => void;
}

const MenuItemEditForm = ({ item, onSave, onCancel }: MenuItemEditFormProps) => {
  const [editData, setEditData] = useState<Omit<MenuItem, 'id'>>({
    name: item.name,
    price: item.price,
    category: item.category
  });

  const handleSave = () => {
    if (!editData.name || !editData.price || !editData.category) return;
    onSave({
      name: editData.name,
      price: editData.price,
      category: editData.category
    });
  };

  return (
    <div className="space-y-4">
      <label htmlFor={`edit-name-${item.id}`} className="sr-only">ชื่อเมนู</label>
      <input
        id={`edit-name-${item.id}`}
        type="text"
        value={editData.name}
        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-150"
        placeholder="ชื่อเมนู"
      />
      
      <label htmlFor={`edit-price-${item.id}`} className="sr-only">ราคา</label>
      <input
        id={`edit-price-${item.id}`}
        type="number"
        value={editData.price}
        onChange={(e) => setEditData({ ...editData, price: parseInt(e.target.value) || 0 })}
        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-150"
        placeholder="ราคา"
      />
      
      <label htmlFor={`edit-category-${item.id}`} className="block text-sm font-medium text-slate-700">
        หมวดหมู่
        <select
          id={`edit-category-${item.id}`}
          value={editData.category}
          onChange={(e) => setEditData({ ...editData, category: e.target.value })}
          className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-150 mt-1"
        >
          <option value="ข้าว">ข้าว</option>
          <option value="เส้น">เส้น</option>
          <option value="แกง">แกง</option>
          <option value="เครื่องดื่ม">เครื่องดื่ม</option>
          <option value="ของหวาน">ของหวาน</option>
          <option value="อื่นๆ">อื่นๆ</option>
        </select>
      </label>
      <div className="flex justify-end space-x-2">
      <button
        onClick={onCancel}
        aria-label="ปิด"
        className="bg-slate-100 text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition duration-150"
      >
        <X size={16} />
      </button>

      <button
        onClick={handleSave}
        aria-label="บันทึก"
        className="bg-teal-100 text-teal-600 p-2 rounded-lg hover:bg-teal-200 transition duration-150"
      >
        <Save size={16} />
      </button>
      </div>
    </div>
  );
};


// ====================================================================
// ส่วนที่ 4: คอมโพเนนต์หลัก RestaurantApp (รวม Logic และ หน้าต่างๆ)
// ====================================================================

const RestaurantApp = () => {
  const [currentPage, setCurrentPage] = useState<string>('order'); // เปลี่ยนหน้าเริ่มต้นเป็น 'order'
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [shopSettings, setShopSettings] = useState<ShopSettings>({
    shopName: '', // Default Name
    promptPayId: '', 
    promptPayName: ''
  });
  const [showSettingsForm, setShowSettingsForm] = useState<boolean>(false);

  // useEffect สำหรับโหลดข้อมูลจาก localStorage
  useEffect(() => {
    const savedMenuItems = localStorage.getItem('menuItems');
    const savedBills = localStorage.getItem('bills');
    const savedShopSettings = localStorage.getItem('shopSettings');

    if (savedMenuItems) {
      setMenuItems(JSON.parse(savedMenuItems));
    } else {
      const initialMenuItems: MenuItem[] = [
        { id: 1, name: 'ข้าวผัดกุ้ง', price: 60, category: 'ข้าว' },
        { id: 2, name: 'ข้าวผัดหมู', price: 50, category: 'ข้าว' },
        { id: 3, name: 'ผัดไทย', price: 45, category: 'เส้น' },
        { id: 4, name: 'ผัดซีอิ๊ว', price: 40, category: 'เส้น' },
        { id: 5, name: 'ต้มยำกุ้ง', price: 80, category: 'แกง' },
        { id: 6, name: 'แกงเขียวหวาน', price: 70, category: 'แกง' },
        { id: 7, name: 'โค้กเย็น', price: 20, category: 'เครื่องดื่ม' },
        { id: 8, name: 'น้ำเปล่า', price: 15, category: 'เครื่องดื่ม' }
      ];
      setMenuItems(initialMenuItems);
    }

    if (savedBills) {
      setBills(JSON.parse(savedBills));
    }

    if (savedShopSettings) {
      setShopSettings(prev => ({...prev, ...JSON.parse(savedShopSettings)}));
    }
  }, []);

  // useEffect สำหรับบันทึกข้อมูลลง localStorage
  useEffect(() => {
    localStorage.setItem('menuItems', JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem('bills', JSON.stringify(bills));
  }, [bills]);

  useEffect(() => {
    localStorage.setItem('shopSettings', JSON.stringify(shopSettings));
  }, [shopSettings]);

  // คำนวณสถิติ
  const calculateStats = () => {
    const today = new Date().toDateString();
    const todayBills = bills.filter(bill => new Date(bill.date).toDateString() === today);
    const todayRevenue = todayBills.reduce((sum: number, bill: Bill) => sum + bill.total, 0);
    const totalRevenue = bills.reduce((sum: number, bill: Bill) => sum + bill.total, 0);

    const itemSales: { [key: string]: number } = {};
    bills.forEach(bill => {
      bill.items.forEach(item => {
        itemSales[item.name] = (itemSales[item.name] || 0) + item.quantity;
      });
    });

    const topItems = Object.entries(itemSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, quantity]) => ({ 
        name, 
        quantity, 
        revenue: (menuItems.find(i => i.name === name)?.price ?? 0) * quantity 
      })); 

    // คำนวณยอดขายรายวันในช่วง 7 วันล่าสุดสำหรับกราฟแท่ง (Daily Revenue)
    const dailyRevenue: { [key: string]: number } = {};
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6); 

    for (let i = 0; i < 7; i++) {
        const date = new Date(oneWeekAgo);
        date.setDate(oneWeekAgo.getDate() + i);
        const dateString = date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' }); 
        dailyRevenue[dateString] = 0;
    }

    bills.forEach(bill => {
        const billDate = new Date(bill.date);
        if (billDate >= oneWeekAgo) {
            const dateString = billDate.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
            dailyRevenue[dateString] = (dailyRevenue[dateString] || 0) + bill.total;
        }
    });

    const revenueData = Object.entries(dailyRevenue)
        .map(([date, revenue]) => ({ date, revenue }));


    return {
      todayRevenue,
      totalRevenue,
      todayOrders: todayBills.length,
      totalOrders: bills.length,
      topItems, 
      revenueData 
    };
  };

  const stats = calculateStats();

  // เพิ่มรายการในออเดอร์
  const addToOrder = (item: MenuItem) => {
    const existingItem = currentOrder.find(orderItem => orderItem.id === item.id);
    if (existingItem) {
      setCurrentOrder(currentOrder.map(orderItem =>
        orderItem.id === item.id
          ? { ...orderItem, quantity: orderItem.quantity + 1 }
          : orderItem
      ));
    } else {
      setCurrentOrder([...currentOrder, { ...item, quantity: 1 }]);
    }
  };

  // เพิ่มเมนูใหม่
  const addMenuItem = (itemData: Omit<MenuItem, 'id'>) => {
    const nextId = menuItems.length > 0 ? Math.max(...menuItems.map(item => item.id)) + 1 : 1;
    const item: MenuItem = {
      id: nextId,
      ...itemData
    };

    setMenuItems([...menuItems, item]);
    setShowAddForm(false);
  };

  // อัพเดทเมนู
  const updateMenuItem = (id: number, updatedItem: Partial<MenuItem>) => {
    setMenuItems(menuItems.map(item =>
      item.id === id ? { ...item, ...updatedItem } : item
    ));
    setEditingItem(null);
  };

  // ลบเมนู
  const deleteMenuItem = (id: number) => {
    setMenuItems(menuItems.filter(item => item.id !== id));
  };

  // อัพเดทจำนวนในออเดอร์
  const updateQuantity = (itemId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCurrentOrder(currentOrder.filter(item => item.id !== itemId));
    } else {
      setCurrentOrder(currentOrder.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  // ลบรายการจากออเดอร์
  const removeFromOrder = (itemId: number) => {
    setCurrentOrder(currentOrder.filter(item => item.id !== itemId));
  };

  // คำนวณยอดรวม
  const calculateTotal = (orderItems: OrderItem[]) => {
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // ออกบิล
  const generateBill = () => {
    if (currentOrder.length === 0) return;

    const newBill: Bill = {
      id: bills.length > 0 ? Math.max(...bills.map(b => b.id)) + 1 : 1,
      date: new Date().toISOString(),
      items: currentOrder,
      total: calculateTotal(currentOrder),
      status: 'ชำระแล้ว'
    };

    setBills([...bills, newBill]);
    setCurrentOrder([]);
    setCurrentPage('bill');
  };

  // 📌 ฟังก์ชันสำหรับพิมพ์บิล
  const handlePrintBill = () => {
    window.print();
  };


  // ====================================================================
  // ส่วนที่ 5: คอมโพเนนต์หน้าต่างๆ (ถูกปรับปรุง UI/UX)
  // ====================================================================

  const MenuManagePage = () => (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800">จัดการเมนูอาหาร 🍱</h1>
        <div className="space-y-3 md:space-y-0 md:space-x-4 mt-4 md:mt-0">
          <button
            onClick={() => setShowSettingsForm(true)}
            className="bg-slate-200 text-slate-700 px-6 py-3 rounded-xl hover:bg-slate-300 flex items-center justify-center space-x-2 w-full md:w-auto font-medium shadow-sm transition duration-200"
          >
            <Settings size={20} />
            <span>ตั้งค่าร้าน</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-teal-500 text-white px-6 py-3 rounded-xl hover:bg-teal-600 flex items-center justify-center space-x-2 w-full md:w-auto font-medium shadow-lg transition duration-200"
          >
            <Plus size={20} />
            <span>เพิ่มเมนูใหม่</span>
          </button>
        </div>
      </div>

      {showSettingsForm && (
        <ShopSettingsForm
          initialSettings={shopSettings}
          onSave={(newSettings) => {
            setShopSettings(newSettings);
            setShowSettingsForm(false);
          }}
          onCancel={() => setShowSettingsForm(false)}
        />
      )}

      {showAddForm && (
        <NewItemForm
          onAddItem={addMenuItem}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">รายการเมนูทั้งหมด</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map(item => (
              <div 
                key={item.id} 
                className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-lg transition-all duration-300"
              >
                {editingItem === item.id ? (
                  <MenuItemEditForm
                    item={item}
                    onSave={(updatedItem: Partial<MenuItem>) => updateMenuItem(item.id, updatedItem)}
                    onCancel={() => setEditingItem(null)}
                  />
                ) : (
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-xl text-slate-800">{item.name}</h3>
                        <p className="text-teal-600 font-extrabold text-2xl mt-1">฿{item.price}</p> 
                        <p className="text-sm text-slate-600 bg-teal-50 px-3 py-1 rounded-full inline-block mt-2 font-medium">
                          {item.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-4">
                      <button
                        onClick={() => setEditingItem(item.id)}
                        aria-label="แก้ไข"
                        className="bg-teal-100 text-teal-600 p-2 rounded-lg hover:bg-teal-200 transition-colors duration-150"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => deleteMenuItem(item.id)}
                        aria-label="ลบรายการ"
                        className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 transition-colors duration-150"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
  
  const DashboardPage = () => (
    <div className="p-6 space-y-8 bg-slate-50 min-h-screen">
      <h1 className="text-3xl font-extrabold text-slate-800 mb-6">📊 แดชบอร์ดร้านอาหาร</h1>

      {/* สถิติหลัก */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard 
          icon={DollarSign} 
          label="ยอดขายวันนี้" 
          value={`฿${stats.todayRevenue.toLocaleString()}`} 
          color="bg-sky-50" 
          textColor="text-sky-600" 
          iconColor="text-sky-500"
        />
        <StatCard 
          icon={TrendingUp} 
          label="ยอดขายทั้งหมด" 
          value={`฿${stats.totalRevenue.toLocaleString()}`} 
          color="bg-teal-50" 
          textColor="text-teal-600" 
          iconColor="text-teal-500"
        />
        <StatCard 
          icon={Package} 
          label="ออเดอร์วันนี้" 
          value={stats.todayOrders.toLocaleString()} 
          color="bg-indigo-50" 
          textColor="text-indigo-600" 
          iconColor="text-indigo-500"
        />
        <StatCard 
          icon={Users} 
          label="ออเดอร์ทั้งหมด" 
          value={stats.totalOrders.toLocaleString()} 
          color="bg-rose-50" 
          textColor="text-rose-600" 
          iconColor="text-rose-500"
        />
      </div>
      
      {/* 📌 ส่วนกราฟ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* กราฟยอดขายรายวัน (Bar Chart) */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">ยอดขาย 7 วันล่าสุด (บาท)</h2>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.revenueData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  formatter={(value: number) => [`฿${value.toLocaleString()}`, 'ยอดขาย']} 
                  labelFormatter={(label) => `วันที่: ${label}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#14b8a6" name="ยอดขาย" radius={[4, 4, 0, 0]} /> 
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* กราฟเมนูขายดี (Bar Chart) */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">รายได้จากเมนูขายดี TOP 5 (บาท)</h2>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topItems} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" stroke="#94a3b8" /> 
                <YAxis dataKey="name" type="category" stroke="#94a3b8" />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') return [`฿${value.toLocaleString()}`, 'รายได้'];
                    if (name === 'quantity') return [`${value.toLocaleString()} จาน`, 'จำนวน'];
                    return [value.toLocaleString(), name];
                  }} 
                  labelFormatter={(label) => `เมนู: ${label}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#4f46e5" name="รายได้" radius={[0, 4, 4, 0]} /> 
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* รายการเมนูขายดี */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">เมนูขายดี TOP 5</h2>
        <div className="space-y-3">
          {stats.topItems.map((item, index) => ( 
            <div key={item.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition duration-150">
              <div className="flex items-center space-x-4">
                <span className="bg-teal-500 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold">
                  #{index + 1}
                </span>
                <span className="font-medium text-slate-800">{item.name}</span>
              </div>
              <span className="text-slate-600 font-semibold">{item.quantity} จาน (<span className="text-teal-600">฿{item.revenue.toLocaleString()}</span>)</span> 
            </div>
          ))}
        </div>
      </div>

      {/* ออเดอร์ล่าสุด */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">ออเดอร์ล่าสุด</h2>
        {bills.length === 0 ? (
          <p className="text-slate-500 text-center py-8">ยังไม่มีบิล</p>
        ) : (
          bills.slice(-5).reverse().map(bill => (
            <div key={bill.id} className="flex justify-between items-center p-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition duration-150">
              <div>
                <p className="font-medium text-slate-800">บิลที่ #{bill.id}</p>
                <p className="text-sm text-slate-500">{new Date(bill.date).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-teal-600">฿{bill.total.toLocaleString()}</p>
                <p className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full inline-block mt-1">{bill.status}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const OrderPage = () => (
    <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-3xl font-extrabold text-slate-800 mb-8">🛒 รับออเดอร์</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-slate-800">รายการเมนู</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {menuItems.map((item: MenuItem) => (
              <div 
                key={item.id} 
                className="bg-white p-5 rounded-xl shadow-md border border-slate-100 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-slate-800">{item.name}</h3>
                  <span className="text-teal-600 font-extrabold text-xl">฿{item.price}</span>
                </div>
                <p className="text-sm text-slate-500 mb-4">{item.category}</p>
                <button
                  onClick={() => addToOrder(item)}
                  className="w-full bg-teal-500 text-white py-3 px-4 rounded-lg hover:bg-teal-600 transition-colors font-medium shadow-md shadow-teal-500/30"
                >
                  <Plus size={18} className="inline mr-2" /> เพิ่มลงออเดอร์
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 h-fit lg:sticky lg:top-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">รายการออเดอร์ปัจจุบัน</h2>

          {currentOrder.length === 0 ? (
            <p className="text-slate-500 text-center py-12">📝 ยังไม่มีรายการในออเดอร์</p>
          ) : (
            <div className="space-y-4">
              {currentOrder.map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <h4 className="font-bold text-slate-800">{item.name}</h4>
                    <p className="text-sm text-slate-500">฿{item.price.toLocaleString()} x <span className="font-bold">{item.quantity}</span></p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      aria-label="ลดจำนวน"
                      className="bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="mx-2 font-bold text-lg text-slate-800 w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      aria-label="เพิ่มจำนวน"
                      className="bg-teal-100 text-teal-600 p-2 rounded-full hover:bg-teal-200 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => removeFromOrder(item.id)}
                      aria-label="ลบรายการ"
                      className="bg-slate-100 text-red-600 p-2 rounded-full hover:bg-slate-200 ml-3 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              <div className="border-t border-slate-200 pt-6 mt-6">
                <div className="flex justify-between text-2xl font-extrabold mb-4">
                  <span className="text-slate-800">ยอดรวม:</span>
                  <span className="text-teal-600">฿{calculateTotal(currentOrder).toLocaleString()}</span>
                </div>
                <button
                  onClick={generateBill}
                  className="w-full bg-teal-500 text-white py-4 px-4 rounded-xl hover:bg-teal-600 transition-colors font-extrabold shadow-lg shadow-teal-500/40"
                >
                  <Receipt size={20} className="inline mr-3" /> ออกบิล & ชำระเงิน
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const BillPage = () => {
    const lastBill = bills.length > 0 ? bills[bills.length - 1] : null;
    const qrCodeUrl = lastBill ? generatePromptPayQR(lastBill.total, shopSettings) : '';

    return (
      <div className="p-6 bg-slate-50 min-h-screen flex justify-center print:p-0 print:bg-white print:min-h-0 print:block">
        <div 
          id="bill-container" 
          className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-xl border border-slate-100 print:shadow-none print:border-0 print:rounded-none print:max-w-full"
        >
          <div className="text-center mb-6">
            <Receipt size={36} className="text-teal-500 mx-auto mb-3 print:text-slate-800" />
            <h1 className="text-3xl font-extrabold text-slate-800">{shopSettings.shopName || 'ใบเสร็จรับเงิน'}</h1>
            <p className="text-sm text-slate-500">บิลล่าสุด: #{lastBill?.id}</p>
            <p className="text-sm text-slate-500">{new Date().toLocaleString('th-TH')}</p>
          </div>

          {lastBill ? (
            <>
              <div className="space-y-3 mb-6 border-t border-b border-slate-200 py-4">
                {lastBill.items.map(item => (
                  <div key={item.id} className="flex justify-between text-slate-700">
                    <span>{item.name} x {item.quantity}</span>
                    <span>฿{(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-2xl font-extrabold text-slate-800 mb-6 border-b border-slate-200 pb-4">
                <span>ยอดรวมสุทธิ:</span>
                <span className="text-teal-600">฿{lastBill.total.toLocaleString()}</span>
              </div>

              {/* ส่วน PromptPay QR Code */}
              {shopSettings.promptPayId && (
                <div className="text-center bg-teal-50 p-4 rounded-xl border border-teal-200 print:bg-white print:border-0">
                  <h3 className="text-xl font-bold text-teal-700 mb-3 print:text-slate-800">ชำระเงินด้วย PromptPay</h3>
                  <img src={qrCodeUrl} alt="PromptPay QR Code" className="w-48 h-48 mx-auto rounded-lg shadow-lg border border-white" />
                  <p className="mt-3 font-semibold text-slate-800">ยอด: <span className="text-teal-600">฿{lastBill.total.toLocaleString()}</span></p>
                  <p className="text-sm text-slate-600 mt-1">บัญชี: {shopSettings.promptPayName}</p>
                  <p className="text-xs text-slate-500">เลข PromptPay: {shopSettings.promptPayId}</p>
                </div>
              )}
              
              {/* 📌 ปุ่มพิมพ์บิลใหม่ */}
              <button
                onClick={handlePrintBill}
                className="w-full bg-sky-500 text-white py-3 px-4 rounded-xl hover:bg-sky-600 transition-colors font-medium mt-6 print:hidden" // ซ่อนเมื่อสั่งพิมพ์
              >
                <Printer size={18} className="inline mr-2" /> พิมพ์บิล
              </button>
              
              <button
                onClick={() => setCurrentPage('order')}
                className="w-full bg-slate-200 text-slate-700 py-3 px-4 rounded-xl hover:bg-slate-300 transition-colors font-medium mt-3 print:hidden" // ซ่อนเมื่อสั่งพิมพ์
              >
                <Home size={18} className="inline mr-2" /> กลับไปรับออเดอร์ใหม่
              </button>
            </>
          ) : (
            <p className="text-center text-slate-500 py-10">ยังไม่มีบิลล่าสุด</p>
          )}
        </div>
      </div>
    );
  };
  
  // ====================================================================
  // ส่วนที่ 6: Navigation Bar (ปรับปรุง UI/UX)
  // ====================================================================

  const NavBar = () => {
    const navItems = [
      { name: 'Dashboard', page: 'dashboard', icon: BarChart3 },
      { name: 'รับออเดอร์', page: 'order', icon: ListOrdered },
      { name: 'จัดการเมนู', page: 'menu', icon: Package2 },
    ];

    return (
      <nav className="bg-white shadow-xl sticky top-0 z-10 border-b border-slate-200 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-extrabold text-teal-600 flex items-center">
                <MenuIcon size={24} className="mr-2" />
                {shopSettings.shopName || 'POS App'}
              </span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navItems.map((item) => {
                  const isActive = currentPage === item.page;
                  return (
                    <button
                      key={item.name}
                      onClick={() => setCurrentPage(item.page)}
                      // ปรับสไตล์ Navigation Item
                      className={`
                        ${isActive 
                          ? 'bg-teal-500 text-white shadow-md shadow-teal-500/40' 
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}
                        px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center
                      `}
                    >
                      <item.icon size={18} className="mr-2" />
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  };

  // ====================================================================
  // ส่วนที่ 7: Render หลัก
  // ====================================================================

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'order':
        return <OrderPage />;
      case 'menu':
        return <MenuManagePage />;
      case 'bill':
        return <BillPage />;
      default:
        return <OrderPage />;
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <NavBar />
      <main className="max-w-7xl mx-auto">
        {renderPage()}
      </main>
    </div>
  );
};

export default RestaurantApp;