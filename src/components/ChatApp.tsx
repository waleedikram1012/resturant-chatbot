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
};

const getInitialMessage = (lang: 'english' | 'roman_urdu'): Message => ({
  id: '1',
  role: 'assistant',
  text: lang === 'english' ? "Welcome to Spice Hub! I can help you place an order or book a table." : "Spice Hub me khush amdeed! Main aapka order aur booking handle karunga.",
  pills: ["View Menu", "Order Now", "Book Table", "Track Order", "Talk to Agent"]
});

let orderCart: any[] = [];

export function ChatApp({ user, onLogout, toggleTheme, theme }: { user: any, onLogout: () => void, toggleTheme: () => void, theme: string }) {
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chatState, setChatState] = useState<'WELCOME' | 'MENU' | 'WAITING_FOR_QUANTITY' | 'ORDERING_ADDRESS' | 'WAITING_FOR_GUESTS' | 'WAITING_FOR_TIME' | 'WAITING_FOR_NAME' | 'TRACK_ORDER_ID' | 'TALK_AGENT_PHONE' | 'GENERAL'>('WELCOME');

  
  // Pending order/booking states
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [pendingBooking, setPendingBooking] = useState<any>(null);

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

  const addBotMessage = (text: string, pills?: string[]) => {
    setMessages(prev => [...prev.filter(m => !m.isLoading), { id: crypto.randomUUID(), role: 'assistant', text, pills }]);
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

    // Reset loop if triggered menu
    if (lowerText === 'main menu') {
       handleReset();
       return;
    }

    if (lowerText === 'view menu' || lowerText === 'order now') {
       setChatState('MENU');
       addBotMessage(
         currentLanguage === 'english' ? "What would you like to order? We offer Burgers, Pizza, Biryani, and Drinks." : "Aap kya khana pasand karenge? Hamare paas Burgers, Pizza, Biryani, aur Drinks hain.", 
         ["Burgers", "Pizza", "Biryani", "Drinks"]
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

    if (lowerText === 'view more menu' || lowerText === 'aur menu dekhein' || lowerText.includes('menu')) {
       setChatState('MENU');
       addBotMessage(
         currentLanguage === 'english' ? "What would you like to order? We offer Burgers, Pizza, Biryani, and Drinks." : "Aap kya khana pasand karenge? Hamare paas Burgers, Pizza, Biryani, aur Drinks hain.", 
         ["Burgers", "Pizza", "Biryani", "Drinks"]
       );
       return;
    }

    if (lowerText === 'checkout' || lowerText === 'checkout karein' || lowerText.includes('checkout')) {
       if (orderCart.length === 0) {
          addBotMessage(currentLanguage === 'english' ? "Your cart is empty." : "Aapki cart khali hai.", getInitialMessage(currentLanguage).pills);
          setChatState('WELCOME');
       } else {
          let total = 0;
          let details = currentLanguage === 'english' ? "Your Full Order:\n" : "Aapka Mukammal Order:\n";
          orderCart.forEach(item => {
             total += item.price * item.qty;
             details += `- ${item.qty}x ${item.name} (Rs. ${item.price * item.qty})\n`;
          });
          details += `\nGrand Total: Rs. ${total}\n\n`;
          details += currentLanguage === 'english' ? "Please type your complete Delivery Address to confirm." : "Order confirm karne ke liye apna mukammal Delivery Address type karein.";
          
          setChatState('ORDERING_ADDRESS');
          addBotMessage(details);
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
          setPendingOrder({ name: exactMatch.name, price: exactMatch.price });
          setChatState('WAITING_FOR_QUANTITY');
          addBotMessage(
            currentLanguage === 'english' 
              ? `${exactMatch.name} selected. How many would you like? (e.g. 1, 2)` 
              : `${exactMatch.name} select ho gaya. Kitni quantity chahiye? (Sirf number likhein, e.g., 1, 2)`
          );
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

    if (chatState === 'ORDERING_ADDRESS') {
       const isValid = await validateAddress(text);
       if (!isValid) {
          addBotMessage(currentLanguage === 'english' ? "That address seems invalid. Please provide a complete and correct address." : "Maazrat, yeh address theek nahi lag raha. Apna mukammal aur sahi address type karein.");
          return;
       }

       const trackingId = "SPH" + Math.floor(1000 + Math.random() * 9000);
       let cartTotal = 0;
       let cartDetailsStr = "";
       orderCart.forEach(item => {
          cartTotal += item.price * item.qty;
          cartDetailsStr += `${item.qty}x ${item.name}, `;
       });
       cartDetailsStr = cartDetailsStr.replace(/, $/, "");

       await supabase.from('orders').insert({
          id: trackingId, user_id: user.id, details: cartDetailsStr, address: text, total: cartTotal, status: 'Preparing'
       });
       setOrderHistory(prev => [{ id: trackingId, details: cartDetailsStr, total: cartTotal, date: new Date().toISOString(), status: 'Preparing' }, ...prev]);
       setSuccessPopup({ title: 'Success!', message: `Order Confirmed!\nTracking ID: ${trackingId}`});
       addBotMessage(currentLanguage === 'english' ? `Order confirmed!\nTracking ID: ${trackingId}\nEstimated time: 30-40 min.` : `Aapka order confirm ho gaya hai! \nTracking ID: ${trackingId}\nDelivery time estimate: 30-40 min.`, ["Track Order", "View Menu"]);
       setChatState('GENERAL');
       orderCart = []; // Clear Cart
       return;
    }

    if (chatState === 'TRACK_ORDER_ID') {
       const inputID = text.trim().toUpperCase();
       const res = await supabase.from('orders').select('status').eq('id', inputID);
       if (res.data && res.data.length > 0) {
          const status = res.data[0].status;
          addBotMessage(currentLanguage === 'english' ? `Status for Order ${inputID}: ${status}.` : `Aapka Order ${inputID} ka status hai: ${status}.`, ["View Menu"]);
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
       addBotMessage(currentLanguage === 'english' ? "Which time slot do you prefer? (Available: 7 PM, 8 PM, 9 PM)" : "Kis time ka slot chahiye? (Available: 7 PM, 8 PM, 9 PM)");
       return;
    }

    if (chatState === 'WAITING_FOR_TIME') {
       const timeMatch = text.match(/[789]/);
       if (!timeMatch) {
          addBotMessage(currentLanguage === 'english' ? "Sorry, we only have 7 PM, 8 PM, or 9 PM slots available." : "Maazrat, hamare paas sirf 7 PM, 8 PM, aur 9 PM ki table available hai. Inme se koi ek time type karein.");
          return;
       }
       const bookingTime = timeMatch[0] + " PM";
       setPendingBooking(prev => ({ ...prev, time: bookingTime }));
       setChatState('WAITING_FOR_NAME');
       addBotMessage(currentLanguage === 'english' ? "Please enter your full name to confirm the reservation." : "Booking confirm karne ke liye apna mukammal naam batayein.");
       return;
    }

    if (chatState === 'WAITING_FOR_NAME') {
       const bookingName = text;
       await supabase.from('bookings').insert({ user_id: user.id, customer_name: bookingName, guests: pendingBooking.guests, booking_time: pendingBooking.time });
       
       const newBooking = { id: 'TABLE-' + Math.floor(100+Math.random()*900), details: `Table for ${pendingBooking.guests} at ${pendingBooking.time}`, total: 0, date: new Date().toISOString(), status: 'Reserved' };
       setOrderHistory(prev => [newBooking, ...prev]);

       addBotMessage(
         currentLanguage === 'english' 
           ? `Reservation Confirmed! Name: ${bookingName}, Guests: ${pendingBooking.guests}, Time: ${pendingBooking.time}. We look forward to hosting you at the Gulshan Branch.` 
           : `Booking Confirm! Name: ${bookingName}, Guests: ${pendingBooking.guests}, Time: ${pendingBooking.time}. Gulshan Branch me aapka intezar rahega.`, 
         ["View Menu"]
       );
       setChatState('WELCOME');
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
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Spice Hub Receipt", 20, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(`Tracking/Booking ID: ${order.id}`, 20, 40);
    doc.text(`Date: ${new Date(order.date).toLocaleString()}`, 20, 50);
    doc.text(`Details: ${order.details}`, 20, 60);
    doc.text(`Total amount: Rs. ${order.total}`, 20, 70);
    doc.text(`Current Status: ${order.status}`, 20, 80);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Thank you for choosing Spice Hub! Have a great day.", 20, 100);
    
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
        </nav>
      </motion.aside>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-base/80 px-6 backdrop-blur-md">
          <div className="flex items-center">
             <div className="relative flex items-center justify-center h-10 w-10 bg-primary rounded-lg text-white shadow-lg shadow-primary/20">
                <Sparkles size={20} />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-base animate-pulse"></div>
             </div>
             <div className="ml-3 flex flex-col">
                <div className="flex items-center gap-2">
                   <h1 className="text-sm font-bold tracking-tight text-white uppercase">BiteBuddy</h1>
                </div>
                <div className="flex items-center">
                   <p className="text-[10px] text-content-muted font-mono tracking-widest uppercase">#SPICEBOT-ELITE • ONLINE</p>
                </div>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={toggleTheme} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-hover text-content-muted hover:text-content">
               {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             <div className="group relative">
                <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary font-bold text-white shadow-md">
                   {user.email?.[0].toUpperCase()}
                </div>
                <div className="absolute right-0 top-full mt-2 hidden w-48 flex-col rounded-xl border border-border bg-surface p-2 shadow-xl group-hover:flex z-50">
                   <span className="px-3 py-2 text-xs font-medium text-content-muted truncate">{user.email}</span>
                   <hr className="my-1 border-border" />
                   <button onClick={onLogout} className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-surface-hover">
                      <LogOut size={16} className="mr-2" /> Logout
                   </button>
                </div>
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
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input Footer */}
            <div className="p-6 bg-base/90 border-t border-border">
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
        </AnimatePresence>
      </div>
    </div>
  );
}
