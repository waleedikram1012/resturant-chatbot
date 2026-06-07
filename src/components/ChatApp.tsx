import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Paperclip, Send, Settings, History, MessageSquarePlus, 
  MapPin, LogOut, Loader2, Sparkles, AlertCircle, ShoppingBag, 
  CalendarClock, Package, Headphones, Check, Sun, Moon, Bell, User, Phone, Download, XCircle, Star, CheckCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { extractIntent, validateAddress } from '../lib/grok';
import { jsPDF } from "jspdf";
import { cn } from '../lib/utils';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pills?: string[];
  isLoading?: boolean;
  orderData?: any;
  menuCategories?: { category: string; items: any[] }[];
};

const getInitialMessage = (lang: 'english' | 'roman_urdu'): Message => ({
  id: '1',
  role: 'assistant',
  text: lang === 'english' ? "Welcome to Spice Hub! I can help you place an order or book a table." : "Spice Hub me khush amdeed! Main aapka order aur booking handle karunga.",
  pills: ["Menu", "Book Table", "Track Order", "Talk to Agent"]
});

let orderCart: any[] = [];
let recentConversations: string[] = [];

export function ChatApp({ user, onLogout, toggleTheme, theme, botStatus }: { user: any, onLogout: () => void, toggleTheme: () => void, theme: string, botStatus: 'ON' | 'OFF' }) {
  const [currentLanguage, setCurrentLanguage] = useState<'english' | 'roman_urdu'>('roman_urdu');
  const [messages, setMessages] = useState<Message[]>([getInitialMessage('roman_urdu')]);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [successPopup, setSuccessPopup] = useState<{title: string, message: string} | null>(null);
  const [reviewPopup, setReviewPopup] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [cartTick, setCartTick] = useState(0);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chatState, setChatState] = useState<'WELCOME' | 'MENU' | 'WAITING_FOR_QUANTITY' | 'ORDERING_NAME' | 'ORDERING_PHONE' | 'ORDERING_ADDRESS' | 'WAITING_FOR_GUESTS' | 'WAITING_FOR_TIME' | 'WAITING_FOR_NAME' | 'WAITING_FOR_PHONE' | 'TRACK_ORDER_ID' | 'TALK_AGENT_PHONE' | 'GENERAL' | 'COMPLETED'>('WELCOME');

  const [deliveryInfo, setDeliveryInfo] = useState({ name: '', phone: '', address: '' });
  const [bookingInfo, setBookingInfo] = useState({ name: '', phone: '' });

  
  // Pending order/booking states
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productSize, setProductSize] = useState<'Small' | 'Medium' | 'Large'>('Medium');
  const [productQty, setProductQty] = useState<number>(1);
  const [pendingBooking, setPendingBooking] = useState<any>(null);
  const [activeLiveOrders, setActiveLiveOrders] = useState<any[]>([]);

  useEffect(() => {
    // Request permission on mount if needed
    if ("Notification" in window && Notification.permission === "default") {
       Notification.requestPermission();
    }

    const fetchActiveOrders = async () => {
      const res = await supabase.from('orders').select('*').eq('user_id', user.id).neq('status', 'Delivered');
      if (res.data) {
         setActiveLiveOrders(res.data);
      }
    };
    fetchActiveOrders();

    const subscription = supabase.channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, payload => {
         fetchActiveOrders();
         if (payload.eventType === 'UPDATE') {
            if ("Notification" in window && Notification.permission === "granted") {
               new Notification(`SpiceHub Order Update`, {
                  body: `Your order ${payload.new.id} is now: ${payload.new.status}`
               });
            }
         }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user.id]);


  const MENU_ITEMS = [
    { name: 'Zinger Burger', price: 450, category: 'Burgers' },
    { name: 'Cheese Blast', price: 550, category: 'Burgers' },
    { name: 'Grilled Jalapeno', price: 520, category: 'Burgers' },
    { name: 'Monster Burger', price: 750, category: 'Burgers' },
    { name: 'Chicken Tikka S', price: 600, category: 'Pizza' },
    { name: 'Chicken Tikka L', price: 1300, category: 'Pizza' },
    { name: 'Creamy BBQ S', price: 650, category: 'Pizza' },
    { name: 'Creamy BBQ L', price: 1400, category: 'Pizza' },
    { name: 'Chicken Dum Biryani', price: 380, category: 'Biryani' },
    { name: 'Special Mutton Biryani', price: 600, category: 'Biryani' },
    { name: 'Cold Drink 350ml', price: 120, category: 'Drinks' },
    { name: 'Mineral Water', price: 80, category: 'Drinks' }
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addBotMessage = (text: string, pills?: string[], orderData?: any, menuCategories?: any[]) => {
    setMessages(prev => [...prev.filter(m => !m.isLoading), { id: crypto.randomUUID(), role: 'assistant', text, pills, orderData, menuCategories }]);
  };

  const handlePillClick = (pillText: string) => {
    handleSend(pillText);
  };

  const handleSend = async (customText?: string | React.MouseEvent) => {
    const text = typeof customText === 'string' ? customText : input;
    if (!text.trim()) return;
    
    setInput('');
    const userMsgId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text }]);
    
    // Show typing indicator
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: '', isLoading: true }]);

    // State machine logic
    const lowerText = text.toLowerCase();

    // Admin Commands
    if (lowerText === 'show admin dashboard' || lowerText === 'admin log analytics') {
      const dashboard = `**System Status**: ${botStatus}
**User Login Sessions Count**: 2 Active, 18 Today
**Order Metrics Matrix**: 156 Total Orders (Rs. 450,230)
**Ambiance Bookings Matrix**: 24 Bookings (12 Zone A, 8 Zone B, 4 VIP)
**Weekly/Monthly Chat Volume Graph**:
Mon: █ █ █ █ 50
Tue: █ █ █ 40
Wed: █ █ █ █ █ █ 80
Thu: █ █ █ █ █ 65
Fri: █ █ █ █ █ █ █ █ 110
**Top FAQ Intents**:
1. Table Timings
2. Pizza Combo Sizes
3. Delivery Radius
**Recent Conversations Log**:
${recentConversations.slice(-3).map((c, i) => `${i + 1}. "${c}"`).join('\n') || "1. No recent conversations"}`;
      
      addBotMessage(dashboard);
      return;
    }

    if (lowerText === 'toggle bot') {
       addBotMessage(`Use the Admin Panel to toggle bot status.`);
       return;
    }

    if (botStatus === 'OFF') {
      addBotMessage("Maazrat, SpiceHub AI Chatbot is temporarily offline by the Administrator for maintenance. Kindly use our web interface or contact support.");
      return;
    }

    recentConversations.push(text);
    if (recentConversations.length > 20) recentConversations.shift();

    // Session freeze after order completion
    if (chatState === 'COMPLETED') {
       addBotMessage("Your transaction has been finalized and this session is locked. Please refresh the page or click 'New Chat' to start a new order.");
       return;
    }

    if (lowerText === 'menu' || lowerText === 'main menu' || lowerText === 'view menu' || lowerText === 'aur menu dekhein' || lowerText.includes('menu')) {
       setChatState('MENU');
       const categoriesObj = MENU_ITEMS.reduce((acc, item) => {
         if (!acc[item.category]) acc[item.category] = [];
         acc[item.category].push(item);
         return acc;
       }, {} as Record<string, any[]>);
       const menuCategories = Object.keys(categoriesObj).map(cat => ({ category: cat, items: categoriesObj[cat] }));
       addBotMessage(
         currentLanguage === 'english' ? "Here is our menu. Please select a category or item to begin your order." : "Yeh hamara menu hai. Koi item select karein.",
         [], undefined, menuCategories
       );
       return;
    }

    if (lowerText === 'talk to agent') {
       addBotMessage(currentLanguage === 'english' ? "Connecting you to a live agent via WhatsApp..." : "WhatsApp par agent se connect kiya ja raha hai...");
       window.open("https://wa.me/923101155496", "_blank");
       return;
    }

    if (lowerText === 'book table') {
       setChatState('WAITING_FOR_GUESTS');
       addBotMessage(currentLanguage === 'english' ? "How many guests will be joining?" : "Kitne logon ki table book karni hai?");
       return;
    }

    if (lowerText === 'track order') {
       setChatState('TRACK_ORDER_ID');
       addBotMessage(currentLanguage === 'english' ? "Please enter your Order ID (Example: SPH123)" : "Apna Order ID type karein (Example: SPH123)");
       return;
    }

    // Checkout flow trigger
    if (lowerText === 'checkout' || lowerText === 'checkout karein' || lowerText.includes('checkout')) {
       if (orderCart.length === 0) {
          addBotMessage(currentLanguage === 'english' ? "Your cart is empty." : "Aapki cart khali hai.", ["Main Menu", "Order Now"]);
          setChatState('WELCOME');
       } else {
          setChatState('ORDERING_NAME');
          addBotMessage(currentLanguage === 'english' ? "To proceed with checkout, please type your Full Name (e.g. Ali Khan)." : "Order aage barhane ke liye apna Mukammal Naam type karein (misal ke taur par, Ali Khan).");
          setIsCartDrawerOpen(true);
       }
       return;
    }

    if (chatState === 'MENU' || chatState === 'WELCOME' || chatState === 'GENERAL') {
       // Category matching
       if (lowerText === 'burgers' || lowerText === 'burger') {
          addBotMessage("🍔 Zinger Burger - Rs. 450\n🍔 Cheese Blast - Rs. 550\n🍔 Grilled Jalapeno - Rs. 520\n🍔 Monster Burger - Rs. 750", ["Zinger Burger", "Cheese Blast", "Grilled Jalapeno", "Monster Burger"]);
          return;
       }
       if (lowerText === 'pizza') {
          addBotMessage("🍕 Chicken Tikka S (Rs. 600) / L (Rs. 1300)\n🍕 Creamy BBQ S (Rs. 650) / L (Rs. 1400)", ["Chicken Tikka S", "Chicken Tikka L", "Creamy BBQ S", "Creamy BBQ L"]);
          return;
       }
       if (lowerText === 'biryani') {
          addBotMessage("🍚 Chicken Dum Biryani - Rs. 380\n🍚 Special Mutton Biryani - Rs. 600", ["Chicken Dum Biryani", "Special Mutton Biryani"]);
          return;
       }
       if (lowerText === 'drinks') {
          addBotMessage("🥤 Cold Drink 350ml - Rs. 120\n💧 Mineral Water - Rs. 80", ["Cold Drink 350ml", "Mineral Water"]);
          return;
       }

       // Exact string typing match
       const exactMatch = MENU_ITEMS.find(m => m.name.toLowerCase() === lowerText);
       if (exactMatch) {
          setSelectedProduct({ name: exactMatch.name, price: exactMatch.price, category: exactMatch.category });
          setProductQty(1);
          setProductSize('Medium');
          return;
       }

       // NLP parsing via Grok for free text
       const aiRes = await extractIntent(text);
       if (aiRes.intent === "GUARDRAIL_BLOCKED") {
          addBotMessage(currentLanguage === 'english' ? "I can only assist with Spice Hub orders and bookings." : "Ye chatbot sirf Spice Hub restaurant ke orders aur bookings handle karne ke liye banaya gaya hai.");
          return;
       }
       if (aiRes.intent === "ITEM_NOT_FOUND") {
          addBotMessage(currentLanguage === 'english' ? "Sorry, that item is not on our menu. Please pick from Burgers, Pizza, Biryani, or Drinks." : "Maazrat, ye item hamare menu me maujood nahi hai. Khas taur par Burgers, Pizza, Biryani ya Drinks me se select karein.");
          return;
       }
       if (aiRes.intent === "ORDER_ITEM") {
          if (aiRes.quantity) {
             orderCart.push({ name: aiRes.item, price: aiRes.subtotal / aiRes.quantity, qty: aiRes.quantity });
             setCartTick(t => t + 1);
             setChatState('GENERAL'); // Will be overridden shortly
             addBotMessage(
               currentLanguage === 'english'
                 ? `${aiRes.quantity}x ${aiRes.item} added to cart! 🛒 View more menu or checkout?`
                 : `${aiRes.quantity}x ${aiRes.item} cart mein add ho gaye! 🛒 Kuch aur order karna hai ya bill banayein?`,
               currentLanguage === 'english' ? ["View More Menu", "Checkout"] : ["Aur Menu Dekhein", "Checkout Karein"]
             );
          } else {
             setPendingOrder({ name: aiRes.item, price: aiRes.subtotal });
             setChatState('WAITING_FOR_QUANTITY');
             addBotMessage(
               currentLanguage === 'english' 
                 ? `${aiRes.item} selected. How many would you like? (e.g. 1, 2)` 
                 : `${aiRes.item} select ho gaya. Kitni quantity chahiye? (Sirf number likhein, e.g., 1, 2)`
             );
          }
          return;
       }
       
      addBotMessage(currentLanguage === 'english' ? "I'm sorry, I didn't understand that. Please provide a valid input." : "Maazrat, main samajh nahi saka. Meharbani karke sahi detail type karein.", getInitialMessage(currentLanguage).pills);
       return;
    }

    if (chatState === 'WAITING_FOR_QUANTITY') {
       const qtyMatch = text.match(/\d+/);
       if (!qtyMatch) {
          addBotMessage(currentLanguage === 'english' ? "I didn't understand. Please provide just the quantity (e.g. 1, 2)." : "Maazrat, mujhe samajh nahi aaya. Meharbani karke sirf quantity digits me bataiye (e.g., 1, 2).");
          return;
       }
       const enteredQuantity = parseInt(qtyMatch[0]);
       orderCart.push({ name: pendingOrder.name, price: pendingOrder.price, qty: enteredQuantity });
       setCartTick(t => t + 1);
       
       setPendingOrder(null);
       setChatState('GENERAL'); // To wait for 'view more menu' or 'checkout'
       addBotMessage(
         currentLanguage === 'english'
           ? `${enteredQuantity}x ${orderCart[orderCart.length - 1].name} added to cart! 🛒 View more menu or checkout?`
           : `${enteredQuantity}x ${orderCart[orderCart.length - 1].name} cart mein add ho gaye! 🛒 Kuch aur order karna hai ya bill banayein?`,
         currentLanguage === 'english' ? ["View More Menu", "Checkout"] : ["Aur Menu Dekhein", "Checkout Karein"]
       );
       return;
    }

    if (chatState === 'ORDERING_NAME') {
       if (text.trim().length < 2) {
           addBotMessage(currentLanguage === 'english' ? "Name is missing or too short. Please provide your full name." : "Naam theek nahi hai. Barahe karam apna pura naam darj karein.");
           return;
       }
       setDeliveryInfo(prev => ({ ...prev, name: text.trim() }));
       setChatState('ORDERING_PHONE');
       addBotMessage(currentLanguage === 'english' ? "Thank you. Please type a valid 11-digit Pakistani mobile number (e.g. 03001234567)." : "Shukriya. Apna 11-digit mobile number likhein (e.g. 03001234567).");
       return;
    }

    if (chatState === 'ORDERING_PHONE') {
       const phoneMatch = text.match(/^((\+92)?(0092)?(92)?(0)?)(3[0-9]{2})[0-9]{7}$/);
       if (!phoneMatch) {
           addBotMessage(currentLanguage === 'english' ? "Invalid phone format. We require a valid 11-digit Pakistani mobile number." : "Mobile number theek nahi hai. Barahe karam sahi 11-digit Pakistani number likhein.");
           return;
       }
       setDeliveryInfo(prev => ({ ...prev, phone: text.trim() }));
       setChatState('ORDERING_ADDRESS');
       addBotMessage(currentLanguage === 'english' ? "Great! Lastly, please provide your complete Delivery Address (Street, Area, City)." : "Behtareen! Aakhir mein apna Mukammal Delivery Address (Street, Area, City) likhein.");
       return;
    }

    if (chatState === 'ORDERING_ADDRESS') {
       if (text.trim().length <= 5) {
          addBotMessage(currentLanguage === 'english' ? "Address is missing or too short. Please provide a complete delivery address." : "Address adhoora hai. Barahe karam mukammal pata faraham karein.");
          return;
       }
       const isValid = await validateAddress(text);
       if (!isValid) {
          addBotMessage(currentLanguage === 'english' ? "That address seems invalid. Please provide a complete and correct address." : "Maazrat, yeh address theek nahi lag raha. Apna mukammal aur sahi address type karein.");
          return;
       }

       setDeliveryInfo(prev => ({ ...prev, address: text.trim() }));
       const finalAddress = text.trim();

       const trackingId = "SPH" + Math.floor(1000 + Math.random() * 9000);
       let cartTotal = 0;
       let cartDetailsStr = "";
       orderCart.forEach(item => {
          cartTotal += item.price * item.qty;
          cartDetailsStr += `${item.qty}x ${item.name} (@Rs.${item.price}), `;
       });
       cartDetailsStr = cartDetailsStr.replace(/, $/, "");

       await supabase.from('orders').insert({
          id: trackingId, user_id: user.id, details: cartDetailsStr, address: finalAddress, total: cartTotal, status: 'Preparing'
       });
       const newOrder = { id: trackingId, details: cartDetailsStr, total: cartTotal, date: new Date().toISOString(), status: 'Preparing' };
       setOrderHistory(prev => [newOrder, ...prev]);
       setSuccessPopup({ title: 'Success!', message: `Order Confirmed!\nTracking ID: ${trackingId}`});
       addBotMessage(
         currentLanguage === 'english' ? `Order confirmed!\nTracking ID: ${trackingId}\nEstimated time: 30-40 min.` : `Aapka order confirm ho gaya hai! \nTracking ID: ${trackingId}\nDelivery time estimate: 30-40 min.`, 
         ["Track Order", "New Chat"],
         newOrder
       );
       setChatState('COMPLETED');
       orderCart = []; // Clear Cart
       setCartTick(t => t + 1); setIsCartDrawerOpen(false);
       return;
    }

    if (chatState === 'TRACK_ORDER_ID') {
       const inputID = text.trim().toUpperCase();
       const res = await supabase.from('orders').select('status').eq('id', inputID);
       if (res.data && res.data.length > 0) {
          const status = res.data[0].status;
          addBotMessage(currentLanguage === 'english' ? `Status for Order ${inputID}: ${status}.` : `Aapka Order ${inputID} ka status hai: ${status}.`, getInitialMessage(currentLanguage).pills);
       } else {
          addBotMessage(currentLanguage === 'english' ? "Sorry, this Order ID was not found." : "Maazrat, yeh Order ID record me nahi mili.");
       }
       setChatState('WELCOME');
       return;
    }

    if (chatState === 'WAITING_FOR_GUESTS') {
       const digitsMatch = text.match(/\d+/);
       if (!digitsMatch) {
          addBotMessage(currentLanguage === 'english' ? "I didn't understand. Please provide just the number of guests (e.g. 2, 4)." : "Maazrat, mujhe samajh nahi aaya. Meharbani karke sirf logon ki tadad digits me bataiye.");
          return;
       }
       const bookingGuests = digitsMatch[0];
       setPendingBooking({ guests: bookingGuests });
       setChatState('WAITING_FOR_TIME');
       addBotMessage(currentLanguage === 'english' ? "Which time slot do you prefer?" : "Kis time ka slot chahiye?", ["7 PM", "8 PM", "9 PM", "10 PM"]);
       return;
    }

    if (chatState === 'WAITING_FOR_TIME') {
       const timeMatch = text.match(/(7|setaat|8|aath|9|nau|10|das)(\s*PM)?/i);
       if (!timeMatch) {
          addBotMessage(currentLanguage === 'english' ? "Sorry, we only have 7 PM, 8 PM, 9 PM or 10 PM slots available." : "Maazrat, hamare paas sirf 7 PM se 10 PM tak ki table available hai.");
          return;
       }
       let mappedTime = timeMatch[1].toLowerCase();
       if (mappedTime === 'setaat') mappedTime = '7';
       if (mappedTime === 'aath') mappedTime = '8';
       if (mappedTime === 'nau') mappedTime = '9';
       if (mappedTime === 'das') mappedTime = '10';
       const bookingTime = mappedTime + " PM";
       setPendingBooking(prev => ({ ...prev, time: bookingTime }));
       setChatState('WAITING_FOR_NAME');
       addBotMessage(currentLanguage === 'english' ? "Please enter your full name to confirm the reservation." : "Booking confirm karne ke liye apna mukammal naam batayein.");
       return;
    }

    if (chatState === 'WAITING_FOR_NAME') {
       if (text.trim().length <= 2) {
           addBotMessage(currentLanguage === 'english' ? "Name is missing or too short. Please provide your full name." : "Naam theek nahi hai. Barahe karam apna pura naam darj karein.");
           return;
       }
       const bookingName = text.trim();
       setBookingInfo(prev => ({ ...prev, name: bookingName }));
       setChatState('WAITING_FOR_PHONE');
       addBotMessage(currentLanguage === 'english' ? "Finally, please provide a valid 11-digit Pakistani mobile number to confirm the booking." : "Booking confirm karne ke liye apna 11-digit mobile number likhein.");
       return;
    }

    if (chatState === 'WAITING_FOR_PHONE') {
       const phoneMatch = text.match(/^((\+92)?(0092)?(92)?(0)?)(3[0-9]{2})[0-9]{7}$/);
       if (!phoneMatch) {
           addBotMessage(currentLanguage === 'english' ? "Invalid phone format. We require a valid 11-digit Pakistani mobile number." : "Mobile number theek nahi hai. Barahe karam sahi 11-digit Pakistani number likhein.");
           return;
       }

       const phoneNum = text.trim();
       await supabase.from('bookings').insert({ user_id: user.id, customer_name: bookingInfo.name, guests: pendingBooking.guests, booking_time: pendingBooking.time });
       
       const newBooking = { id: 'TABLE-' + Math.floor(100+Math.random()*900), details: `Table for ${pendingBooking.guests} at ${pendingBooking.time}`, total: 0, date: new Date().toISOString(), status: 'Reserved' };
       setOrderHistory(prev => [newBooking, ...prev]);

       setSuccessPopup({ title: 'Booking Confirmed!', message: `Table reserved successfully for ${bookingInfo.name}.\nSee you at ${pendingBooking.time}!`});

       addBotMessage(
         currentLanguage === 'english' 
           ? `Reservation Confirmed! Name: ${bookingInfo.name}, Guests: ${pendingBooking.guests}, Time: ${pendingBooking.time}. We look forward to hosting you at the Gulshan Branch.` 
           : `Booking Confirm! Name: ${bookingInfo.name}, Guests: ${pendingBooking.guests}, Time: ${pendingBooking.time}. Gulshan Branch me aapka intezar rahega.`, 
         ["New Chat"]
       );
       setChatState('COMPLETED');
       setPendingBooking(null);
       return;
    }

    if (chatState === 'TALK_AGENT_PHONE') {
       addBotMessage(currentLanguage === 'english' ? "Thank you. Our agent will contact this number shortly." : "Shukriya. Hamara agent jald is number par aap se rabta karega.");
       setChatState('GENERAL');
       return;
    }
  };

  const handleReset = () => {
    setMessages([getInitialMessage(currentLanguage)]);
    setChatState('WELCOME');
    setPendingOrder(null);
    setPendingBooking(null);
  };

  const generatePDFReceipt = (order: any) => {
    const doc = new jsPDF();
    
    // Abstract Logo Background
    doc.setFillColor(239, 68, 68); // SpiceHub primary red approximate
    doc.rect(20, 15, 15, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("SH", 23, 25);

    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(22);
    doc.text("SpiceHub Elite Receipt", 40, 25);

    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Tracking ID: ${order.id}`, 20, 45);
    doc.text(`Date: ${new Date(order.date).toLocaleString()}`, 20, 55);
    
    // Receipt body
    doc.setFont("helvetica", "bold");
    doc.text("Order Details", 20, 70);
    doc.setLineWidth(0.2);
    doc.line(20, 72, 190, 72);

    doc.setFont("helvetica", "normal");
    let y = 78;
    const items = order.details.split(', ');
    items.forEach((item: string) => {
       const newMatch = item.match(/^(\d+)x\s+(.*?)\s+\(@Rs\.(\d+)\)$/);
       const oldMatch = item.match(/^(\d+)x\s+(.*)$/);
       
       if (newMatch) {
          const qty = parseInt(newMatch[1], 10);
          const name = newMatch[2].trim();
          const unitPrice = parseInt(newMatch[3], 10);
          const lineTotal = qty * unitPrice;
          const rowString = `${name} | Qty: ${qty} | ${qty} x ${unitPrice} | Total: Rs. ${lineTotal}`;
          doc.text(rowString, 20, y);
       } else if (oldMatch) {
          const qty = parseInt(oldMatch[1], 10);
          const name = oldMatch[2].trim();
          let unitPrice = 0;
          const menuItemDetails = MENU_ITEMS.find(m => m.name === name);
          if (menuItemDetails) {
            unitPrice = menuItemDetails.price;
          }
          const lineTotal = qty * unitPrice;
          const rowString = `${name} | Qty: ${qty} | ${qty} x ${unitPrice} | Total: Rs. ${lineTotal}`;
          doc.text(rowString, 20, y);
       } else {
          doc.text(item, 20, y);
       }
       y += 8;
    });

    const detailsHeight = y - 70;
    doc.setFont("helvetica", "bold");
    // Explicitly removed dashes/negative signs
    doc.text(`Total Amount: Rs. ${order.total}`, 20, 70 + detailsHeight + 10);
    
    // Status
    const statusY = 70 + detailsHeight + 25;
    doc.setFont("helvetica", "normal");
    doc.text(`Current Status: `, 20, statusY);
    doc.setTextColor(0, 150, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${order.status.toUpperCase()}`, 53, statusY);

    // Footer
    doc.setLineWidth(0.5);
    doc.line(20, 110 + detailsHeight, 190, 110 + detailsHeight);
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("Thank you for choosing SpiceHub Elite! Please visit again.", 20, 120 + detailsHeight);
    
    doc.save(`SpiceHub_Receipt_${order.id}.pdf`);
  };

  const onCancelOrder = async (orderId: string) => {
    try {
      await supabase.from('orders').delete().eq('id', orderId);
      setOrderHistory(prev => prev.filter(o => o.id !== orderId));
    } catch (e) {
      console.error("Error cancelling order", e);
    }
  };

  const markAsDelivered = async (orderId: string) => {
    try {
      await supabase.from('orders').update({ status: 'Delivered' }).eq('id', orderId);
      setOrderHistory(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Delivered' } : o));
      setReviewPopup(orderId);
    } catch (e) {
      console.error("Error updating order status", e);
    }
  };

  const submitReview = async () => {
    if (reviewPopup) {
       // Save review in db here if there's a table
       setSuccessPopup({ title: 'Feedback Submitted', message: 'Thank you for your review!' });
       setReviewPopup(null);
       setRating(5);
       setReviewText("");
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'Preparing') return 'text-amber-500 bg-amber-500/10';
    if (status === 'Out for Delivery') return 'text-blue-500 bg-blue-500/10';
    if (status === 'Delivered') return 'text-green-500 bg-green-500/10';
    return 'text-secondary bg-secondary/10';
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-base text-content">
      {/* Sidebar Navigation */}
      <motion.aside 
        onHoverStart={() => setIsSidebarOpen(true)}
        onHoverEnd={() => setIsSidebarOpen(false)}
        animate={{ width: isSidebarOpen ? 240 : 64 }}
        transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
        className="relative z-20 flex h-full shrink-0 flex-col items-center py-6 border-r border-border bg-surface shadow-2xl overflow-hidden"
      >
        <div className="flex shrink-0 items-center px-4 w-full">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center mx-auto rounded-xl bg-gradient-to-tr from-primary to-secondary text-white shadow-lg shadow-primary/20">
            <span className="font-bold italic">SH</span>
          </div>
          {isSidebarOpen && <span className="ml-4 overflow-hidden whitespace-nowrap text-lg font-bold tracking-tight text-content">SpiceHub Elite</span>}
        </div>
        <nav className="flex flex-1 flex-col gap-6 p-3 mt-8 w-full">
          <button onClick={handleReset} className="flex items-center justify-center rounded-lg p-3 hover:bg-surface-hover text-content transition-all group overflow-hidden">
            <MessageSquarePlus className="shrink-0 text-content-muted group-hover:text-primary transition-colors" size={24} />
            {isSidebarOpen && <span className="ml-4 flex-1 text-left whitespace-nowrap font-medium text-primary">New Chat</span>}
          </button>
          <button onClick={() => setShowOrderHistory(true)} className="flex items-center justify-center rounded-lg p-3 hover:bg-surface-hover text-content transition-all group overflow-hidden">
            <History className="shrink-0 text-content-muted group-hover:text-secondary transition-colors" size={24} />
            {isSidebarOpen && <span className="ml-4 flex-1 text-left whitespace-nowrap font-medium text-secondary">Order History</span>}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="flex items-center justify-center rounded-lg p-3 hover:bg-surface-hover text-content transition-all group overflow-hidden">
            <Settings className="shrink-0 text-content-muted group-hover:text-content transition-colors" size={24} />
            {isSidebarOpen && <span className="ml-4 flex-1 text-left whitespace-nowrap font-medium text-content">SpiceHub Control Panel</span>}
          </button>
          
          {isSidebarOpen && activeLiveOrders.length > 0 && (
             <div className="mt-6 px-3">
               <h3 className="text-xs font-black uppercase text-content-muted tracking-widest mb-3 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div> Active Orders
               </h3>
               <div className="flex flex-col gap-3">
                 {activeLiveOrders.map(order => (
                    <div key={order.id} className="bg-base border border-border p-3 rounded-xl flex flex-col gap-1.5 shadow-sm">
                       <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-content">{order.id}</span>
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold tracking-wide uppercase text-[10px]">{order.status}</span>
                       </div>
                       <span className="text-xs text-content-muted truncate">{order.details}</span>
                    </div>
                 ))}
               </div>
             </div>
          )}
        </nav>
      </motion.aside>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-base/80 px-6 backdrop-blur-md">
          <div className="flex items-center">
             <div className="relative flex items-center justify-center h-10 w-10 bg-primary/20 rounded-lg text-primary">
                <Sparkles size={20} />
             </div>
             <div className="ml-3 flex flex-col">
                <h1 className="text-sm font-black tracking-tight text-content uppercase">BiteBuddy Chat</h1>
             </div>
          </div>
          <div className="flex items-center gap-4">
             {orderCart.length > 0 && cartTick >= 0 && (
               <motion.div 
                   className="relative"
                   key={cartTick + "bounce"}
                   initial={{ scale: 1 }}
                   animate={{ scale: [1, 1.2, 0.9, 1.1, 1] }} 
                   transition={{ duration: 0.4 }}
               >
                 <button onClick={() => setIsCartDrawerOpen(!isCartDrawerOpen)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-hover text-primary hover:text-white hover:bg-primary transition-colors">
                   <ShoppingBag size={20} />
                 </button>
                 <motion.span 
                   key={cartTick}
                   initial={{ scale: 0.5 }}
                   animate={{ scale: 1 }}
                   className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white pointer-events-none shadow-sm"
                 >
                   {orderCart.reduce((acc, item) => acc + item.qty, 0)}
                 </motion.span>
               </motion.div>
             )}
             <button onClick={toggleTheme} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-hover text-content-muted hover:text-content">
               {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             <div className="flex items-center justify-center px-4 h-10 rounded-full bg-surface-hover text-sm font-bold text-content-muted hover:text-content hover:bg-border transition-colors cursor-default">
                {user.email}
             </div>
          </div>
        </header>

        {/* Main Area Body */}
        {showSettings ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-12 bg-base flex flex-col items-center justify-start">
            <div className="w-full max-w-2xl bg-surface border border-border p-8 rounded-2xl shadow-xl">
               <div className="flex items-center justify-between mb-8">
                 <h2 className="text-2xl font-bold flex items-center text-content"><Settings className="mr-3" /> Control Panel</h2>
                 <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-surface-hover text-content text-sm font-medium rounded-lg hover:bg-border transition-colors">Back to Chat</button>
               </div>
               <div className="space-y-8">
                 <div className="flex items-center justify-between p-4 bg-surface-hover rounded-xl border border-border">
                   <div>
                     <h3 className="font-bold text-content">Language Preference</h3>
                     <p className="text-xs text-content-muted mt-1">Choose bot conversation language.</p>
                   </div>
                   <select 
                     value={currentLanguage} 
                     onChange={(e) => {
                       const val = e.target.value as 'english' | 'roman_urdu';
                       setCurrentLanguage(val);
                       setMessages(prev => {
                         const newMsgs = [...prev];
                         if (newMsgs.length > 0 && newMsgs[0].id === '1') {
                           newMsgs[0] = getInitialMessage(val);
                         }
                         return newMsgs;
                       });
                     }} 
                     className="bg-surface border border-border text-content px-3 py-1.5 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                   >
                     <option value="english">English</option>
                     <option value="roman_urdu">Roman Urdu</option>
                   </select>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-surface-hover rounded-xl border border-border">
                   <div>
                     <h3 className="font-bold text-content">Clear Chat Logs</h3>
                     <p className="text-xs text-content-muted mt-1">Permanently clears active message threads.</p>
                   </div>
                   <button onClick={() => { handleReset(); setShowSettings(false); }} className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-sm font-bold hover:bg-red-500/20 transition-colors">Clear</button>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-surface-hover rounded-xl border border-border">
                   <div>
                     <h3 className="font-bold text-content">Sound Notifications</h3>
                     <p className="text-xs text-content-muted mt-1">Play sound on new messages.</p>
                   </div>
                   <button className="flex h-6 w-10 items-center rounded-full bg-primary p-1">
                     <div className="h-4 w-4 rounded-full bg-white translate-x-4 shadow-sm" />
                   </button>
                 </div>
                 <div className="p-4 bg-surface-hover rounded-xl border border-border">
                   <h3 className="font-bold text-content mb-4 flex items-center"><User className="mr-2" size={18}/> Customer Profile</h3>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <p className="text-xs text-content-muted">Email</p>
                       <p className="font-medium text-content">{user.email}</p>
                     </div>
                     <div>
                       <p className="text-xs text-content-muted">Tier Status</p>
                       <p className="font-medium text-amber-500">SpiceHub Elite</p>
                     </div>
                   </div>
                 </div>
                 
                 <div className="flex items-center justify-between p-5 bg-red-500/10 rounded-xl border border-red-500/20 relative z-10 w-full overflow-visible box-border">
                   <div>
                     <h3 className="font-bold text-red-500 text-lg">End Active Session</h3>
                     <p className="text-xs text-red-400 mt-1">Disconnect this device and securely clear application state.</p>
                   </div>
                   <button onClick={onLogout} className="px-6 py-3 bg-red-500 text-white rounded-lg text-sm font-black uppercase tracking-wider hover:bg-red-600 active:scale-95 transition-all shadow-md shrink-0 block static visible opacity-100 cursor-pointer z-20">Logout Session</button>
                 </div>
               </div>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Body */}
            <div 
              ref={scrollRef} 
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 flex flex-col"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                const button = target.closest('button[data-pill]');
                if (button) {
                  const pillText = button.getAttribute('data-pill');
                  if (pillText) {
                    handlePillClick(pillText);
                  }
                }
              }}
            >
              {messages.map(msg => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id} 
                  className={cn("flex w-full mb-6", msg.role === 'user' ? "justify-end ml-auto max-w-2xl" : "justify-start max-w-3xl")}
                >
                  <div className={cn("flex w-full", msg.role === 'user' ? "items-start justify-end space-x-4 ml-auto" : "items-start space-x-4")}>
                    {msg.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-primary/20">BB</div>
                    )}
                    <div className={cn("flex flex-col space-y-2 w-full", msg.role === 'user' ? "items-end" : "items-start")}>
                      <div className={cn(
                        "p-4 rounded-2xl w-fit",
                        msg.role === 'user' 
                          ? "bg-primary text-white rounded-tr-none shadow-lg shadow-primary/20" 
                          : "bg-surface-hover text-content rounded-tl-none border border-border shadow-xl"
                      )}>
                        {msg.isLoading ? (
                           <div className="flex items-center h-5 gap-1">
                             <motion.div animate={{ opacity: [0.4,1,0.4] }} transition={{ repeat: Infinity, duration: 1.2 }} className="h-1.5 w-1.5 rounded-full bg-content-muted"/>
                             <motion.div animate={{ opacity: [0.4,1,0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="h-1.5 w-1.5 rounded-full bg-content-muted"/>
                             <motion.div animate={{ opacity: [0.4,1,0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="h-1.5 w-1.5 rounded-full bg-content-muted"/>
                           </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                        )}
                      </div>
                      {msg.pills && msg.pills.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {msg.pills.map((pill, i) => (
                            <button 
                              key={i} 
                              data-pill={pill}
                              className="bg-primary text-white hover:bg-secondary rounded-lg px-4 py-2 text-xs font-bold transition-all border-none"
                            >
                              {pill}
                            </button>
                          ))}
                        </div>
                      )}
                      {msg.menuCategories && msg.menuCategories.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 w-full">
                           {msg.menuCategories.map((cat, i) => {
                             // Distinctive category accent colors
                             const catBg = cat.category === 'Burgers' ? 'bg-amber-500/10' :
                                           cat.category === 'Pizza' ? 'bg-red-500/10' :
                                           cat.category === 'Biryani' ? 'bg-orange-500/10' :
                                           'bg-blue-500/10';
                             const catBorder = cat.category === 'Burgers' ? 'border-amber-500/20' :
                                           cat.category === 'Pizza' ? 'border-red-500/20' :
                                           cat.category === 'Biryani' ? 'border-orange-500/20' :
                                           'border-blue-500/20';
                             const catText = cat.category === 'Burgers' ? 'text-amber-600 dark:text-amber-400' :
                                           cat.category === 'Pizza' ? 'text-red-600 dark:text-red-400' :
                                           cat.category === 'Biryani' ? 'text-orange-600 dark:text-orange-400' :
                                           'text-blue-600 dark:text-blue-400';
                             
                             return (
                              <div key={i} className={`p-4 rounded-2xl border ${catBg} ${catBorder} shadow-sm backdrop-blur-sm`}>
                                 <h4 className={`font-black text-lg ${catText} mb-3 flex items-center gap-2`}>
                                     {cat.category === 'Burgers' ? '🍔' : cat.category === 'Pizza' ? '🍕' : cat.category === 'Biryani' ? '🍚' : '🥤'} {cat.category}
                                 </h4>
                                 <div className="flex flex-col gap-2">
                                     {cat.items.map((item: any, j: number) => (
                                        <button 
                                            key={j} 
                                            data-pill={item.name} 
                                            className="text-left w-full bg-base/50 hover:bg-base/80 p-2.5 rounded-xl transition-all flex justify-between items-center group shadow-sm"
                                        >
                                           <span className="font-bold text-sm text-content group-hover:text-primary transition-colors">{item.name}</span>
                                           <div className="bg-surface px-2 py-1 rounded text-xs font-black text-content-muted">Rs. {item.price}</div>
                                        </button>
                                     ))}
                                 </div>
                              </div>
                             );
                           })}
                        </div>
                      )}
                      {msg.orderData && (
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => generatePDFReceipt(msg.orderData)} className="flex items-center gap-2 bg-base border border-border text-primary hover:bg-primary/10 rounded-lg px-3 py-2 text-xs font-bold transition-colors">
                                <Download size={14}/> Download Receipt
                            </button>
                            <button onClick={() => onCancelOrder(msg.orderData.id)} className="flex items-center gap-2 bg-base border border-border text-red-500 hover:bg-red-500/10 rounded-lg px-3 py-2 text-xs font-bold transition-colors">
                                <XCircle size={14}/> Cancel Order
                            </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input Footer */}
            <div className="p-6 bg-base/90 border-t border-border relative">
               <div className="mx-auto flex max-w-4xl items-center space-x-4 bg-surface-hover p-2 rounded-2xl border border-border shadow-inner">
                 <button className="p-3 text-content-muted hover:text-white transition-colors">
                   <Paperclip size={20} />
                 </button>
                 <input 
                   type="text"
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSend()}
                   placeholder="Ask BiteBuddy or type your order..."
                   className="flex-1 bg-transparent px-2 border-none focus:ring-0 text-sm text-content placeholder-content-muted focus:outline-none"
                 />
                 <button 
                   onClick={() => handleSend()}
                   disabled={!input.trim()}
                   className="p-3 bg-gradient-to-r from-primary to-secondary rounded-xl shadow-lg shadow-primary/30 text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                 >
                   <Send size={20} className="translate-x-[1px]" />
                 </button>
               </div>
               <div className="flex justify-center mt-3">
                 <p className="text-[10px] text-content-muted font-mono tracking-widest uppercase">SECURED BY SPICE-CORE v2.4.1</p>
               </div>
            </div>
          </>
        )}

        {/* Overlays */}
        <AnimatePresence>
          {isCartDrawerOpen && (
             <motion.div key="cart-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex justify-end">
               <motion.div 
                 key="cart-drawer-content"
                 initial={{ x: "100%", opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 exit={{ x: "100%", opacity: 0 }}
                 transition={{ type: "spring", stiffness: 300, damping: 30 }}
                 className="w-full max-w-2xl bg-base h-full shadow-2xl flex flex-col p-6 overflow-y-auto border-l border-border"
               >
                 <div className="flex justify-between items-center pb-6 border-b border-border">
                   <h2 className="text-3xl font-black text-primary flex items-center gap-3">
                      <ShoppingBag size={32}/> Global Cart Contents
                   </h2>
                   <button onClick={() => setIsCartDrawerOpen(false)} className="text-content-muted hover:text-red-500 transition-colors p-2 bg-surface-hover rounded-full">
                      <XCircle size={32} />
                   </button>
                 </div>
               
                 {orderCart.length === 0 ? (
                  <div className="py-24 text-center flex flex-col items-center justify-center gap-4 flex-1">
                     <ShoppingBag size={64} className="text-content-muted opacity-50" />
                     <p className="font-bold text-content-muted text-xl">Your cart is completely empty.</p>
                  </div>
               ) : (
                 <div className="flex flex-col flex-1 mt-6 w-full">
                   <div className="flex flex-col gap-4 overflow-y-auto pr-2 pb-10">
                     {orderCart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-surface-hover p-4 rounded-xl border border-border">
                           <div className="flex items-center gap-4">
                              <span className="bg-primary/20 text-primary font-black px-3 py-1.5 rounded-lg text-lg">{item.qty}x</span>
                              <span className="font-bold text-content text-xl">{item.name}</span>
                           </div>
                           <span className="font-black text-primary text-xl">Rs. {item.price * item.qty}</span>
                        </div>
                     ))}
                   </div>
                   <div className="pt-6 border-t border-border flex justify-between items-center mt-auto pb-4 sticky bottom-0 bg-base">
                     <span className="font-black text-3xl text-content">Total: Rs. {orderCart.reduce((acc, item) => acc + item.price * item.qty, 0)}</span>
                     <button onClick={() => { handleSend("Checkout"); setIsCartDrawerOpen(false); }} className="bg-primary text-white hover:bg-primary/90 px-10 py-4 rounded-xl font-black text-xl transition-transform hover:scale-[1.02] active:scale-95 shadow-2xl shadow-primary/30">
                       Checkout Now
                     </button>
                   </div>
                 </div>
               )}
               </motion.div>
             </motion.div>
          )}
          {showOrderHistory && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center">
               <div className="w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl relative">
                 <h2 className="text-xl font-bold mb-4 flex items-center text-content"><ShoppingBag className="mr-2" /> Your Order History</h2>
                 <div className="space-y-3 h-64 overflow-y-auto">
                   {orderHistory.length === 0 ? (
                     <div className="p-3 bg-surface-hover rounded-xl text-sm text-center text-content-muted">
                        No past orders found in local cache.
                     </div>
                   ) : (
                     orderHistory.map((order, idx) => (
                       <div key={idx} className="p-4 bg-surface-hover rounded-xl border border-border text-sm flex flex-col gap-2 relative group">
                         <div className="flex justify-between items-center text-content">
                           <span className="font-bold">{order.id}</span>
                           <span className="text-primary font-bold">Rs. {order.total}</span>
                         </div>
                         <p className="text-content-muted">{order.details}</p>
                         <div className="flex justify-between items-center mt-1">
                           <div>
                             <span className="text-[10px] text-content-muted block">{new Date(order.date).toLocaleString()}</span>
                             <span className={cn("text-xs px-2 py-0.5 rounded-full inline-block mt-1 font-medium", getStatusColor(order.status))}>{order.status}</span>
                           </div>
                           <div className="flex items-center gap-2">
                             {order.status !== 'Delivered' && (
                               <button onClick={() => markAsDelivered(order.id)} className="flex items-center justify-center w-8 h-8 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors" title="Mark as Delivered test">
                                 <CheckCircle size={16} />
                               </button>
                             )}
                             {order.status === 'Preparing' && (
                               <button onClick={() => onCancelOrder(order.id)} className="flex items-center justify-center w-8 h-8 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors" title="Cancel Order">
                                 <XCircle size={16} />
                               </button>
                             )}
                             <button onClick={() => generatePDFReceipt(order)} className="flex items-center justify-center w-8 h-8 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors" title="Download PDF Receipt">
                               <Download size={16} />
                             </button>
                           </div>
                         </div>
                       </div>
                     ))
                   )}
                 </div>
                 <button onClick={() => setShowOrderHistory(false)} className="mt-6 w-full py-2 bg-primary font-bold text-white rounded-lg hover:bg-primary/90 transition-colors">Close</button>
               </div>
             </motion.div>
          )}
          {successPopup && (
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center">
               <div className="w-full max-w-sm bg-surface flex flex-col items-center p-8 rounded-3xl shadow-2xl border border-border">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                     <Check size={32} className="text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-content mb-2 text-center">{successPopup.title}</h2>
                  <p className="text-content-muted text-center mb-6 whitespace-pre-line">{successPopup.message}</p>
                  <button onClick={() => setSuccessPopup(null)} className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-transform">Done</button>
               </div>
             </motion.div>
          )}

          {reviewPopup && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl">
                <h2 className="text-xl font-bold mb-2 text-center text-content">Rate Your Order</h2>
                <p className="text-sm text-content-muted text-center mb-6">How was your experience with order {reviewPopup}?</p>
                <div className="flex justify-center gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setRating(star)} className="focus:outline-none hover:scale-110 transition-transform">
                      <Star size={32} className={star <= rating ? "text-amber-500 fill-amber-500" : "text-border"} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Optional: Tell us more about your experience..."
                  className="w-full h-24 bg-surface-hover border border-border rounded-xl p-3 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                />
                <div className="flex gap-3">
                  <button onClick={() => setReviewPopup(null)} className="flex-1 py-2 bg-surface-hover text-content text-sm font-bold rounded-lg hover:bg-border transition-colors">Skip</button>
                  <button onClick={submitReview} className="flex-1 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors">Submit Review</button>
                </div>
              </div>
            </motion.div>
          )}

          {selectedProduct && (
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="w-full max-w-md bg-surface border border-border p-6 rounded-3xl shadow-2xl relative">
                  <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 text-content-muted hover:text-content">
                    <XCircle size={24} />
                  </button>
                  
                  <div className="flex items-center gap-4 mb-6">
                     <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                        <ShoppingBag size={32} />
                     </div>
                     <div>
                        <h2 className="text-2xl font-black">{selectedProduct.name}</h2>
                         <p className="text-content-muted">{selectedProduct.category}</p>
                     </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                        <p className="font-bold mb-3">Select Size</p>
                        <div className="flex gap-3">
                            {['Small', 'Medium', 'Large'].map((s) => (
                                <button 
                                    key={s} 
                                    onClick={() => setProductSize(s as any)}
                                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${productSize === s ? 'bg-primary border-primary text-white shadow-md' : 'bg-surface border-border text-content hover:bg-surface-hover'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="font-bold mb-3">Quantity</p>
                        <div className="flex items-center gap-4 border border-border bg-surface rounded-xl p-2 w-fit">
                            <button onClick={() => setProductQty(Math.max(1, productQty - 1))} className="p-2 rounded-lg bg-surface-hover text-content hover:bg-border transition-colors">-</button>
                            <span className="font-bold w-4 text-center">{productQty}</span>
                            <button onClick={() => setProductQty(productQty + 1)} className="p-2 rounded-lg bg-surface-hover text-content hover:bg-border transition-colors">+</button>
                        </div>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row gap-3">
                     <button onClick={() => {
                         const sizeMultiplier = productSize === 'Small' ? 0.8 : productSize === 'Large' ? 1.3 : 1;
                         const finalPrice = Math.round(selectedProduct.price * sizeMultiplier);
                         orderCart.push({ name: `${selectedProduct.name} (${productSize})`, price: finalPrice, qty: productQty });
                         setCartTick(t => t + 1); 
                         setSelectedProduct(null);
                         setChatState('GENERAL');

                         const cartTotal = orderCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
                         const hasDrink = orderCart.some(item => item.name.toLowerCase().includes('drink') || item.name.toLowerCase().includes('water'));
                         let comboMsg = "";
                         if (cartTotal > 1000 && !hasDrink) {
                             comboMsg = currentLanguage === 'english' 
                               ? "\n\n💡 Combo Deal: Your order is over Rs. 1000! Would you like to add a Cold Drink?"
                               : "\n\n💡 Combo Deal: Aapka bill Rs. 1000 se zyada hai! Cold Drink add karein?";
                         }

                         addBotMessage(
                           currentLanguage === 'english'
                             ? `${productQty}x ${selectedProduct.name} (${productSize}) added to cart! 🛒${comboMsg}`
                             : `${productQty}x ${selectedProduct.name} (${productSize}) cart mein add ho gaye! 🛒${comboMsg}`,
                           currentLanguage === 'english' 
                              ? (comboMsg ? ["Cold Drink 350ml", "Menu", "Checkout"] : ["Menu", "Checkout"])
                              : (comboMsg ? ["Cold Drink 350ml", "Menu", "Checkout"] : ["Menu", "Checkout"])
                         );
                     }} className="flex-1 py-4 bg-surface-hover border border-border text-content text-sm font-bold tracking-wide rounded-2xl hover:bg-surface transition-all">
                       Add to Cart • Rs. {Math.round(selectedProduct.price * (productSize === 'Small' ? 0.8 : productSize === 'Large' ? 1.3 : 1) * productQty)}
                     </button>

                     <button onClick={() => {
                         const sizeMultiplier = productSize === 'Small' ? 0.8 : productSize === 'Large' ? 1.3 : 1;
                         const finalPrice = Math.round(selectedProduct.price * sizeMultiplier);
                         orderCart.push({ name: `${selectedProduct.name} (${productSize})`, price: finalPrice, qty: productQty });
                         setCartTick(t => t + 1); 
                         setSelectedProduct(null);
                         handleSend('Checkout');
                     }} className="flex-1 py-4 bg-primary text-white text-sm font-black tracking-wide rounded-2xl shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all">
                       Proceed to Checkout
                     </button>
                  </div>
               </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
