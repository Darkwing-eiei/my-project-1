import { useState, useEffect } from 'react';
import { ShoppingCart, Receipt, BarChart3, Home, Plus, Minus, Trash2, TrendingUp, DollarSign, Package, Users, Settings, Edit, Save, X } from 'lucide-react';
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
// ส่วนที่ 3: คอมโพเนนต์ย่อย (ถูกปรับปรุงเล็กน้อย)
// ====================================================================

interface ShopSettingsFormProps {
  initialSettings: ShopSettings;
  onSave: (settings: ShopSettings) => void;
  onCancel: () => void;
}

const ShopSettingsForm = ({ initialSettings, onSave, onCancel }: ShopSettingsFormProps) => {
  const [currentSettings, setCurrentSettings] = useState<ShopSettings>(initialSettings);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
      <h2 className="text-lg font-semibold mb-4">ตั้งค่าข้อมูลร้าน & PromptPay</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อร้าน</label>
          <input
            type="text"
            value={currentSettings.shopName}
            onChange={(e) => setCurrentSettings({ ...currentSettings, shopName: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="ระบุชื่อร้าน"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            เลขที่ PromptPay (เบอร์โทร หรือ เลขประจำตัว)
          </label>
          <input
            type="text"
            value={currentSettings.promptPayId}
            onChange={(e) => setCurrentSettings({ ...currentSettings, promptPayId: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="เช่น 0812345678 หรือ 1234567890123"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อเจ้าของบัญชี</label>
          <input
            type="text"
            value={currentSettings.promptPayName}
            onChange={(e) => setCurrentSettings({ ...currentSettings, promptPayName: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="ระบุชื่อเจ้าของบัญชี"
          />
        </div>
      </div>
      <div className="flex justify-end space-x-3 mt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ยกเลิก
        </button>
        <button
          onClick={() => onSave(currentSettings)}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
        >
          บันทึกการตั้งค่า
        </button>
      </div>
    </div>
  );
};


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
    <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
      <h2 className="text-lg font-semibold mb-4">เพิ่มเมนูใหม่</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อเมนู</label>
          <input
            type="text"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="ระบุชื่อเมนู"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ราคา</label>
          <input
            type="number"
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="ระบุราคา"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">หมวดหมู่
          <select
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">เลือกหมวดหมู่</option>
            <option value="ข้าว">ข้าว</option>
            <option value="เส้น">เส้น</option>
            <option value="แกง">แกง</option>
            <option value="เครื่องดื่ม">เครื่องดื่ม</option>
            <option value="ของหวาน">ของหวาน</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
          </label>
        </div>
      </div>
      <div className="flex justify-end space-x-3 mt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ยกเลิก
        </button>
        <button
          onClick={handleAddItem}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          เพิ่มเมนู
        </button>
      </div>
    </div>
  );
};

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
    <div className="space-y-3">
      <input
        type="text"
        value={editData.name}
        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="ชื่อเมนู"
      />
      <input
        type="number"
        value={editData.price}
        onChange={(e) => setEditData({ ...editData, price: parseInt(e.target.value) || 0 })}
        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="ราคา"
      />
      <label>
      หมวดหมู่
      <select
        value={editData.category}
        onChange={(e) => setEditData({ ...editData, category: e.target.value })}
        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
  className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 transition-colors"
>
  <X size={16} />
</button>

<button
  onClick={handleSave}
  aria-label="บันทึก"
  className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200 transition-colors"
>
  <Save size={16} />
</button>

      </div>
    </div>
  );
};


// ====================================================================
// ส่วนที่ 4: คอมโพเนนต์หลัก RestaurantApp
// ====================================================================

const RestaurantApp = () => {
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [shopSettings, setShopSettings] = useState<ShopSettings>({
    shopName: '',
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
      // ใช้การรวมข้อมูลเดิมเพื่อให้มั่นใจว่าฟิลด์ทั้งหมดถูกตั้งค่า
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

    // 📌 แก้ไข TS2532 ที่นี่: ใช้ (?? 0) ก่อนคูณ
    const topItems = Object.entries(itemSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, quantity]) => ({ 
        name, 
        quantity, 
        // FIX: ใช้ (menuItems.find(...)?.price ?? 0) เพื่อจัดการ undefined ก่อนการคูณ
        revenue: (menuItems.find(i => i.name === name)?.price ?? 0) * quantity 
      })); 

    // คำนวณยอดขายรายวันในช่วง 7 วันล่าสุดสำหรับกราฟแท่ง (Daily Revenue)
    const dailyRevenue: { [key: string]: number } = {};
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6); 

    // กำหนดวันที่ 7 วันล่วงหน้าเพื่อแสดงผลในกราฟให้ครบ
    for (let i = 0; i < 7; i++) {
        const date = new Date(oneWeekAgo);
        date.setDate(oneWeekAgo.getDate() + i);
        // รูปแบบ 'dd/mm' เช่น 08/12
        const dateString = date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' }); 
        dailyRevenue[dateString] = 0;
    }

    // รวมยอดบิลเข้ากับวันที่
    bills.forEach(bill => {
        const billDate = new Date(bill.date);
        if (billDate >= oneWeekAgo) {
            const dateString = billDate.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
            dailyRevenue[dateString] = (dailyRevenue[dateString] || 0) + bill.total;
        }
    });

    // แปลงเป็น Array สำหรับ Recharts และเรียงตามวันที่
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

  // เพิ่มเมนูใหม่ (รับข้อมูลที่สมบูรณ์จาก NewItemForm)
  const addMenuItem = (itemData: Omit<MenuItem, 'id'>) => {
    const nextId = menuItems.length > 0 ? Math.max(...menuItems.map(item => item.id)) + 1 : 1;
    const item: MenuItem = {
      id: nextId,
      ...itemData
    };

    setMenuItems([...menuItems, item]);
    setShowAddForm(false); // ปิดฟอร์มหลังจากเพิ่มสำเร็จ
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

  // ====================================================================
  // ส่วนที่ 5: คอมโพเนนต์หน้าต่างๆ
  // ====================================================================

  const MenuManagePage = () => (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">จัดการเมนูอาหาร</h1>
        <div className="space-y-3 md:space-y-0 md:space-x-3 mt-4 md:mt-0">
          <button
            onClick={() => setShowSettingsForm(true)}
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 flex items-center justify-center space-x-2 w-full md:w-auto"
          >
            <Settings size={20} />
            <span>ตั้งค่าร้าน</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center justify-center space-x-2 w-full md:w-auto"
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

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">รายการเมนูทั้งหมด</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems.map(item => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
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
                        <h3 className="font-semibold text-lg">{item.name}</h3>
                        <p className="text-green-600 font-bold text-xl">฿{item.price}</p>
                        <p className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full inline-block mt-1">
                          {item.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                    <button
  onClick={() => setEditingItem(item.id)}
  aria-label="แก้ไข"
  className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200 transition-colors"
>
  <Edit size={16} />
</button>
<button
  onClick={() => deleteMenuItem(item.id)}
  aria-label="ลบรายการ"
  className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 transition-colors"
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
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">แดชบอร์ดร้านอาหาร</h1>

      {/* สถิติหลัก */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm">ยอดขายวันนี้</p>
              <p className="text-2xl font-bold text-blue-800">฿{stats.todayRevenue}</p>
            </div>
            <DollarSign className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm">ยอดขายทั้งหมด</p>
              <p className="text-2xl font-bold text-green-800">฿{stats.totalRevenue}</p>
            </div>
            <TrendingUp className="text-green-500" size={24} />
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm">ออเดอร์วันนี้</p>
              <p className="text-2xl font-bold text-purple-800">{stats.todayOrders}</p>
            </div>
            <Package className="text-purple-500" size={24} />
          </div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm">ออเดอร์ทั้งหมด</p>
              <p className="text-2xl font-bold text-orange-800">{stats.totalOrders}</p>
            </div>
            <Users className="text-orange-500" size={24} />
          </div>
        </div>
      </div>
      
      {/* 📌 ส่วนกราฟ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* กราฟยอดขายรายวัน (Bar Chart) */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">ยอดขาย 7 วันล่าสุด (บาท)</h2>
          <div className="w-full h-[300px]"> {/* ใช้ Tailwind Class แทน Inline Style */}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.revenueData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  formatter={(value: number) => [`฿${value.toLocaleString()}`, 'ยอดขาย']} 
                  labelFormatter={(label) => `วันที่: ${label}`}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="ยอดขาย" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* กราฟเมนูขายดี (Bar Chart) */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">รายได้จากเมนูขายดี TOP 5 (บาท)</h2>
          <div className="w-full h-[300px]"> {/* ใช้ Tailwind Class แทน Inline Style */}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topItems} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis type="number" stroke="#6b7280" /> 
                <YAxis dataKey="name" type="category" stroke="#6b7280" />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') return [`฿${value.toLocaleString()}`, 'รายได้'];
                    if (name === 'quantity') return [`${value.toLocaleString()} จาน`, 'จำนวน'];
                    return [value.toLocaleString(), name];
                  }} 
                  labelFormatter={(label) => `เมนู: ${label}`}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" name="รายได้" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {/* 📌 จบส่วนกราฟ */}
      
      {/* รายการเมนูขายดี */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold mb-4">เมนูขายดี TOP 5</h2>
        <div className="space-y-3">
          {stats.topItems.map((item, index) => ( 
            <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                  #{index + 1}
                </span>
                <span className="font-medium">{item.name}</span>
              </div>
              {/* แสดงจำนวนและรายได้ */}
              <span className="text-gray-600">{item.quantity} จาน (฿{item.revenue.toLocaleString()})</span> 
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold mb-4">ออเดอร์ล่าสุด</h2>
        {bills.length === 0 ? (
          <p className="text-gray-500 text-center py-8">ยังไม่มีบิล</p>
        ) : (
          bills.slice(-5).reverse().map(bill => (
            <div key={bill.id} className="flex justify-between items-center p-3 border-b last:border-b-0">
              <div>
                <p className="font-medium">บิลที่ #{bill.id}</p>
                <p className="text-sm text-gray-500">{new Date(bill.date).toLocaleString('th-TH')}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600">฿{bill.total}</p>
                <p className="text-sm text-gray-500">{bill.status}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const OrderPage = () => (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">รับออเดอร์</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">เมนูอาหาร</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {menuItems.map((item: MenuItem) => (
              <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium">{item.name}</h3>
                  <span className="text-blue-600 font-semibold">฿{item.price}</span>
                </div>
                <p className="text-sm text-gray-500 mb-3">{item.category}</p>
                <button
                  onClick={() => addToOrder(item)}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  เพิ่มลงออเดอร์
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">ออเดอร์ปัจจุบัน</h2>

          {currentOrder.length === 0 ? (
            <p className="text-gray-500 text-center py-8">ยังไม่มีรายการในออเดอร์</p>
          ) : (
            <div className="space-y-3">
              {currentOrder.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-sm text-gray-500">฿{item.price} x {item.quantity}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                  <button
  onClick={() => updateQuantity(item.id, item.quantity - 1)}
  aria-label="ลดจำนวน"
  className="bg-red-100 text-red-600 p-1 rounded hover:bg-red-200"
>
  <Minus size={16} />
</button>
                    <span className="mx-2 font-medium">{item.quantity}</span>
                    <button
  onClick={() => updateQuantity(item.id, item.quantity + 1)}
  aria-label="เพิ่มจำนวน"
  className="bg-green-100 text-green-600 p-1 rounded hover:bg-green-200"
>
  <Plus size={16} />
</button>
<button
  onClick={() => removeFromOrder(item.id)}
  aria-label="ลบรายการ"
  className="bg-gray-100 text-red-600 p-1 rounded hover:bg-gray-200 ml-2"
>
  <Trash2 size={16} />
</button>
                  </div>
                </div>
              ))}

              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>ยอดรวม:</span>
                  <span className="text-green-600">฿{calculateTotal(currentOrder)}</span>
                </div>
                <button
                  onClick={generateBill}
                  className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors mt-4"
                >
                  ออกบิล
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const BillPage = () => {
    const latestBill = bills[bills.length - 1];

    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">ออกบิล</h1>

        {latestBill ? (
          <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg border print:shadow-none print:border-none">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">{shopSettings.shopName}</h2>
              <p className="text-gray-500">บิลเลขที่ #{latestBill.id}</p>
              <p className="text-sm text-gray-500">{new Date(latestBill.date).toLocaleString('th-TH')}</p>
            </div>

            <div className="space-y-2 mb-6 border-b pb-4">
              {latestBill.items.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <span>{item.name} x{item.quantity}</span>
                  <span>฿{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between text-lg font-bold">
                <span>ยอดรวม:</span>
                <span className="text-green-600">฿{latestBill.total}</span>
              </div>
            </div>

            {/* QR Code PromptPay */}
            <div className="bg-blue-50 p-4 rounded-lg mb-6 print:hidden">
              <h3 className="text-center font-semibold text-blue-800 mb-3">
                💳 ชำระเงินผ่าน PromptPay
              </h3>
              <div className="flex justify-center mb-3">
                <img
                  src={generatePromptPayQR(latestBill.total, shopSettings)} 
                  alt="PromptPay QR Code"
                  className="w-48 h-48 border-2 border-blue-200 rounded-lg"
                />
              </div>
              <div className="text-center text-sm text-blue-700">
                <p className="font-medium">{shopSettings.promptPayName}</p>
                <p>{shopSettings.promptPayId}</p>
                <p className="text-xs text-blue-600 mt-1">สแกน QR Code เพื่อชำระเงิน</p>
              </div>
            </div>

            <div className="text-center mb-4 text-sm text-gray-500">
              ขอบคุณที่ใช้บริการ
            </div>

            <div className="space-y-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors"
              >
                พิมพ์บิล
              </button>
              <button
                onClick={() => setCurrentPage('order')}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
              >
                รับออเดอร์ใหม่
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">ไม่มีบิลที่จะแสดง</p>
            <button
              onClick={() => setCurrentPage('order')}
              className="mt-4 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
            >
              รับออเดอร์
            </button>
          </div>
        )}
      </div>
    );
  };

  const ReportPage = () => (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">รายงานยอดขาย</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">สรุปยอดขาย</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>ยอดขายวันนี้:</span>
              <span className="font-semibold text-green-600">฿{stats.todayRevenue}</span>
            </div>
            <div className="flex justify-between">
              <span>ออเดอร์วันนี้:</span>
              <span className="font-semibold">{stats.todayOrders} ออเดอร์</span>
            </div>
            <div className="flex justify-between">
              <span>ยอดขายรวม:</span>
              <span className="font-semibold text-blue-600">฿{stats.totalRevenue}</span>
            </div>
            <div className="flex justify-between">
              <span>ออเดอร์รวม:</span>
              <span className="font-semibold">{stats.totalOrders} ออเดอร์</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">รายการบิลทั้งหมด</h2>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {bills.length === 0 ? (
              <p className="text-gray-500 text-center">ยังไม่มีบิล</p>
            ) : (
              bills.slice().reverse().map(bill => (
                <div key={bill.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">บิล #{bill.id}</p>
                    <p className="text-xs text-gray-500">{new Date(bill.date).toLocaleString('th-TH')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">฿{bill.total}</p>
                    <p className="text-xs text-gray-500">{bill.items.length} รายการ</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ====================================================================
  // ส่วนที่ 6: การแสดงผลหลัก (Main Render)
  // ====================================================================

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'order':
        return <OrderPage />;
      case 'bill':
        return <BillPage />;
      case 'report':
        return <ReportPage />;
      case 'menu':
        return <MenuManagePage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-[Inter]">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center py-4 flex-wrap">
            <h1 className="text-xl font-bold text-gray-800">{shopSettings.shopName}</h1>
            <div className="flex space-x-4 mt-4 lg:mt-0 overflow-x-auto pb-2">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'dashboard'
                    ? 'bg-blue-500 text-white shadow'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Home size={20} />
                <span>แดชบอร์ด</span>
              </button>
              <button
                onClick={() => setCurrentPage('order')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'order'
                    ? 'bg-blue-500 text-white shadow'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <ShoppingCart size={20} />
                <span>รับออเดอร์</span>
              </button>
              <button
                onClick={() => setCurrentPage('bill')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'bill'
                    ? 'bg-blue-500 text-white shadow'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Receipt size={20} />
                <span>บิลล่าสุด</span>
              </button>
              <button
                onClick={() => setCurrentPage('report')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'report'
                    ? 'bg-blue-500 text-white shadow'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <BarChart3 size={20} />
                <span>รายงาน</span>
              </button>
              <button
                onClick={() => setCurrentPage('menu')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'menu'
                    ? 'bg-blue-500 text-white shadow'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Package size={20} />
                <span>จัดการเมนู</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderPage()}
      </main>

      <footer className="text-center py-4 text-xs text-gray-500 border-t mt-8 print:hidden">
        ระบบจัดการร้านอาหาร by Gemini (React + Tailwind CSS)
      </footer>
    </div>
  );
};

export default RestaurantApp;