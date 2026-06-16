import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Paperclip,
  Send,
  Settings,
  History,
  MessageSquarePlus,
  MapPin,
  LogOut,
  Loader2,
  Sparkles,
  AlertCircle,
  ShoppingBag,
  Facebook,
  Youtube,
  Twitter,
  Instagram,
  CalendarClock,
  Package,
  Headphones,
  Check,
  Sun,
  Moon,
  Bell,
  User,
  Phone,
  Download,
  XCircle,
  Star,
  CheckCircle,
  UtensilsCrossed,
  Monitor,
  Smartphone,
  X,
  RefreshCw,
  Flame,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { extractIntent, validateAddress } from "../lib/grok";
import { jsPDF } from "jspdf";
import { cn } from "../lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant" | "admin";
  text: string;
  pills?: string[];
  isLoading?: boolean;
  orderData?: any;
  trackingData?: { status: string; id: string };
  menuCategories?: { category: string; items: any[] }[];
  isEscalation?: boolean;
  showCalendar?: boolean;
};

const getInitialMessage = (): Message => ({
  id: "1",
  role: "assistant",
  text: "Spice Hub me khush amdeed! Main aapka order aur booking handle karunga.",
  pills: ["Menu", "Book Table", "Track Order", "Talk to Agent"],
});

let orderCart: any[] = [];
let recentConversations: string[] = [];

const MENU_ITEMS = [
  { name: "🍗 Chicken Tikka Boti", price: 650, category: "BBQ & Grill" },
  { name: "🍖 Beef Seekh Kebab", price: 800, category: "BBQ & Grill" },
  { name: "🍢 Malai Boti", price: 750, category: "BBQ & Grill" },
  { name: "🔥 Mutton Chops Grill", price: 1500, category: "BBQ & Grill" },
  
  { name: "🥘 Chicken Karahi (Half)", price: 1200, category: "Karahi & Handi" },
  { name: "🥘 Mutton Karahi (Full)", price: 3500, category: "Karahi & Handi" },
  { name: "🍛 Chicken Makhni Handi", price: 1400, category: "Karahi & Handi" },
  { name: "♨️ Paneer Reshmi Handi", price: 1100, category: "Karahi & Handi" },
  
  { name: "🍛 Chicken Dum Biryani", price: 450, category: "Biryani & Rice" },
  { name: "🍲 Special Mutton Biryani", price: 750, category: "Biryani & Rice" },
  { name: "🍚 Beef Pulao", price: 600, category: "Biryani & Rice" },
  { name: "🥘 Kabuli Pulao", price: 800, category: "Biryani & Rice" },
  
  { name: "🥣 Nihari with Nalli", price: 900, category: "Traditional Curries" },
  { name: "🍲 Haleem Special", price: 650, category: "Traditional Curries" },
  { name: "🍛 Paya Special", price: 1100, category: "Traditional Curries" },
  { name: "🥘 Maghaz Karahi", price: 1200, category: "Traditional Curries" },

  { name: "🍔 Zinger Burger", price: 450, category: "Fast Food" },
  { name: "🍕 Chicken Tikka Pizza", price: 1200, category: "Fast Food" },
  { name: "🌯 Chicken Roti Roll", price: 350, category: "Fast Food" },
  { name: "🍟 Loaded Fries", price: 400, category: "Fast Food" },

  { name: "🍨 Kheer Special", price: 250, category: "Desserts & Sweets" },
  { name: "🍧 Gulab Jamun (4 pcs)", price: 200, category: "Desserts & Sweets" },
  { name: "🍮 Rabri Falooda", price: 350, category: "Desserts & Sweets" },
  { name: "🍰 Gajar Ka Halwa", price: 300, category: "Desserts & Sweets" },

  { name: "🍹 Mango Lassi", price: 250, category: "Beverages" },
  { name: "☕ Karak Chai", price: 100, category: "Beverages" },
  { name: "🥤 Rooh Afza Sharbat", price: 150, category: "Beverages" },
  { name: "💧 Mineral Water (Small)", price: 80, category: "Beverages" }
];

export function ChatApp({
  user,
  onLogout,
  toggleTheme,
  theme,
  botStatus,
  onLoginClick,
  isAdminOpen,
  setIsAdminOpen,
}: {
  user: any;
  onLogout: () => void;
  toggleTheme: () => void;
  theme: string;
  botStatus: "ON" | "OFF";
  onLoginClick?: () => void;
  isAdminOpen?: boolean;
  setIsAdminOpen?: (open: boolean) => void;
}) {
  const currentLanguage: string = "roman_urdu";
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("spicehub_chat_messages");
    return saved ? JSON.parse(saved) : [getInitialMessage()];
  });
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    "profile" | "config" | "layout"
  >("profile");
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [successPopup, setSuccessPopup] = useState<{
    title: string;
    message: string;
    trackingId?: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const [reviewPopup, setReviewPopup] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [cartTick, setCartTick] = useState(0);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showToast = (
    message: string,
    action?: { label: string; onClick: () => void },
  ) => {
    setToastMessage({ message, action });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const scheduleReminder = (timeStr: string) => {
    // Expected timeStr "7 PM", "8 PM", etc.
    // In a real app we'd parse exact Date obj, here we mock it by triggering after 10s for demo
    if ("Notification" in window && Notification.permission === "granted") {
      setTimeout(() => {
        new Notification("SpiceHub Reservation Reminder", {
          body: `Your table reservation is confirmed for ${timeStr}. We look forward to hosting you!`,
          icon: "/favicon.ico",
        });
      }, 10000); // Demo simulation 10 seconds. Real world: (bookedTime - 3600000 - Date.now())
    }
  };
  const cartDrawerRef = useRef<HTMLDivElement>(null);
  const settingsModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      let container: HTMLDivElement | null = null;
      if (isCartDrawerOpen && cartDrawerRef.current)
        container = cartDrawerRef.current;
      else if (showSettings && settingsModalRef.current)
        container = settingsModalRef.current;

      if (!container) return;

      const focusableElements = container.querySelectorAll<HTMLElement>(
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener("keydown", handleFocusTrap);

    // Auto focus first element when opened
    let container: HTMLDivElement | null = null;
    if (isCartDrawerOpen && cartDrawerRef.current)
      container = cartDrawerRef.current;
    else if (showSettings && settingsModalRef.current)
      container = settingsModalRef.current;

    if (container) {
      const focusableElements = container.querySelectorAll<HTMLElement>(
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusableElements.length > 0) {
        // Use setTimeout to ensure DOM is ready and animation started
        setTimeout(() => {
          focusableElements[0].focus();
        }, 100);
      }
    }

    return () => document.removeEventListener("keydown", handleFocusTrap);
  }, [isCartDrawerOpen, showSettings]);

  const [chatState, setChatState] = useState<
    | "WELCOME"
    | "MENU"
    | "WAITING_FOR_SIZE"
    | "WAITING_FOR_QUANTITY"
    | "ORDERING_NAME"
    | "ORDERING_PHONE"
    | "ORDERING_ADDRESS"
    | "ORDERING_NOTES"
    | "WAITING_FOR_GUESTS"
    | "WAITING_FOR_DATE"
    | "WAITING_FOR_TIME"
    | "WAITING_FOR_NAME"
    | "WAITING_FOR_PHONE"
    | "TRACK_ORDER_ID"
    | "TALK_AGENT_PHONE"
    | "GENERAL"
    | "COMPLETED"
  >(() => {
    const saved = localStorage.getItem("spicehub_chat_state");
    return saved ? (saved as any) : "WELCOME";
  });

  const [deliveryInfo, setDeliveryInfo] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [bookingInfo, setBookingInfo] = useState({ name: "", phone: "" });

  // Pending order/booking states
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productSize, setProductSize] = useState<"Small" | "Medium" | "Large">(
    "Medium",
  );
  const [productQty, setProductQty] = useState<number>(1);
  const [pendingBooking, setPendingBooking] = useState<any>(null);
  const [activeLiveOrders, setActiveLiveOrders] = useState<any[]>([]);
  const [pastConversations, setPastConversations] = useState<any[]>([]);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("All");
  const [landingPageCategory, setLandingPageCategory] = useState("All");
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);

  useEffect(() => {
    setIsLoadingMenu(true);
    const timer = setTimeout(() => {
      setIsLoadingMenu(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [landingPageCategory]);

  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactFormStatus, setContactFormStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [itemFrequencies, setItemFrequencies] = useState<Record<string, number>>({});
  const [preChatForm, setPreChatForm] = useState(() => {
    const saved = localStorage.getItem("spicehub_prechat");
    return saved
      ? JSON.parse(saved)
      : { name: "", email: "", phone: "", complete: false, error: "" };
  });
  const sessionId = useRef(() => {
    const s = localStorage.getItem("spicehub_session_id");
    if (s) return s;
    const newId = crypto.randomUUID();
    localStorage.setItem("spicehub_session_id", newId);
    return newId;
  });
  if (typeof sessionId.current === "function") {
    sessionId.current = (sessionId.current as any)();
  }
  const [viewMode, setViewMode] = useState<"PC" | "MOBILE">("MOBILE");
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const [checkoutComplete, setCheckoutComplete] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [flyingCartItems, setFlyingCartItems] = useState<{id: string, startX: number, startY: number, emoji: string}[]>([]);
  const [activeBotConfig, setActiveBotConfig] = useState<any>(null);

  useEffect(() => {
    try {
      const activeId = localStorage.getItem("spicehub_live_bot_id");
      const savedBots = localStorage.getItem("spicehub_chatbots");
      const menuString = MENU_ITEMS.map(item => `'${item.name}' (${item.price})`).join(", ");
      const defaultBot = { id: 'sh-1', name: 'SpiceHub AI', desc: 'Main ordering bot', prompt: `You are an expert restaurant concierge for SpiceHub. You must converse 100% in natural, friendly humanized Roman Urdu. Never switch to formal English paragraphs.
          Here is our FULL MENU, always use these exact items and prices:
          ${menuString}
          
          Rule 1: If the user mentions an item without volume or variation, DO NOT say "item not available". ALWAYS output exactly:
          { "intent": "SINGLE_ORDER_ITEM", "item": "<Matched Item Name>", "subtotal": <Base Price> }
          Note: The system will automatically ask the user for Size and Quantity when you output SINGLE_ORDER_ITEM without quantity.
          
          Rule 2: If the user confirms specific items with quantities, extract them into the cart array:
          { "intent": "MULTI_ORDER_ITEM", "items": [{ "quantity": 2, "item": "Zinger Burger", "subtotal": 900 }], "response": "Maine aapke items cart me add kar diye hain. Aur kuch chahiye aapko?" }

          Rule 3: Intelligently match informal or partial item names (e.g., "Burger" -> "Zinger Burger", "Biryani" -> "Chicken Dum Biryani"). Pick the most popular match instead of failing. NEVER fail with ITEM_NOT_FOUND if the category exists.
          
          Rule 4: If an item is completely unrelated and absolutely not on the menu at all (e.g., "Laptop", "Sushi"), output:
          { "intent": "ITEM_NOT_FOUND" }
          
          Rule 5: If the user indicates they are done ordering, output:
          { "intent": "CHECKOUT_READY", "response": "Zabardast! Chaliye checkout ki taraf chalte hain." }
          
          Rule 6: For general food questions or conversational input, respond naturally:
          { "intent": "CONVERSATIONAL", "response": "Zaroor, humare chefs aapke taste ke hisaab se best cheez bana sakte hain. Aapko tikka pasand hai ya creamy?" }
          
          Rule 7: For out-of-context topics like programming, output { "intent": "GUARDRAIL_BLOCKED" }.` };

      let foundBot = defaultBot;
      if (savedBots) {
         const bots = JSON.parse(savedBots);
         if (activeId) {
             const matched = bots.find((b: any) => b.id === activeId);
             if (matched) foundBot = matched;
         } else if (bots.length > 0) {
             foundBot = bots[0];
         }
      }
      setActiveBotConfig(foundBot);
    } catch(e) {}
  }, []);

  useEffect(() => {
    const handleBotUpdate = (e: any) => {
      setActiveBotConfig(e.detail);
      if (e.detail) {
          localStorage.setItem("spicehub_live_bot_id", e.detail.id);
      } else {
          localStorage.removeItem("spicehub_live_bot_id");
      }
      setMessages([]);
      sessionId.current = crypto.randomUUID();
    };
    window.addEventListener("ADMIN_UPDATE_BOT_CONFIG", handleBotUpdate);
    return () => window.removeEventListener("ADMIN_UPDATE_BOT_CONFIG", handleBotUpdate);
  }, []);

  useEffect(() => {
    async function loadItemFrequencies() {
      try {
        const { data } = await supabase.from("orders").select("details");
        if (data && data.length > 0) {
          const itemFreq: Record<string, number> = {};
          data.forEach(order => {
             const details = order.details || "";
             const items = details.split(", ");
             items.forEach((token: string) => {
                const match = token.match(/(\d+)x\s+(.+?)\s+\(@Rs\.\d+\)/);
                if (match) {
                  const qty = parseInt(match[1]);
                  const name = match[2];
                  itemFreq[name] = (itemFreq[name] || 0) + qty;
                }
             });
          });
          setItemFrequencies(itemFreq);
        }
      } catch (err) {}
    }
    loadItemFrequencies();
  }, []);

  useEffect(() => {
    async function loadHistory() {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from("message_logs")
            .select("messages, session_id")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();
          if (data && data.messages && data.messages.length > 0) {
            const localSaved = localStorage.getItem("spicehub_chat_messages");
            const localMessages = localSaved ? JSON.parse(localSaved) : [];
            const currentSession = localStorage.getItem("spicehub_session_id");
            if (
              !localSaved || 
              data.session_id !== currentSession || 
              data.messages.length >= localMessages.length
            ) {
              setMessages(data.messages);
              sessionId.current = data.session_id;
              localStorage.setItem("spicehub_session_id", data.session_id);
            }
          }
        } catch (err) {
          console.warn("Failed to lookup message logs", err);
        }
      }
    }
    loadHistory();
  }, [user?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (e.key === "Escape") {
        setShowShortcuts(false);
        setIsCartDrawerOpen(false);
        setShowSettings(false);
        setShowOrderHistory(false);
        setReviewPopup(null);
        setSuccessPopup(null);
      }
      if (e.key && e.key.toLowerCase() === "n" && (e.altKey || e.ctrlKey)) {
        // Provide an alternative or handle Alt+N to reset chat
        // Optional: you can implement a reset chat if you want
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "spicehub_chat_messages",
      JSON.stringify(messages.filter((m) => !m.isLoading)),
    );
    localStorage.setItem("spicehub_chat_state", chatState);
    localStorage.setItem("spicehub_prechat", JSON.stringify(preChatForm));

    // Matrix Sync - Fire & forget sync to historical chat log
    if (user?.id && messages.length > 1) {
      supabase
        .from("message_logs")
        .upsert({
          session_id: sessionId.current,
          user_id: user.id,
          messages: messages.filter((m) => !m.isLoading),
          updated_at: new Date().toISOString(),
        })
        .then();
    }

    const sessionData = {
      id: sessionId.current,
      visitorName: user?.email || "Visitor",
      timestamp: new Date().toISOString(),
      metadata: {
        browser: navigator.userAgent,
        landingPage: window.location.href,
      },
    };
    window.dispatchEvent(
      new CustomEvent("APP_CHAT_SYNC", { detail: { sessionData, messages } }),
    );
  }, [messages]);

  useEffect(() => {
    const overrideListener = (e: any) => {
      if (e.detail.sessionId === sessionId.current) {
        setMessages((prev) => [
          ...prev.filter((m) => !m.isLoading),
          { id: crypto.randomUUID(), role: "admin", text: e.detail.text },
        ]);
      }
    };
    window.addEventListener("ADMIN_OVERRIDE", overrideListener);
    return () => window.removeEventListener("ADMIN_OVERRIDE", overrideListener);
  }, []);

  useEffect(() => {
    // Request permission on mount if needed
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const fetchActiveOrders = async () => {
      const res = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "Delivered");
      if (res.data) {
        setActiveLiveOrders(res.data);
      }
    };
    const fetchConversations = async () => {
      const res = await supabase
        .from("message_logs")
        .select("session_id, messages, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (res.data) {
        setPastConversations(res.data);
      }
    };
    fetchActiveOrders();
    fetchConversations();

    // Live update loop for conversations and orders
    const convInterval = setInterval(() => {
      fetchConversations();
      fetchActiveOrders();
    }, 5000);

    const subscription = supabase
      .channel("public:orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          fetchActiveOrders();
          if (payload.eventType === "UPDATE") {
            if (
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              new Notification(`SpiceHub Order Update`, {
                body: `Your order ${payload.new.id} is now: ${payload.new.status}`,
              });
            }
          }
        },
      )
      .subscribe();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Intentionally left blank or can be removed completely.
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearInterval(convInterval);
      supabase.removeChannel(subscription);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    user.id,
    showSettings,
    showOrderHistory,
    successPopup,
    reviewPopup,
    isCartDrawerOpen,
    selectedProduct,
  ]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const addBotMessage = (
    text: string,
    pills?: string[],
    orderData?: any,
    trackingData?: any,
    menuCategories?: any[],
    showCalendar?: boolean,
  ) => {
    setMessages((prev) => [
      ...prev.filter((m) => !m.isLoading),
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text,
        pills,
        orderData,
        trackingData,
        menuCategories,
        showCalendar,
      },
    ]);
  };

  const handlePillClick = (pillText: string) => {
    handleSend(pillText);
  };

  const handleSend = async (customText?: string | React.MouseEvent) => {
    const text = typeof customText === "string" ? customText : input;
    if (!text.trim()) return;

    setInput("");
    const userMsgId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", text }]);

    // Show typing indicator
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", text: "", isLoading: true },
    ]);

    // State machine logic
    const lowerText = text.toLowerCase();

    if (lowerText.includes("escalate")) {
      addBotMessage(
        currentLanguage === "english"
          ? "I am escalating this to a human agent. Please wait..."
          : "Main isey human agent ke paas bhej raha hoon. Intezar farmayein...",
        [],
      );
      return;
    }

    // Admin Commands
    if (
      lowerText === "show admin dashboard" ||
      lowerText === "admin log analytics"
    ) {
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
${
  recentConversations
    .slice(-3)
    .map((c, i) => `${i + 1}. "${c}"`)
    .join("\n") || "1. No recent conversations"
}`;

      addBotMessage(dashboard);
      return;
    }

    if (lowerText === "toggle bot") {
      addBotMessage(`Use the Admin Panel to toggle bot status.`);
      return;
    }

    if (botStatus === "OFF") {
      addBotMessage(
        "Maazrat, SpiceHub AI Chatbot is temporarily offline by the Administrator for maintenance. Kindly use our web interface or contact support.",
      );
      return;
    }

    recentConversations.push(text);
    if (recentConversations.length > 20) recentConversations.shift();

    if (lowerText === "new chat" || lowerText === "restart") {
      handleReset();
      return;
    }

    if (lowerText === "track order") {
      setChatState("TRACK_ORDER_ID");
      addBotMessage(
        currentLanguage === "english"
          ? "Please enter your Order Tracking ID to view your progression:"
          : "Apna Order Tracking ID darj karein:",
      );
      return;
    }

    // Session freeze after order completion
    if (chatState === "COMPLETED") {
      if (lowerText !== "track order" && lowerText !== "new chat") {
        return;
      }
    }

    if (
      lowerText === "menu" ||
      lowerText === "main menu" ||
      lowerText === "view menu" ||
      lowerText === "aur menu dekhein" ||
      lowerText.includes("menu")
    ) {
      setChatState("MENU");

      const categoriesObj = MENU_ITEMS.reduce(
        (acc, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
          return acc;
        },
        {} as Record<string, any[]>,
      );
      const menuCategories = Object.keys(categoriesObj).map((cat) => ({
        category: cat,
        items: categoriesObj[cat],
      }));
      addBotMessage(
        currentLanguage === "english"
          ? "Here is our menu. Please select a category or item to begin your order."
          : "Yeh hamara menu hai. Koi item select karein.",
        [],
        undefined,
        undefined,
        menuCategories,
      );
      return;
    }

    if (lowerText === "talk to agent") {
      addBotMessage(
        currentLanguage === "english"
          ? "Connecting you to a live agent via WhatsApp..."
          : "WhatsApp par agent se connect kiya ja raha hai...",
      );
      window.open("https://wa.me/923101155496", "_blank");
      return;
    }

    if (lowerText === "book table") {
      setChatState("WAITING_FOR_GUESTS");
      addBotMessage(
        currentLanguage === "english"
          ? "How many guests will be joining?"
          : "Kitne logon ki table book karni hai?",
      );
      return;
    }

    if (lowerText === "track order") {
      setChatState("TRACK_ORDER_ID");
      addBotMessage(
        currentLanguage === "english"
          ? "Please enter your Order ID (Example: SPH123)"
          : "Apna Order ID type karein (Example: SPH123)",
      );
      return;
    }

    // Checkout flow trigger
    if (
      lowerText === "checkout" ||
      lowerText === "checkout karein" ||
      lowerText.includes("checkout")
    ) {
      if (orderCart.length === 0) {
        addBotMessage(
          currentLanguage === "english"
            ? "Your cart is empty."
            : "Aapki cart khali hai.",
          ["Main Menu", "Order Now"],
        );
        setChatState("WELCOME");
      } else {
        setChatState("ORDERING_NAME");
        addBotMessage(
          currentLanguage === "english"
            ? "To proceed with checkout, please type your Full Name."
            : "Order aage barhane ke liye apna Mukammal Naam type karein.",
        );
        setIsCartDrawerOpen(true);
      }
      return;
    }

    if (
      chatState === "MENU" ||
      chatState === "WELCOME" ||
      chatState === "GENERAL"
    ) {
      // 2. HARDCODED KEYWORD ROUTER (BEFORE AI PROCESSING)
      // Rule A: Category Match
      const categoryMap = [
        { keys: ["dessert", "desserts", "sweet", "sweets", "meetha", "ice cream"], category: "Desserts & Sweets" },
        { keys: ["drink", "drinks", "beverage", "beverages", "water", "paani", "cold drink"], category: "Beverages" },
        { keys: ["burger", "burgers", "pizza", "fast food", "fries", "roll"], category: "Fast Food" },
        { keys: ["bbq", "grill", "tikka", "kebab", "boti", "seekh"], category: "BBQ & Grill" },
        { keys: ["karahi", "handi", "makhni"], category: "Karahi & Handi" },
        { keys: ["biryani", "rice", "pulao", "chawal"], category: "Biryani & Rice" },
        { keys: ["curry", "curries", "traditional", "nihari", "haleem", "paya", "maghaz"], category: "Traditional Curries" }
      ];

      let matchedCategory = null;
      for (const map of categoryMap) {
        if (map.keys.some(k => lowerText.includes(k))) {
          matchedCategory = map.category;
          break;
        }
      }

      if (matchedCategory) {
        const categoryItems = MENU_ITEMS.filter(m => m.category === matchedCategory);
        const itemListStr = categoryItems.map(m => `${m.name} - Rs.${m.price}`).join("\n");
        const itemPills = categoryItems.map(m => m.name.replace(/^[^\w\s]+/g, '').trim());

        addBotMessage(
          currentLanguage === "english"
            ? `Here is our ${matchedCategory} menu! What would you like to try?\n\n${itemListStr}`
            : `Yeh raha hamara ${matchedCategory} menu! Aap kya pasand karenge?\n\n${itemListStr}`,
          itemPills
        );
        setChatState("MENU");
        return;
      }

      // Rule B: Item Match
      const cleanInput = lowerText.replace(/[^a-z0-9\s]/g, "").trim();
      const inputTokens = cleanInput.split(/\s+/).filter((t) => t.length > 2);

      let softMatch = MENU_ITEMS.find((m) => m.name.toLowerCase() === lowerText);

      if (!softMatch) {
        for (const item of MENU_ITEMS) {
          const cleanItemName = item.name
            .toLowerCase()
            .replace(/[^\x00-\x7F]/g, "")
            .trim()
            .replace(/[^a-z0-9\s]/g, "");

          if (cleanItemName.length > 3 && cleanInput.includes(cleanItemName)) {
            softMatch = item;
            break;
          }

          const itemTokens = cleanItemName.split(/\s+/).filter((t) => t.length > 2);
          for (const token of inputTokens) {
            if (
              itemTokens.includes(token) ||
              (token.endsWith("s") && itemTokens.includes(token.slice(0, -1)))
            ) {
              softMatch = item;
              break;
            }
          }
          if (softMatch) break;
        }
      }

      if (softMatch) {
        setPendingOrder({ name: softMatch.name, price: softMatch.price });
        setChatState("WAITING_FOR_SIZE");
        addBotMessage(
          currentLanguage === "english"
            ? `Excellent choice! What size would you like for ${softMatch.name}? (Small, Medium, Large)`
            : `Zabardast! Aapko ${softMatch.name} Small mein chahiye, Medium, ya Large?`,
        );
        return;
      }

      // NLP parsing via Grok for free text
      let rawHistory = messages.filter(m => !m.isLoading && !m.isSystem && m.text && m.text.trim().length > 0).slice(-10);
      let msgHistory: any[] = [];
      // Ensure strict alternating roles as required by Gemini
      for (const msg of rawHistory) {
        const role = msg.role === 'user' ? 'user' : 'model';
        const text = msg.text.trim();
        if (msgHistory.length > 0 && msgHistory[msgHistory.length - 1].role === role) {
          msgHistory[msgHistory.length - 1].parts[0].text += `\n${text}`;
        } else {
          msgHistory.push({ role, parts: [{ text }] });
        }
      }
      
      const aiRes = await extractIntent(text, activeBotConfig?.prompt, msgHistory);
      if (
        aiRes.intent === "ESCALATE" ||
        aiRes.intent === "ESCALATION_TRIGGER" ||
        aiRes.text?.includes("ESCALATE") ||
        lowerText.includes("escalate")
      ) {
        setMessages((prev) => [
          ...prev.filter((m) => !m.isLoading),
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: aiRes.response || "",
            isEscalation: true,
          },
        ]);
        window.dispatchEvent(
          new CustomEvent("ADMIN_ESCALATE", {
            detail: { sessionId: sessionId.current },
          }),
        );
        return;
      }
      if (aiRes.intent === "GUARDRAIL_BLOCKED") {
        addBotMessage(
          currentLanguage === "english"
            ? "I can only assist with Spice Hub orders and bookings."
            : "Ye chatbot sirf Spice Hub restaurant ke orders aur bookings handle karne ke liye banaya gaya hai.",
        );
        return;
      }
      if (aiRes.intent === "ITEM_NOT_FOUND") {
        addBotMessage(
          currentLanguage === "english"
            ? "Sorry, that item is not available on our menu. Would you like to have something else?"
            : "Maazrat, yeh item humare menu mein available nahi hai. Kya aap kuch aur lena pasand karenge?",
          ["Yes", "No"],
        );
        return;
      }
      if (
        lowerText === "no" ||
        lowerText === "nahi" ||
        aiRes.intent === "CHECKOUT_READY"
      ) {
        addBotMessage(
          currentLanguage === "english"
            ? "Alright! Let's proceed to checkout."
            : "Theek hai! Chaliye checkout ki taraf aate hain.",
          ["Checkout"],
        );
        setIsCartDrawerOpen(true);
        return;
      }
      if (aiRes.intent === "CONVERSATIONAL") {
        addBotMessage(aiRes.response);
        return;
      }
      if (
        aiRes.intent === "MULTI_ORDER_ITEM" &&
        aiRes.items &&
        aiRes.items.length > 0
      ) {
        aiRes.items.forEach((item: any) => {
          orderCart.push({
            name: item.item,
            price: item.subtotal / item.quantity,
            qty: item.quantity,
          });
        });
        setCartTick((t) => t + 1);
        showToast("Items added to cart", {
          label: "View Cart",
          onClick: () => setIsCartDrawerOpen(true),
        });
        setChatState("GENERAL");
        addBotMessage(
          aiRes.response || "I have added those to your cart. Anything else?",
        );
        return;
      }
      if (aiRes.intent === "ORDER_ITEM" || aiRes.intent === "SINGLE_ORDER_ITEM") {
        if (aiRes.quantity) {
          orderCart.push({
            name: aiRes.item,
            price: aiRes.subtotal / aiRes.quantity,
            qty: aiRes.quantity,
          });
          setCartTick((t) => t + 1);
          setChatState("GENERAL"); // Will be overridden shortly
          addBotMessage(
            currentLanguage === "english"
              ? `${aiRes.quantity}x ${aiRes.item} added to cart! 🛒 View more menu or checkout?`
              : `${aiRes.quantity}x ${aiRes.item} cart mein add ho gaye! 🛒 Kuch aur order karna hai ya bill banayein?`,
            currentLanguage === "english"
              ? ["View More Menu", "Checkout"]
              : ["Aur Menu Dekhein", "Checkout Karein"],
          );
        } else {
          setPendingOrder({ name: aiRes.item, price: aiRes.subtotal });
          setChatState("WAITING_FOR_SIZE");
          addBotMessage(
            currentLanguage === "english"
              ? `Great choice! Would you like your ${aiRes.item} in Small, Medium, or Large?`
              : `Zabardast! Aapko ${aiRes.item} Small mein chahiye, Medium, ya Large?`
          );
        }
        return;
      }

      addBotMessage(
        currentLanguage === "english"
          ? "I'm sorry, I didn't understand that. Please provide a valid input."
          : "Maazrat, main samajh nahi saka. Meharbani karke sahi detail type karein.",
        getInitialMessage().pills,
      );
      return;
    }

    if (chatState === "WAITING_FOR_SIZE") {
      const lowerText = text.toLowerCase();
      let size = "Medium"; // Default
      if (lowerText.includes("small") || lowerText.includes("chhota")) size = "Small";
      else if (lowerText.includes("large") || lowerText.includes("bara") || lowerText.includes("bada")) size = "Large";
      
      setPendingOrder({ ...pendingOrder, name: `${pendingOrder.name} (${size})` });
      setChatState("WAITING_FOR_QUANTITY");
      addBotMessage(
        currentLanguage === "english"
          ? `${size} size selected. How many would you like to order?`
          : `${size} size select ho gaya. Kitni quantity chahiye?`
      );
      return;
    }

    if (chatState === "WAITING_FOR_QUANTITY") {
      const qtyMatch = text.match(/\d+/);
      if (!qtyMatch) {
        addBotMessage(
          currentLanguage === "english"
            ? "I didn't understand. Please provide just the quantity."
            : "Maazrat, mujhe samajh nahi aaya. Meharbani karke sirf quantity digits me bataiye.",
        );
        return;
      }
      const enteredQuantity = parseInt(qtyMatch[0]);
      orderCart.push({
        name: pendingOrder.name,
        price: pendingOrder.price,
        qty: enteredQuantity,
      });
      setCartTick((t) => t + 1);
      showToast("Item added to cart", {
        label: "View Cart",
        onClick: () => setIsCartDrawerOpen(true),
      });

      setPendingOrder(null);
      setChatState("GENERAL"); // To wait for 'view more menu' or 'checkout'
      addBotMessage(
        currentLanguage === "english"
          ? `${enteredQuantity}x ${orderCart[orderCart.length - 1].name} added to cart! 🛒 View more menu or checkout?`
          : `${enteredQuantity}x ${orderCart[orderCart.length - 1].name} cart mein add ho gaye! 🛒 Kuch aur order karna hai ya bill banayein?`,
        currentLanguage === "english"
          ? ["View More Menu", "Checkout"]
          : ["Aur Menu Dekhein", "Checkout Karein"],
      );
      return;
    }

    if (chatState === "ORDERING_NAME") {
      if (text.trim().length < 2) {
        addBotMessage(
          currentLanguage === "english"
            ? "Name is missing or too short. Please provide your full name."
            : "Naam theek nahi hai. Barahe karam apna pura naam darj karein.",
        );
        return;
      }
      setDeliveryInfo((prev) => ({ ...prev, name: text.trim() }));
      setChatState("ORDERING_PHONE");
      addBotMessage(
        currentLanguage === "english"
          ? "Thank you. Please type your 11-digit mobile number."
          : "Shukriya. Apna 11-digit mobile number likhein.",
      );
      return;
    }

    if (chatState === "ORDERING_PHONE") {
      const phoneMatch = text.match(
        /^((\+92)?(0092)?(92)?(0)?)(3[0-9]{2})[0-9]{7}$/,
      );
      if (!phoneMatch) {
        addBotMessage(
          currentLanguage === "english"
            ? "Invalid phone format. We require a valid 11-digit Pakistani mobile number."
            : "Mobile number theek nahi hai. Barahe karam sahi 11-digit Pakistani number likhein.",
        );
        return;
      }
      setDeliveryInfo((prev) => ({ ...prev, phone: text.trim() }));
      setChatState("ORDERING_ADDRESS");
      addBotMessage(
        currentLanguage === "english"
          ? "Great! Lastly, please provide your delivery address."
          : "Behtareen! Aakhir mein apna delivery address likhein.",
      );
      return;
    }

    if (chatState === "ORDERING_ADDRESS") {
      if (text.trim().length <= 5) {
        addBotMessage(
          currentLanguage === "english"
            ? "Address is missing or too short. Please provide a complete delivery address."
            : "Address adhoora hai. Barahe karam mukammal pata faraham karein.",
        );
        return;
      }
      const isValid = await validateAddress(text);
      if (!isValid) {
        addBotMessage(
          currentLanguage === "english"
            ? "That address seems invalid. Please provide a complete and correct address."
            : "Maazrat, yeh address theek nahi lag raha. Apna mukammal aur sahi address type karein.",
        );
        return;
      }

      setDeliveryInfo((prev) => ({ ...prev, address: text.trim() }));
      setChatState("ORDERING_NOTES");
      addBotMessage(
        currentLanguage === "english"
          ? "Any optional order notes? Write 'No' to skip."
          : "Koi order notes hain? Agar nahi to 'No' likhein.",
      );
      return;
    }

    if (chatState === "ORDERING_NOTES") {
      const finalNotes =
        lowerText === "no" || lowerText === "none" || lowerText === "skip"
          ? ""
          : text.trim();
      setDeliveryInfo((prev) => ({ ...prev, notes: finalNotes }));

      const trackingId = "SPH" + Math.floor(1000 + Math.random() * 9000);
      let cartTotal = 0;
      let cartDetailsStr = "";
      orderCart.forEach((item) => {
        cartTotal += item.price * item.qty;
        cartDetailsStr += `${item.qty}x ${item.name} (@Rs.${item.price}), `;
      });
      cartDetailsStr = cartDetailsStr.replace(/, $/, "");

      await supabase.from("orders").insert({
        id: trackingId,
        user_id: user.id,
        details: cartDetailsStr,
        address: deliveryInfo.address,
        total: cartTotal,
        status: "Preparing",
        notes: finalNotes,
      });
      const newOrder = {
        id: trackingId,
        details: cartDetailsStr,
        total: cartTotal,
        date: new Date().toISOString(),
        status: "Preparing",
        notes: finalNotes,
      };
      setOrderHistory((prev) => [newOrder, ...prev]);
      setSuccessPopup({
        title: "Success!",
        message: `Your order has been received successfully.`,
        trackingId: trackingId,
      });
      addBotMessage(
        currentLanguage === "english"
          ? `Order confirmed!\nTracking ID: ${trackingId}\nEstimated time: 30-40 min.`
          : `Aapka order confirm ho gaya hai! \nTracking ID: ${trackingId}\nDelivery time estimate: 30-40 min.`,
        ["Track Order", "New Chat"],
        newOrder,
      );
      setChatState("COMPLETED");
      orderCart = []; // Clear Cart
      setCartTick((t) => t + 1);
      setIsCartDrawerOpen(false);
      return;
    }

    if (chatState === "TRACK_ORDER_ID") {
      const inputID = text.trim().toUpperCase();
      const res = await supabase
        .from("orders")
        .select("status")
        .eq("id", inputID);
      if (res.data && res.data.length > 0) {
        const status = res.data[0].status;
        addBotMessage(
          currentLanguage === "english"
            ? `Status for Order ${inputID}:`
            : `Aapke Order ${inputID} ka status:`,
          getInitialMessage().pills,
          undefined, // orderData
          { status, id: inputID }, // trackingData
        );
      } else {
        addBotMessage(
          currentLanguage === "english"
            ? "Sorry, this Order ID was not found."
            : "Maazrat, yeh Order ID record me nahi mili.",
        );
      }
      setChatState("WELCOME");
      return;
    }

    if (chatState === "WAITING_FOR_GUESTS") {
      const digitsMatch = text.match(/\d+/);
      if (!digitsMatch) {
        addBotMessage(
          currentLanguage === "english"
            ? "I didn't understand. Please provide just the number of guests."
            : "Maazrat, mujhe samajh nahi aaya. Meharbani karke sirf logon ki tadad digits me bataiye.",
        );
        return;
      }
      const bookingGuests = digitsMatch[0];
      setPendingBooking({ guests: bookingGuests });
      setChatState("WAITING_FOR_DATE");
      addBotMessage(
        currentLanguage === "english"
          ? "Please select a date for your reservation:"
          : "Baraye meharbani booking ki tareekh select karein:",
        [],
        undefined,
        undefined,
        undefined,
        true,
      );
      return;
    }

    if (chatState === "WAITING_FOR_DATE") {
      setPendingBooking((prev: any) => ({ ...prev, date: text.trim() }));
      setChatState("WAITING_FOR_TIME");
      addBotMessage(
        currentLanguage === "english"
          ? "Which time slot do you prefer?"
          : "Kis time ka slot chahiye?",
        ["7 PM", "8 PM", "9 PM", "10 PM"],
      );
      return;
    }

    if (chatState === "WAITING_FOR_TIME") {
      const timeMatch = text.match(/(7|setaat|8|aath|9|nau|10|das)(\s*PM)?/i);
      if (!timeMatch) {
        addBotMessage(
          currentLanguage === "english"
            ? "Sorry, we only have 7 PM, 8 PM, 9 PM or 10 PM slots available."
            : "Maazrat, hamare paas sirf 7 PM se 10 PM tak ki table available hai.",
        );
        return;
      }
      let mappedTime = timeMatch[1].toLowerCase();
      if (mappedTime === "setaat") mappedTime = "7";
      if (mappedTime === "aath") mappedTime = "8";
      if (mappedTime === "nau") mappedTime = "9";
      if (mappedTime === "das") mappedTime = "10";
      const bookingTime = mappedTime + " PM";
      setPendingBooking((prev) => ({ ...prev, time: bookingTime }));
      setChatState("WAITING_FOR_NAME");
      addBotMessage(
        currentLanguage === "english"
          ? "Please enter your full name to confirm the reservation."
          : "Booking confirm karne ke liye apna mukammal naam batayein.",
      );
      return;
    }

    if (chatState === "WAITING_FOR_NAME") {
      if (text.trim().length <= 2) {
        addBotMessage(
          currentLanguage === "english"
            ? "Name is missing or too short. Please provide your full name."
            : "Naam theek nahi hai. Barahe karam apna pura naam darj karein.",
        );
        return;
      }
      const bookingName = text.trim();
      setBookingInfo((prev) => ({ ...prev, name: bookingName }));
      setChatState("WAITING_FOR_PHONE");
      addBotMessage(
        currentLanguage === "english"
          ? "Finally, please provide a valid 11-digit Pakistani mobile number to confirm the booking."
          : "Booking confirm karne ke liye apna 11-digit mobile number likhein.",
      );
      return;
    }

    if (chatState === "WAITING_FOR_PHONE") {
      const phoneMatch = text.match(
        /^((\+92)?(0092)?(92)?(0)?)(3[0-9]{2})[0-9]{7}$/,
      );
      if (!phoneMatch) {
        addBotMessage(
          currentLanguage === "english"
            ? "Invalid phone format. We require a valid 11-digit Pakistani mobile number."
            : "Mobile number theek nahi hai. Barahe karam sahi 11-digit Pakistani number likhein.",
        );
        return;
      }

      const phoneNum = text.trim();
      await supabase.from("bookings").insert({
        user_id: user.id,
        customer_name: bookingInfo.name,
        guests: pendingBooking.guests,
        booking_time: pendingBooking.time,
        booking_date: pendingBooking.date,
      });

      const newBooking = {
        id: "TABLE-" + Math.floor(100 + Math.random() * 900),
        details: `Table for ${pendingBooking.guests} on ${pendingBooking.date} at ${pendingBooking.time}`,
        total: 0,
        date: new Date().toISOString(),
        status: "Reserved",
      };
      setOrderHistory((prev) => [newBooking, ...prev]);

      setSuccessPopup({
        title: "Booking Confirmed!",
        message: `Table reserved successfully for ${bookingInfo.name}.\nDate: ${pendingBooking.date}\nTime: ${pendingBooking.time}`,
      });

      addBotMessage(
        currentLanguage === "english"
          ? `Reservation Confirmed! Name: ${bookingInfo.name}, Guests: ${pendingBooking.guests}, Date: ${pendingBooking.date}, Time: ${pendingBooking.time}. We look forward to hosting you at the Gulshan Branch.`
          : `Booking Confirm! Name: ${bookingInfo.name}, Guests: ${pendingBooking.guests}, Date: ${pendingBooking.date}, Time: ${pendingBooking.time}. Gulshan Branch me aapka intezar rahega.`,
        ["New Chat"],
      );
      scheduleReminder(pendingBooking.time);
      setChatState("COMPLETED");
      setPendingBooking(null);
      return;
    }

    if (chatState === "TALK_AGENT_PHONE") {
      addBotMessage(
        currentLanguage === "english"
          ? "Thank you. Our agent will contact this number shortly."
          : "Shukriya. Hamara agent jald is number par aap se rabta karega.",
      );
      setChatState("GENERAL");
      return;
    }
  };

  const handleReset = () => {
    setMessages([getInitialMessage()]);
    setChatState("WELCOME");
    setPendingOrder(null);
    setPendingBooking(null);
    const newSessionId = crypto.randomUUID();
    sessionId.current = newSessionId;
    localStorage.setItem("spicehub_session_id", newSessionId);
  };

  const generatePDFReceipt = (order: any) => {
    const doc = new jsPDF();

    // Abstract Logo Background
    doc.setFillColor(239, 68, 68); // SpiceHub primary red approximate
    doc.rect(20, 15, 15, 15, "F");
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
    const items = order.details.split(", ");
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
        const menuItemDetails = MENU_ITEMS.find((m) => m.name === name);
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
    doc.text(
      "Thank you for choosing SpiceHub Elite! Please visit again.",
      20,
      120 + detailsHeight,
    );

    doc.save(`SpiceHub_Receipt_${order.id}.pdf`);
  };

  const onQuickReorder = (order: any) => {
    try {
      if (!order.details) return;
      const items = order.details.split(', ');
      let addedAtLeastOne = false;
      
      items.forEach((itemStr: string) => {
        const qtyMatch = itemStr.match(/^(\d+)x\s+(.+?)(?:\s+\(@Rs\.(\d+)\))?$/);
        if (qtyMatch) {
          const qty = parseInt(qtyMatch[1], 10);
          const name = qtyMatch[2];
          const price = qtyMatch[3] ? parseInt(qtyMatch[3], 10) : 0;
          orderCart.push({ qty, name, price });
          addedAtLeastOne = true;
        }
      });

      if (addedAtLeastOne) {
         setCartTick((t) => t + 1);
         setShowOrderHistory(false);
         setIsCartDrawerOpen(true);
      } else {
         console.warn("Could not extract items from this order to quick reorder.");
      }
    } catch(e) { 
      console.error("Error quick reordering", e);
    }
  };

  const onCancelOrder = async (orderId: string) => {
    try {
      await supabase.from("orders").delete().eq("id", orderId);
      setOrderHistory((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e) {
      console.error("Error cancelling order", e);
    }
  };

  const markAsDelivered = async (orderId: string) => {
    try {
      await supabase
        .from("orders")
        .update({ status: "Delivered" })
        .eq("id", orderId);
      setOrderHistory((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "Delivered" } : o)),
      );
      setReviewPopup(orderId);
    } catch (e) {
      console.error("Error updating order status", e);
    }
  };

  const submitReview = async () => {
    if (reviewPopup) {
      try {
        await supabase.from('order_reviews').insert([{
          order_id: reviewPopup,
          rating: rating,
          review_text: reviewText,
          created_at: new Date().toISOString()
        }]);
      } catch (err) {
        console.error("Failed to submit review", err);
      }
      setSuccessPopup({
        title: "Feedback Submitted",
        message: "Thank you for your review!",
      });
      setReviewPopup(null);
      setRating(5);
      setReviewText("");
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "Preparing") return "text-[#D4AF37] bg-[#D4AF37]/10";
    if (status === "Out for Delivery") return "text-blue-500 bg-blue-500/10";
    if (status === "Delivered") return "text-green-500 bg-green-500/10";
    return "text-secondary bg-secondary/10";
  };

  const adminSettings = {
    requirePreChat: true,
    brandColor: "bg-primary",
  };

  return (
    <div 
      className="relative min-h-[100dvh] w-full overflow-hidden bg-[#060709] text-white"
      style={activeBotConfig?.themeColor ? { '--accent-red': activeBotConfig.themeColor } as React.CSSProperties : undefined}
    >
      {/* Flying Cart Animation Renderer */}
      {flyingCartItems.map(item => (
        <motion.div
          key={item.id}
          initial={{ x: item.startX, y: item.startY, scale: 1, opacity: 1 }}
          animate={{ x: window.innerWidth - 60, y: 30, scale: 0.2, opacity: 0 }}
          transition={{ duration: 0.8, ease: "anticipate" }}
          className="fixed z-[9999] pointer-events-none text-4xl drop-shadow-2xl"
          style={{ top: 0, left: 0 }}
        >
          {item.emoji}
        </motion.div>
      ))}

      {/* Dynamic 3D ambient blurs */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[150px] mix-blend-screen pointer-events-none" />

      {/* Clean floating restaurant vector icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {["🍔", "🍕", "🍟", "🥤", "🌯", "🌮", "🌶️"].map((emoji, i) => (
          <motion.div
            key={i}
            className="absolute text-6xl saturate-50 opacity-10 drop-shadow-2xl"
            initial={{
              x:
                typeof window !== "undefined"
                  ? Math.random() * window.innerWidth
                  : 0,
              y: typeof window !== "undefined" ? window.innerHeight + 100 : 800,
              rotate: -20,
            }}
            animate={{
              y: -100,
              rotate: 20,
              x:
                typeof window !== "undefined"
                  ? `calc(${Math.random() * 100}vw + ${Math.sin(i) * 150}px)`
                  : 0,
            }}
            transition={{
              repeat: Infinity,
              duration: 25 + Math.random() * 20,
              delay: Math.random() * 10,
              ease: "easeInOut",
            }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>

      {/* Premium Sticky Glassmorphic Navbar */}
      <nav id="home-section" className="sticky top-0 z-[80] w-full bg-[#0D0E12]/90 backdrop-blur-md border-b border-white/5 px-4 sm:px-8 py-4 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Far LEFT: Glowing Stylized Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 relative rounded-xl border border-primary/40 bg-gradient-to-tr from-zinc-900 to-zinc-950 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.25)]">
              <span className="text-base font-black italic tracking-tighter text-primary">SH</span>
            </div>
            <span className="text-xl font-bold tracking-wider text-white select-none">
              Spice<span className="text-primary font-black drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">Hub</span>
            </span>
          </div>

          {/* CENTER: Smooth Anchor Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#home-section" className="text-xs uppercase tracking-widest font-semibold text-zinc-400 hover:text-red-400 transition-colors relative group py-2">
              Home
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-500 group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#menu-section" className="text-xs uppercase tracking-widest font-semibold text-zinc-400 hover:text-red-400 transition-colors relative group py-2">
              Menu
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-500 group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#services-section" className="text-xs uppercase tracking-widest font-semibold text-zinc-400 hover:text-red-400 transition-colors relative group py-2">
              Services
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-500 group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#contact-section" className="text-xs uppercase tracking-widest font-semibold text-zinc-400 hover:text-red-400 transition-colors relative group py-2">
              Contact Us
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-500 group-hover:w-full transition-all duration-300"></span>
            </a>
          </div>

          {/* Far RIGHT: Responsive Controls */}
          <div className="flex items-center gap-4">
            {/* Cart with Live Count Micro-badge */}
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="relative p-2.5 bg-zinc-900/80 border border-white/5 rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center group"
              title="View Cart"
            >
              <ShoppingBag size={18} className="text-zinc-300 group-hover:text-white transition-colors" />
              {orderCart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-[#0F172A] text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0D0E12] animate-bounce">
                  {orderCart.reduce((acc, item) => acc + item.qty, 0)}
                </span>
              )}
            </button>

            {/* Admin Portal Button */}
            <a
              href="?view=admin"
              onClick={(e) => {
                e.preventDefault();
                const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?view=admin';
                window.history.pushState({ path: newurl }, '', newurl);
                if (user?.email === 'admin@spicehub.com') {
                  if (setIsAdminOpen) {
                    setIsAdminOpen(true);
                  }
                } else {
                  if (onLoginClick) {
                    onLoginClick();
                  }
                }
              }}
              className="bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider border border-white/10 px-4 py-2.5 rounded-xl transition-all hidden md:inline-block text-center cursor-pointer"
            >
              Admin Portal
            </a>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden relative p-2.5 bg-zinc-900/80 border border-white/5 rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 group-hover:text-white transition-colors">
                <line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div className="relative z-10 w-full">
        {/* Mobile Navbar Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm md:hidden"
              />
              
              {/* Drawer */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="fixed inset-y-0 right-0 z-[100] w-64 bg-[#0D0E12] border-l border-white/10 p-6 flex flex-col md:hidden shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <span className="text-xl font-bold tracking-wider text-white">
                    Spice<span className="text-primary font-black">Hub</span>
                  </span>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex flex-col gap-6">
                  <a href="#home-section" onClick={() => setIsMobileMenuOpen(false)} className="text-sm uppercase tracking-widest font-semibold text-zinc-300 hover:text-red-400 transition-colors py-2 border-b border-white/5">Home</a>
                  <a href="#menu-section" onClick={() => setIsMobileMenuOpen(false)} className="text-sm uppercase tracking-widest font-semibold text-zinc-300 hover:text-red-400 transition-colors py-2 border-b border-white/5">Menu</a>
                  <a href="#services-section" onClick={() => setIsMobileMenuOpen(false)} className="text-sm uppercase tracking-widest font-semibold text-zinc-300 hover:text-red-400 transition-colors py-2 border-b border-white/5">Services</a>
                  <a href="#contact-section" onClick={() => setIsMobileMenuOpen(false)} className="text-sm uppercase tracking-widest font-semibold text-zinc-300 hover:text-red-400 transition-colors py-2 border-b border-white/5">Contact Us</a>
                  
                  <a
                    href="?view=admin"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMobileMenuOpen(false);
                      const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?view=admin';
                      window.history.pushState({ path: newurl }, '', newurl);
                      if (user?.email === 'admin@spicehub.com') {
                        if (setIsAdminOpen) setIsAdminOpen(true);
                      } else {
                        if (onLoginClick) onLoginClick();
                      }
                    }}
                    className="mt-4 bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider border border-white/10 px-4 py-3 rounded-xl transition-all text-center"
                  >
                    Admin Portal
                  </a>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* PREMIUM BACKGROUND ACCENTS FOR HERO */}
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#ff4646] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" style={{ clipPath: "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" }}></div>
        </div>

        {/* HERO SECTION BANNER */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 lg:px-6 pt-20 pb-24 md:pt-36 md:pb-28 lg:pt-48 lg:pb-32 flex flex-col md:flex-row items-center gap-10 md:gap-12 lg:gap-16 min-h-[85vh]">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full md:w-6/12 text-left space-y-6 md:space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 text-red-500 text-xs font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(239,68,68,0.1)] backdrop-blur-md">
              <Sparkles size={14} className="animate-pulse text-orange-400" /> Premium Dining Experience
            </div>
            
            <h1 className="text-4xl sm:text-6xl md:text-5xl lg:text-7xl font-black tracking-tighter leading-[1.05] text-white">
              Savor the True <br /> Taste of <span className="text-transparent bg-clip-text bg-gradient-to-br from-red-400 via-orange-500 to-yellow-500 drop-shadow-lg">SpiceHub</span>
            </h1>
            
            <p className="text-lg md:text-xl lg:text-xl text-zinc-400 font-medium max-w-lg leading-relaxed mix-blend-plus-lighter">
              Indulge in authentic cuisines crafted with passion. Whether dining in or ordering at home, our AI Concierge ensures a flawless, premium culinary journey.
            </p>
            
            <div className="flex flex-wrap items-center gap-4 pt-6">
              <button
                onClick={() => setIsWidgetOpen(true)}
                className="bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white px-8 py-4 rounded-2xl font-bold text-base transition-all hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(239,68,68,0.4),inset_0_2px_4px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3 border border-red-400/50"
              >
                ⚡ Order Now
              </button>
              <a
                href="#menu-section"
                className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 hover:border-white/20 hover:bg-zinc-800/80 text-white px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-xl hover:-translate-y-1 flex items-center justify-center gap-3"
              >
                Browse Menu
              </a>
              <a
                href="#services-section"
                className="bg-transparent text-zinc-300 hover:text-white px-6 py-4 rounded-2xl font-bold text-base transition-all hover:bg-white/5 flex items-center justify-center"
              >
                Services
              </a>
              <a
                href="#contact-section"
                className="bg-transparent text-zinc-300 hover:text-white px-6 py-4 rounded-2xl font-bold text-base transition-all hover:bg-white/5 flex items-center justify-center"
              >
                Contact Us
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full md:w-6/12 flex flex-col items-center justify-center relative"
          >
            {/* Soft Ambient glowing orb in background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-600/20 rounded-full blur-[100px] select-none pointer-events-none"></div>

            <div className="w-full bg-zinc-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 p-8 sm:p-12 shadow-[0_40px_80px_rgba(0,0,0,0.5),inset_0_2px_1px_rgba(255,255,255,0.05)] relative group z-10 hover:-translate-y-2 transition-transform duration-500">              
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-8 shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                <UtensilsCrossed size={36} className="relative z-10 drop-shadow-[0_2px_10px_rgba(239,68,68,0.8)]" />
              </div>
              
              <h3 className="text-3xl font-black mb-4 text-white tracking-tight drop-shadow-md">
                Gourmet Excellence
              </h3>
              
              <p className="text-zinc-400 leading-relaxed mb-8 text-lg mix-blend-plus-lighter">
                From sizzling grills to traditional curries, our master chefs use only the freshest ingredients to deliver an unforgettable dining experience.
              </p>

              <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex -space-x-3">
                  {["🔥", "🥘", "🍛", "🥩"].map((emoji, index) => (
                    <div key={index} className="w-12 h-12 rounded-full bg-gradient-to-b from-zinc-800 to-zinc-900 flex items-center justify-center border-2 border-[#0D0E12] shadow-lg text-lg select-none hover:-translate-y-1 transition-transform">
                      {emoji}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-zinc-300 font-bold bg-white/5 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
                  Rated 4.9/5 by 12k+ diners
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* TRUST INFRASTRUCTURE & METRICS PANEL */}
        <section className="border-y border-white/5 bg-[#0D0E12]/50 backdrop-blur-md py-12 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-white/5">
            <div className="pt-6 md:pt-0">
              <div className="text-4xl font-extrabold text-white tracking-tight">12,000+</div>
              <p className="text-sm font-semibold tracking-wide text-zinc-400 mt-2 uppercase">Happy Diners Served</p>
            </div>
            <div className="pt-6 md:pt-0">
              <div className="text-4xl font-extrabold text-white tracking-tight">24/7</div>
              <p className="text-sm font-semibold tracking-wide text-zinc-400 mt-2 uppercase">Continuous AI Concierge</p>
            </div>
            <div className="pt-6 md:pt-0">
              <div className="text-4xl font-extrabold text-[#D4AF37] tracking-tight">Under 30 Min</div>
              <p className="text-sm font-semibold tracking-wide text-zinc-400 mt-2 uppercase">Express Delivery Guard</p>
            </div>
          </div>
        </section>

        {/* FLAWLESS PRODUCT SHOWCASE GRID */}
        <section id="menu-section" className="max-w-7xl mx-auto px-6 py-24 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
                Explore Our Gourmet Menu
              </h2>
              <p className="text-lg text-zinc-400 font-medium">
                Freshly prepared local delicacies. Highlight any card to customize size and add to cart.
              </p>
            </div>

            {/* Category Switcher Tabs */}
            <div className="flex flex-wrap gap-2.5 bg-zinc-900/60 p-1.5 rounded-2xl border border-white/5">
              {["All", "BBQ & Grill", "Karahi & Handi", "Biryani & Rice", "Traditional Curries", "Fast Food", "Desserts & Sweets", "Beverages"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setLandingPageCategory(cat)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    landingPageCategory === cat 
                      ? "bg-primary text-[#0F172A] shadow-lg shadow-primary/10" 
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {isLoadingMenu ? (
              Array(8).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse bg-white/[0.02] border border-white/5 rounded-3xl p-6 h-96 flex flex-col justify-between relative">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5"></div>
                      <div className="flex gap-1.5">
                        <div className="w-16 h-6 rounded-full bg-zinc-800"></div>
                      </div>
                    </div>
                    <div className="w-3/4 h-6 bg-zinc-800 rounded-lg"></div>
                    <div className="space-y-2">
                       <div className="w-full h-4 bg-zinc-800/50 rounded-lg"></div>
                       <div className="w-5/6 h-4 bg-zinc-800/50 rounded-lg"></div>
                       <div className="w-4/6 h-4 bg-zinc-800/50 rounded-lg"></div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between border-t border-white/5 pt-4">
                    <div className="w-20 h-8 bg-zinc-800 rounded-lg"></div>
                    <div className="w-10 h-10 rounded-xl bg-zinc-800"></div>
                  </div>
                </div>
              ))
            ) : MENU_ITEMS.filter((item) => landingPageCategory === "All" || item.category === landingPageCategory).map((item, idx) => {
              // Extract the base emoji and label name
              const nameParts = item.name.split(" ");
              const itemEmoji = nameParts[0] || "🍔";
              const cleanItemName = nameParts.slice(1).join(" ");
              
              const itemMeta = (() => {
                if (item.name.includes("Zinger")) return { desc: "Crispy fried chicken breast fillet, iceberg lettuce, and high-temp spicy garlic mayo.", tags: ["Spicy", "Bestseller"] };
                if (item.name.includes("Cheese Blast")) return { desc: "Double crisp-crust patty with a fluid melting liquid-cheddar lava center core.", tags: ["Cheesy", "Chef Choice"] };
                if (item.name.includes("Jalapeno")) return { desc: "Spiced grilled beef patty, sliced pickles, flame-roasted red jalapenos, and fire mayo.", tags: ["Hot", "New"] };
                if (item.name.includes("Monster")) return { desc: "Colossal dual stacked beef patties, triple cheddar slices, crispy beef bacon, fried onions.", tags: ["Double Patty", "Classic"] };
                if (item.name.includes("Tikka S")) return { desc: "Traditional slow-roasted spicy chicken tikka, sweet onions, mozzarella, fresh dough.", tags: ["Single Serve"] };
                if (item.name.includes("Tikka L")) return { desc: "Epic large pan pizza loaded with double chicken tikka chunk mass and heavy cheese layers.", tags: ["Family Size", "Popular"] };
                if (item.name.includes("BBQ S")) return { desc: "Small sweet-glazed smoked BBQ chicken chunks with white-sauce swirl and hot mozzarella.", tags: ["Creamy Flavor"] };
                if (item.name.includes("BBQ L")) return { desc: "Giant pan thick-crust gourmet pizza with smoked chicken chunks, hickory sauce, white garlic creme.", tags: ["Gourmet Base", "Bestseller"] };
                if (item.name.includes("Dum Biryani")) return { desc: "Aromatic aged long basmati rise layered with spice infused mutton/chicken fusion gravy.", tags: ["Traditional", "Savory"] };
                if (item.name.includes("Special Mutton")) return { desc: "Rich royal bone-in mutton slow-steamed in handi with saffron, premium spices, basmati.", tags: ["Gourmet", "Rich"] };
                if (item.name.includes("Drink")) return { desc: "Ice-cold 350ml carbonated soft can. Choose flavor on call or chatbot delivery step.", tags: ["Carbonated", "Cold"] };
                if (item.name.includes("Water")) return { desc: "Pure high-filtration mineral-restored drinking spring water bottle, served chilled.", tags: ["Pure Hydration"] };
                return { desc: "Flavorful artisan recipe crafted by our master food engineer.", tags: ["House Recipe"] };
              })();

              return (
                <motion.div
                  key={idx}
                  onClick={() => {
                    setSelectedProduct(item);
                  }}
                  whileHover={{ y: -6 }}
                  className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-xl flex flex-col justify-between h-96 relative group hover:border-primary/20 hover:bg-white/[0.04] cursor-pointer transition-all duration-300"
                >
                  <div className="space-y-4">
                    {/* Category food emoji header centered cleanly */}
                    <div className="flex items-center justify-between">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-4xl select-none group-hover:scale-110 transition-transform">
                        {itemEmoji}
                      </div>

                      {/* Accent Tags */}
                      <div className="flex gap-1.5">
                        {itemMeta.tags?.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">{tag}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-primary transition-colors">
                        {cleanItemName}
                      </h3>
                      <p className="text-xs text-zinc-500 font-medium tracking-wider uppercase mt-1">
                        {item.category}
                      </p>
                    </div>

                    <p className="text-sm text-zinc-400 font-medium line-clamp-3 leading-relaxed">
                      {itemMeta.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-extrabold">Price</p>
                      <p className="text-xl font-black text-white">Rs. {item.price}</p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Avoid double action execution
                        setSelectedProduct(item);
                      }}
                      className="bg-zinc-900 group-hover:bg-primary group-hover:text-[#0F172A] border border-white/10 group-hover:border-transparent px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all"
                    >
                      Configure
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* SERVICES SECTION */}
        <section id="services-section" className="border-t border-white/5 max-w-7xl mx-auto px-6 py-24 scroll-mt-24">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
              Our Premium <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-500">Services</span>
            </h2>
            <p className="text-lg text-zinc-400 font-medium leading-relaxed">
              Elevating your culinary experience with top-tier hospitality, seamless ordering, and authentic flavors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { title: "Dine-In Experience", icon: "✨", desc: "Enjoy a luxurious ambient atmosphere with VIP table service and elegant interior design." },
              { title: "Home Delivery", icon: "🚚", desc: "Lightning-fast delivery ensuring your food arrives blazing hot and perfectly packed." },
              { title: "Online Ordering", icon: "📱", desc: "Order seamlessly via our advanced AI Chatbot or interactive digital menu platform." },
              { title: "Catering Services", icon: "🍱", desc: "Premium bulk catering for corporate meetings, weddings, and grand celebrations." },
              { title: "Event Catering", icon: "🎉", desc: "Customize specialized menus for live BBQ stations and traditional buffet setups." },
              { title: "Family Gatherings", icon: "👨‍👩‍👧‍👦", desc: "Private dining halls and exclusive combo platters designed for family feasts." }
            ].map((service, idx) => (
              <div key={idx} className="bg-zinc-900/40 backdrop-blur-md border border-white/5 hover:border-red-500/30 rounded-3xl p-8 space-y-6 group transition-all hover:-translate-y-2 shadow-lg shadow-black/20">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-300">
                  {service.icon}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight mb-3 group-hover:text-red-400 transition-colors">{service.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed text-balance">
                    {service.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CONTACT US SECTION */}
        <section id="contact-section" className="border-t border-white/5 bg-gradient-to-b from-[#0D0E12] to-zinc-950 py-24 px-6 scroll-mt-24">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-10">
              <div>
                <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">
                  Get In Touch
                </h2>
                <p className="text-lg text-zinc-400 font-medium leading-relaxed">
                  Have questions or want to make a reservation? Reach out to us directly or visit our flagship outlet.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4 group">
                  <div className="w-14 h-14 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all">
                    💬
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Chat With Us</h4>
                    <a href="https://wa.me/923001234567" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-green-500 transition-colors">Start WhatsApp Chat</a>
                  </div>
                </div>
                <div className="flex items-center gap-4 group">
                  <div className="w-14 h-14 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all">
                    ✉️
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Email</h4>
                    <p className="text-zinc-400">waleedikram1012@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 group">
                  <div className="w-14 h-14 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all">
                    📍
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Address</h4>
                    <a href="https://maps.google.com/?q=Mansehra,+KPK,+Pakistan" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-red-500 transition-colors underline decoration-white/20 underline-offset-4">Get Directions</a>
                  </div>
                </div>
                <div className="flex items-center gap-4 group">
                  <div className="w-14 h-14 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all">
                    ⏰
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Business Hours</h4>
                    <p className="text-zinc-400">Mon-Sun: 12:00 PM - 2:00 AM</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-red-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <h3 className="text-2xl font-bold text-white mb-8">Send Us A Message</h3>
              <form 
                className="space-y-6 relative z-10" 
                action="https://formspree.io/f/xdavjajo"
                method="POST"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-400">Full Name</label>
                    <input 
                      type="text" 
                      name="name"
                      placeholder="John Doe" 
                      required
                      className="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-zinc-600" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-400">Email Address</label>
                    <input 
                      type="email" 
                      name="email"
                      placeholder="john@example.com" 
                      required
                      className="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-zinc-600" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-400">Message</label>
                  <textarea 
                    rows={4} 
                    name="message"
                    required
                    placeholder="How can we help you?" 
                    className="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-zinc-600 resize-none"
                  ></textarea>
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* PREMIUM FOOTER */}
        <footer className="border-t border-white/10 bg-black pt-20 pb-10 px-6 relative overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
              <div className="space-y-6 lg:col-span-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-orange-500 flex items-center justify-center shadow-lg">
                    <span className="text-base font-black italic tracking-tighter text-white">SH</span>
                  </div>
                  <span className="text-2xl font-bold tracking-wider text-white select-none">
                    Spice<span className="text-red-500 font-black">Hub</span>
                  </span>
                </div>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Redefining Pakistani culinary traditions with a modern AI-driven experience. Authentic taste, delivered instantly.
                </p>
                <div className="flex items-center gap-4 pt-2">
                  <a href="https://facebook.com/spicehub" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-blue-500 hover:bg-zinc-800 transition-all cursor-pointer">
                    <Facebook size={18} />
                  </a>
                  <a href="https://youtube.com/@spicehub" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-zinc-800 transition-all cursor-pointer">
                    <Youtube size={18} />
                  </a>
                  <a href="https://twitter.com/spicehub" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-sky-500 hover:bg-zinc-800 transition-all cursor-pointer">
                    <Twitter size={18} />
                  </a>
                  <a href="https://instagram.com/spicehub" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-pink-500 hover:bg-zinc-800 transition-all cursor-pointer">
                    <Instagram size={18} />
                  </a>
                </div>
              </div>

              <div>
                <h4 className="text-white font-bold mb-6 tracking-wide uppercase text-sm">Quick Links</h4>
                <ul className="space-y-3">
                  <li><a href="#home-section" className="text-zinc-500 hover:text-red-400 transition-colors text-sm">Home</a></li>
                  <li><a href="#menu-section" className="text-zinc-500 hover:text-red-400 transition-colors text-sm">Browse Menu</a></li>
                  <li><a href="#services-section" className="text-zinc-500 hover:text-red-400 transition-colors text-sm">Services</a></li>
                  <li><a href="#contact-section" className="text-zinc-500 hover:text-red-400 transition-colors text-sm">Contact Us</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold mb-6 tracking-wide uppercase text-sm">Contact Info</h4>
                <ul className="space-y-3 text-sm text-zinc-500">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">📍</span>
                    <a href="https://maps.google.com/?q=Mansehra,+KPK,+Pakistan" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors underline decoration-white/20 underline-offset-4">Get Directions</a>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">✉️</span>
                    <a href="mailto:waleedikram1012@gmail.com" className="hover:text-red-400 transition-colors">waleedikram1012@gmail.com</a>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">💬</span>
                    <a href="https://wa.me/923001234567" target="_blank" rel="noopener noreferrer" className="hover:text-green-500 font-bold transition-colors text-green-400">Chat on WhatsApp</a>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">⏰</span>
                    <span>Mon - Sun<br />12:00 PM - 2:00 AM</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold mb-6 tracking-wide uppercase text-sm">Newsletter</h4>
                <p className="text-zinc-500 text-sm mb-4">Subscribe to receive exclusive AI-discounts and menu updates.</p>
                <form className="relative" onSubmit={(e) => e.preventDefault()}>
                  <input type="email" placeholder="Your Email" className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 pr-24" />
                  <button className="absolute right-1.5 top-1.5 bottom-1.5 bg-zinc-800 hover:bg-red-500 text-white font-bold px-4 rounded-lg text-xs tracking-wider uppercase transition-colors">
                    Join
                  </button>
                </form>
              </div>
            </div>

            <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-zinc-600 text-sm text-center md:text-left">
                &copy; {new Date().getFullYear()} SpiceHub Technologies. All rights reserved.
              </p>
              <div className="flex gap-6">
                <a href="#" className="text-zinc-600 hover:text-white text-sm transition-colors">Privacy Policy</a>
                <a href="#" className="text-zinc-600 hover:text-white text-sm transition-colors">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <AnimatePresence>
        {isWidgetOpen && (
          <motion.div
            key="chat-widget"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "tween", ease: "circOut", duration: 0.3 }}
            className="chat-widget-container flex flex-col overflow-hidden bg-base/95 backdrop-blur-xl text-content border border-border outline-none transition-[width,height,border-radius] duration-300"
            style={
              viewMode === "MOBILE"
                ? {
                    width: "100vw",
                    height: "100vh",
                    position: "fixed",
                    inset: "0px",
                    zIndex: 99999,
                    borderRadius: 0,
                  }
                : {
                    width: "380px",
                    height: "600px",
                    position: "fixed",
                    bottom: "24px",
                    right: "24px",
                    zIndex: 99999,
                    borderRadius: "1rem",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                  }
            }
          >
            {/* Security Layer Check */}
            {window.location.host !== "localhost:3000" &&
            !window.location.host.includes(".run.app") &&
            !window.location.host.includes(".vercel.app") &&
            window.location.hostname !== "localhost" &&
            window.location.hostname !== "127.0.0.1" ? (
              <div className="flex flex-col items-center justify-center p-8 text-center h-full w-full">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <h3 className="text-xl font-bold mb-2">Unauthorized Domain</h3>
                <p className="text-sm text-content-muted">
                  SpiceHub ChatWidget is not authorized to run on this host (
                  {window.location.host}). Please register this domain in the
                  Admin Panel.
                </p>
              </div>
            ) : !preChatForm.complete && adminSettings.requirePreChat ? (
              <div className="flex flex-col h-full w-full bg-base p-6 overflow-y-auto">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-tr from-primary to-secondary text-white shadow-lg shadow-primary/20 mb-6 mx-auto mt-4">
                  <Sparkles size={24} />
                </div>
                <h2 className="text-2xl font-black text-center mb-2">
                  Welcome to {activeBotConfig ? activeBotConfig.name.replace(/ Support| Chatbot/g, '') : "SpiceHub"}
                </h2>
                <p className="text-sm text-content-muted text-center mb-8">
                  Please provide your details to start the live chat.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-content-muted uppercase tracking-wider mb-1 block">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={preChatForm.name}
                      onChange={(e) =>
                        setPreChatForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="Full Name"
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-content-muted uppercase tracking-wider mb-1 block">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={preChatForm.email}
                      onChange={(e) =>
                        setPreChatForm((p) => ({ ...p, email: e.target.value }))
                      }
                      placeholder="ali@gmail.com"
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {preChatForm.error && (
                    <p className="text-red-500 text-xs font-bold text-center mt-2">
                      {preChatForm.error}
                    </p>
                  )}

                  <button
                    onClick={() => {
                      if (!preChatForm.name || !preChatForm.email) {
                        setPreChatForm((p) => ({
                          ...p,
                          error: "Name and Email are required.",
                        }));
                        return;
                      }
                      if (
                        !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
                          preChatForm.email,
                        )
                      ) {
                        setPreChatForm((p) => ({
                          ...p,
                          error: "Please enter a valid email address.",
                        }));
                        return;
                      }
                      setPreChatForm((p) => ({
                        ...p,
                        error: "",
                        complete: true,
                      }));
                    }}
                    className="w-full bg-primary hover:bg-primary/90 text-[#0F172A] dark:text-white rounded-xl py-4 font-bold tracking-wide mt-6 transition-colors shadow-lg shadow-primary/20"
                  >
                    Start Chat
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full overflow-hidden bg-base text-content relative">
                {/* Sidebar Navigation */}
                <motion.aside
                  onHoverStart={() => setIsSidebarOpen(true)}
                  onHoverEnd={() => setIsSidebarOpen(false)}
                  animate={{ width: isSidebarOpen ? 240 : 54 }}
                  transition={{
                    type: "spring",
                    stiffness: 250,
                    damping: 22,
                    mass: 0.8,
                  }}
                  className="absolute left-0 top-0 bottom-0 z-40 bg-surface/90 backdrop-blur-md shadow-2xl border-r border-border overflow-hidden flex flex-col items-center py-4"
                >
                  <div className="flex shrink-0 flex-col items-center px-4 w-full">
                    <div className="relative flex items-center justify-center h-10 w-10 shrink-0 mx-auto rounded-full bg-base border border-primary/40 shadow-sm overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-50"></div>
                      <span className="text-lg font-black italic tracking-tighter text-primary z-10">
                        SH
                      </span>
                    </div>
                  </div>
                  <nav className="flex flex-1 flex-col gap-6 p-3 mt-8 w-full">
                    <button
                      onClick={handleReset}
                      className="flex items-center justify-center rounded-lg p-3 hover:bg-surface-hover text-content transition-all group overflow-hidden"
                    >
                      <MessageSquarePlus
                        className="shrink-0 text-content group-hover:text-content transition-colors"
                        size={24}
                      />
                      {isSidebarOpen && (
                        <span className="ml-4 flex-1 text-left whitespace-nowrap font-medium text-content">
                          New Chat
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setShowOrderHistory(true)}
                      className="flex items-center justify-center rounded-lg p-3 hover:bg-surface-hover text-content transition-all group overflow-hidden"
                    >
                      <History
                        className="shrink-0 text-content group-hover:text-content transition-colors"
                        size={24}
                      />
                      {isSidebarOpen && (
                        <span className="ml-4 flex-1 text-left whitespace-nowrap font-medium text-content">
                          Order History
                        </span>
                      )}
                    </button>

                    {isSidebarOpen && activeLiveOrders.length > 0 && (
                      <div className="mt-6 px-3">
                        <h3 className="text-xs font-black uppercase text-content-muted tracking-widest mb-3 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>{" "}
                          Active Orders
                        </h3>
                        <div className="flex flex-col gap-3">
                          {activeLiveOrders.map((order, idx) => (
                            <div
                              key={order.id + "-" + idx}
                              className="bg-base border border-border p-3 rounded-xl flex flex-col gap-1.5 shadow-sm"
                            >
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-content">
                                  {order.id}
                                </span>
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold tracking-wide uppercase text-[10px]">
                                  {order.status}
                                </span>
                              </div>
                              <span className="text-xs text-content-muted truncate">
                                {order.details}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isSidebarOpen && pastConversations.length > 0 && (
                      <div className="mt-6 px-3 flex-1 overflow-y-auto">
                        <h3 className="text-xs font-black uppercase text-content-muted tracking-widest mb-3 flex items-center gap-2">
                          <History size={14} className="text-secondary" />{" "}
                          Recent Chats
                        </h3>
                        <div className="flex flex-col gap-2">
                          {pastConversations.map((conv, idx) => (
                            <button
                              key={conv.session_id + "-" + idx}
                              onClick={() => {
                                setMessages(conv.messages);
                                setChatState("GENERAL");
                                sessionId.current = conv.session_id;
                                localStorage.setItem(
                                  "spicehub_session_id",
                                  conv.session_id,
                                );
                                localStorage.setItem(
                                  "spicehub_chat_messages",
                                  JSON.stringify(conv.messages),
                                );
                                localStorage.setItem(
                                  "spicehub_chat_state",
                                  "GENERAL",
                                );
                              }}
                              className="text-left bg-transparent hover:bg-surface-hover p-3 rounded-xl flex flex-col gap-1 transition-colors border border-transparent hover:border-border"
                            >
                              <span className="font-bold text-content text-xs line-clamp-1">
                                {conv.messages?.[conv.messages.length - 1]
                                  ?.text || "Session"}
                              </span>
                              <span className="text-[10px] text-content-muted">
                                {new Date(conv.updated_at).toLocaleDateString()}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </nav>

                  {/* Lower Left Profile Panel Footer */}
                  <div
                    className={cn(
                      "mt-auto w-full border-t border-border p-4 transition-all overflow-hidden flex flex-col gap-3",
                      isSidebarOpen ? "items-start" : "items-center",
                    )}
                  >
                    <div className="flex items-center w-full justify-between">
                      <div className="flex flex-col w-full overflow-hidden">
                        {isSidebarOpen && (
                          <span className="font-bold text-content text-sm truncate">
                            {user.user_metadata?.name || "Customer"}
                          </span>
                        )}
                        {isSidebarOpen && (
                          <span className="text-[10px] text-content-muted truncate">
                            {user.email}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="shrink-0 p-2 rounded-lg hover:bg-surface-hover text-content-muted hover:text-content transition-colors group"
                      >
                        <Settings
                          className="group-hover:rotate-90 transition-transform"
                          size={20}
                        />
                      </button>
                    </div>
                    <button
                      onClick={user?.id === 'guest' ? onLoginClick || onLogout : onLogout}
                      className="flex w-full items-center justify-center rounded-lg bg-red-500/10 p-2 text-red-500 hover:bg-red-500 hover:text-white transition-all group mt-2"
                    >
                      <LogOut className="shrink-0" size={18} />
                      {isSidebarOpen && (
                        <span className="ml-2 font-bold text-sm whitespace-nowrap">
                          {user?.id === 'guest' ? 'Login' : 'Sign Out'}
                        </span>
                      )}
                    </button>
                  </div>
                </motion.aside>

                <div className="flex flex-1 flex-col overflow-hidden relative ml-0 md:ml-[54px] w-full md:w-[calc(100%-54px)]">
                  {/* Header */}
                  <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-base px-4 md:px-6">
                    <div className="flex items-center">
                      <div className="flex items-center justify-start gap-3">
                        <div className="relative flex items-center justify-center h-10 w-10 shrink-0 rounded-full bg-base border-2 border-primary shadow-sm flex-none">
                          <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent"></div>
                          <span className="text-lg font-black italic tracking-tighter text-primary z-10 m-0 leading-none">
                            SH
                          </span>
                        </div>
                        <h1 className="text-lg font-bold tracking-widest text-content shrink-0 m-0 leading-none">
                          BITEBUDDY CHAT
                        </h1>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Close Button */}
                      <button
                        onClick={() => {
                          setIsWidgetOpen(false);
                          document.getElementById('main-focus-element')?.focus() || document.body.focus();
                        }}
                        style={{ position: 'absolute', right: '1rem', top: '1rem' }}
                        className="opacity-20 hover:opacity-100 bg-black/60 hover:bg-red-500/90 text-zinc-300 hover:text-white p-2 rounded-full transition-all group focus:outline-none focus:opacity-100 z-[9999]"
                        title="Close Chatbot"
                      >
                        <X size={24} className="group-hover:scale-110 transition-transform" />
                      </button>

                      {/* View Toggles */}
                      <div className="hidden md:flex bg-surface-hover rounded-lg p-1 border border-border">
                        <button
                          onClick={() => setViewMode("PC")}
                          title="Mobile Drawer View"
                          className={cn(
                            "p-1.5 rounded-md transition-all flex items-center justify-center",
                            viewMode === "PC"
                              ? "bg-primary text-[#0F172A] dark:text-white shadow"
                              : "text-content-muted hover:text-primary",
                          )}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              width="14"
                              height="20"
                              x="5"
                              y="2"
                              rx="2"
                              ry="2"
                            />
                            <path d="M12 18h.01" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setViewMode("MOBILE")}
                          title="PC Full Screen View"
                          className={cn(
                            "p-1.5 rounded-md transition-all flex items-center justify-center",
                            viewMode === "MOBILE"
                              ? "bg-primary text-[#0F172A] dark:text-white shadow"
                              : "text-content-muted hover:text-primary",
                          )}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect width="20" height="14" x="2" y="3" rx="2" />
                            <line x1="8" x2="16" y1="21" y2="21" />
                            <line x1="12" x2="12" y1="17" y2="21" />
                          </svg>
                        </button>
                      </div>
                      {orderCart.length > 0 && cartTick >= 0 && (
                        <motion.div
                          className="relative"
                          key={cartTick + "bounce"}
                          initial={{ scale: 1 }}
                          animate={{ scale: [1, 1.2, 0.9, 1.1, 1] }}
                          transition={{ duration: 0.4 }}
                        >
                          <button
                            onClick={() =>
                              setIsCartDrawerOpen(!isCartDrawerOpen)
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-hover text-primary hover:text-white hover:bg-primary transition-colors"
                          >
                            <ShoppingBag size={20} />
                          </button>
                          <motion.span
                            key={`badge-${cartTick}`}
                            initial={{ scale: 0.5 }}
                            animate={{ scale: [1, 1.4, 0.9, 1.2, 1] }}
                            transition={{ duration: 0.4 }}
                            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white pointer-events-none shadow-sm"
                          >
                            {orderCart.reduce((acc, item) => acc + item.qty, 0)}
                          </motion.span>
                        </motion.div>
                      )}
                      <button
                        onClick={toggleTheme}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-hover text-content-muted hover:text-content"
                      >
                        {theme === "dark" ? (
                          <Sun size={20} />
                        ) : (
                          <Moon size={20} />
                        )}
                      </button>
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-zinc-900 to-red-500 text-white font-black shadow-lg shadow-red-500/20 cursor-pointer hover:scale-105 transition-transform"
                        title={user.email}
                      >
                        {(user.user_metadata?.name ||
                          user.email ||
                          "U")[0].toUpperCase()}
                      </div>
                    </div>
                  </header>

                  {/* Main Area Body */}
                  {showSettings ? (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-10 bg-base flex justify-center items-start">
                      <div
                        ref={settingsModalRef}
                        className="w-full max-w-3xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]"
                      >
                        {/* Left Sidebar Tabs */}
                        <div className="w-full md:w-64 bg-surface-hover border-b md:border-b-0 md:border-r border-border p-6 flex flex-col gap-2">
                          <button
                            onClick={() => setShowSettings(false)}
                            className="text-left text-xl font-medium text-content mb-6 tracking-tight hover:opacity-80 transition-opacity outline-none"
                          >
                            Back
                          </button>

                          <button
                            onClick={() => setActiveSettingsTab("profile")}
                            className={cn(
                              "text-left px-4 py-3 rounded-lg text-sm font-semibold transition-colors flex items-center gap-3",
                              activeSettingsTab === "profile"
                                ? "bg-primary text-[#0F172A] dark:text-white shadow-md shadow-primary/20"
                                : "text-content-muted hover:bg-border/50 hover:text-content",
                            )}
                          >
                            <User size={18} /> Account Profile
                          </button>
                          <button
                            onClick={() => setActiveSettingsTab("config")}
                            className={cn(
                              "text-left px-4 py-3 rounded-lg text-sm font-semibold transition-colors flex items-center gap-3",
                              activeSettingsTab === "config"
                                ? "bg-primary text-[#0F172A] dark:text-white shadow-md shadow-primary/20"
                                : "text-content-muted hover:bg-border/50 hover:text-content",
                            )}
                          >
                            <Settings size={18} /> App Configuration
                          </button>
                          <button
                            onClick={() => setActiveSettingsTab("layout")}
                            className={cn(
                              "text-left px-4 py-3 rounded-lg text-sm font-semibold transition-colors flex items-center gap-3",
                              activeSettingsTab === "layout"
                                ? "bg-primary text-[#0F172A] dark:text-white shadow-md shadow-primary/20"
                                : "text-content-muted hover:bg-border/50 hover:text-content",
                            )}
                          >
                            <Monitor size={18} /> Layout Management
                          </button>


                        </div>

                        {/* Right Content Area */}
                        <div className="flex-1 p-8 bg-surface">
                          {activeSettingsTab === "profile" && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-8"
                            >
                              <div>
                                <h3 className="text-lg font-bold text-content tracking-tight">
                                  Account Profile
                                </h3>
                                <p className="text-sm text-content-muted mt-1">
                                  Manage your identity and contact preferences.
                                </p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 p-5 rounded-xl md:col-span-2 flex items-center justify-between">
                                  <div>
                                    <div className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-1">
                                      SpiceHub Rewards
                                    </div>
                                    <div className="text-2xl font-black text-white">
                                      {orderHistory.reduce((acc, order) => acc + Math.floor((order.total || 0) / 10), 0)} <span className="text-sm font-medium text-yellow-500/80">Pts</span>
                                    </div>
                                  </div>
                                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                                    🌟
                                  </div>
                                </div>
                                <div className="bg-base border border-border p-5 rounded-xl">
                                  <div className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                                    User Name
                                  </div>
                                  <div className="text-base font-semibold text-content">
                                    {user.user_metadata?.name ||
                                      "Administrator"}
                                  </div>
                                </div>
                                <div className="bg-base border border-border p-5 rounded-xl">
                                  <div className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                                    Gmail Address
                                  </div>
                                  <div className="text-base font-semibold text-content">
                                    {user.email}
                                  </div>
                                </div>
                                <div className="bg-base border border-border p-5 rounded-xl md:col-span-2">
                                  <div className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                                    Mobile Number
                                  </div>
                                  <div className="text-base font-semibold text-content">
                                    {user.user_metadata?.phone ||
                                      "+92 300 0000000"}
                                  </div>
                                </div>
                              </div>

                              <div className="pt-6 border-t border-border mt-8">
                                <button
                                  onClick={user?.id === 'guest' && onLoginClick ? onLoginClick : onLogout}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-sm font-bold transition-all hover:bg-red-500/20 hover:scale-105 active:scale-95 shadow-sm"
                                >
                                  <LogOut size={16} /> {user?.id === 'guest' ? 'Login / Sign Up' : 'Secure Logout Session'}
                                </button>
                              </div>
                            </motion.div>
                          )}

                          {activeSettingsTab === "config" && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-8"
                            >
                              <div>
                                <h3 className="text-lg font-bold text-content tracking-tight">
                                  App Configuration
                                </h3>
                                <p className="text-sm text-content-muted mt-1">
                                  Customize system interface and notifications.
                                </p>
                              </div>
                              <div className="space-y-4">
                                <div className="flex items-center justify-between p-5 bg-base border border-border rounded-xl">
                                  <div>
                                    <div className="font-semibold text-content text-sm">
                                      Theme Appearance
                                    </div>
                                    <div className="text-xs text-content-muted mt-1">
                                      Toggle Luxury Dark & Premium Light engine.
                                    </div>
                                  </div>
                                  <button
                                    onClick={toggleTheme}
                                    className={cn(
                                      "p-2 rounded-lg border transition-all flex items-center justify-center gap-2 px-4 shadow-sm",
                                      theme === "dark"
                                        ? "bg-surface border-border text-white"
                                        : "bg-white border-border text-slate-800",
                                    )}
                                  >
                                    {theme === "dark" ? (
                                      <>
                                        <Moon size={16} />{" "}
                                        <span className="text-sm font-semibold hidden sm:inline">
                                          Dark Mode
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Sun size={16} />{" "}
                                        <span className="text-sm font-semibold hidden sm:inline">
                                          Light Mode
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <div className="flex items-center justify-between p-5 bg-base border border-border rounded-xl">
                                  <div>
                                    <div className="font-semibold text-content text-sm">
                                      Sound Notifications
                                    </div>
                                    <div className="text-xs text-content-muted mt-1">
                                      Play acoustic cues on new chat ingress.
                                    </div>
                                  </div>
                                  <button className="flex h-6 w-11 items-center rounded-full bg-primary p-1 shadow-inner shadow-primary/30 transition-all">
                                    <div className="h-4 w-4 rounded-full bg-white translate-x-5 shadow-md shadow-black/20" />
                                  </button>
                                </div>

                                <div className="flex items-center justify-between p-5 bg-base border border-border rounded-xl border-l-4 border-l-red-500">
                                  <div>
                                    <div className="font-semibold text-content text-sm">
                                      Clear Conversational Logs
                                    </div>
                                    <div className="text-xs text-content-muted mt-1">
                                      Permanently flush local database threads.
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      handleReset();
                                      setShowSettings(false);
                                    }}
                                    className="px-4 py-2 bg-surface text-red-500 border border-border rounded-lg text-xs font-bold transition-all hover:bg-red-500/10 shadow-sm uppercase tracking-wider"
                                  >
                                    Flush Cache
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {activeSettingsTab === "layout" && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-8"
                            >
                              <div>
                                <h3 className="text-lg font-bold text-content tracking-tight">
                                  Layout Management
                                </h3>
                                <p className="text-sm text-content-muted mt-1">
                                  Control viewport constraints and dynamic
                                  scaling parameters.
                                </p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                                <button
                                  onClick={() => setViewMode("PC")}
                                  className={cn(
                                    "flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 transition-all w-full",
                                    viewMode === "PC"
                                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                                      : "border-border bg-base hover:border-border/80",
                                  )}
                                >
                                  <svg
                                    width="30"
                                    height="52"
                                    viewBox="0 0 30 52"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={
                                      viewMode === "PC"
                                        ? "text-primary"
                                        : "text-content-muted"
                                    }
                                  >
                                    <rect
                                      x="2"
                                      y="2"
                                      width="26"
                                      height="48"
                                      rx="4"
                                    />
                                    <path d="M12 44h6" />
                                  </svg>
                                  <div className="text-sm font-bold text-content">
                                    Mobile Drawer Shape
                                  </div>
                                  <div className="text-xs text-content-muted text-center px-4">
                                    Compact structure restricted to a 380px boundary logic.
                                  </div>
                                </button>

                                <button
                                  onClick={() => setViewMode("MOBILE")}
                                  className={cn(
                                    "flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 transition-all w-full",
                                    viewMode === "MOBILE"
                                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                                      : "border-border bg-base hover:border-border/80",
                                  )}
                                >
                                  <svg
                                    width="60"
                                    height="42"
                                    viewBox="0 0 60 42"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={
                                      viewMode === "MOBILE"
                                        ? "text-primary"
                                        : "text-content-muted"
                                    }
                                  >
                                    <rect
                                      x="2"
                                      y="2"
                                      width="56"
                                      height="34"
                                      rx="3"
                                    />
                                    <path d="M14 40h32" />
                                    <path d="M30 36v4" />
                                  </svg>
                                  <div className="text-sm font-bold text-content">
                                    PC Full-Screen Mode
                                  </div>
                                  <div className="text-xs text-content-muted text-center px-4">
                                    Absolute edge-to-edge fluid 100vw stretch behavior.
                                  </div>
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Chat Body */}
                      <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 flex flex-col relative"
                        onTouchStart={(e) => {
                          if (
                            viewMode === "MOBILE" &&
                            scrollRef.current?.scrollTop === 0
                          ) {
                            touchStartY.current = e.touches[0].clientY;
                          } else {
                            touchStartY.current = 0;
                          }
                        }}
                        onTouchMove={(e) => {
                          if (touchStartY.current > 0) {
                            const currentY = e.touches[0].clientY;
                            const diff = currentY - touchStartY.current;
                            if (diff > 0 && diff < 150) {
                              setPullDistance(diff);
                            }
                          }
                        }}
                        onTouchEnd={() => {
                          if (pullDistance > 60) {
                            setIsRefreshing(true);
                            setMessages([getInitialMessage()]);
                            setTimeout(() => {
                              setIsRefreshing(false);
                              setPullDistance(0);
                            }, 1000);
                          } else {
                            setPullDistance(0);
                          }
                          touchStartY.current = 0;
                        }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          const button = target.closest("button[data-pill]");
                          if (button) {
                            const pillText = button.getAttribute("data-pill");
                            if (pillText) {
                              handlePillClick(pillText);
                            }
                          }
                        }}
                      >
                        {viewMode === "MOBILE" &&
                          (pullDistance > 0 || isRefreshing) && (
                            <div
                              className="absolute top-0 left-0 right-0 flex justify-center py-2 z-10"
                              style={{
                                transform: `translateY(${Math.min(pullDistance, 60)}px)`,
                              }}
                            >
                              <div className="bg-surface border border-border rounded-full p-2 shadow-lg flex items-center justify-center">
                                {isRefreshing ? (
                                  <Loader2
                                    className="animate-spin text-primary"
                                    size={20}
                                  />
                                ) : (
                                  <div className="text-xs font-bold text-content-muted px-2">
                                    Pull to refresh...
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        {messages.map((msg, idx) => (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={msg.id + "-" + idx}
                            className={cn(
                              "flex w-full mb-6",
                              msg.role === "user"
                                ? "justify-end ml-auto max-w-2xl"
                                : "justify-start max-w-3xl",
                            )}
                          >
                            <div
                              className={cn(
                                "flex w-full",
                                msg.role === "user"
                                  ? "items-start justify-end space-x-4 ml-auto"
                                  : "items-start space-x-4",
                              )}
                            >
                              {msg.role === "assistant" && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-[#0F172A] dark:text-white shadow-lg shadow-primary/20 uppercase overflow-hidden">
                                  {activeBotConfig?.avatarUrl ? (
                                     <img src={activeBotConfig.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                  ) : (
                                     activeBotConfig ? activeBotConfig.name.substring(0, 2) : "BB"
                                  )}
                                </div>
                              )}
                              <div
                                className={cn(
                                  "flex flex-col space-y-2 w-full",
                                  msg.role === "user"
                                    ? "items-end"
                                    : "items-start",
                                )}
                              >
                                <div
                                  className={cn(
                                    "p-4 rounded-2xl w-fit relative",
                                    msg.role === "user"
                                      ? "bg-primary text-[#0F172A] dark:text-white rounded-tr-none shadow-lg shadow-primary/20"
                                      : "bg-surface text-content rounded-tl-none border border-border/50 shadow-xl",
                                  )}
                                >
                                  {msg.isLoading ? (
                                    <div className="flex flex-col items-start gap-1">
                                      <div className="flex items-center gap-2 h-6 px-1">
                                        <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider whitespace-nowrap">
                                          {activeBotConfig?.name || "BiteBuddy"} is writing
                                        </span>
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <motion.div
                                            animate={{
                                              opacity: [0.3, 1, 0.3],
                                              y: [0, -3, 0],
                                            }}
                                            transition={{
                                              repeat: Infinity,
                                              duration: 1.2,
                                              delay: 0,
                                            }}
                                            className="h-1.5 w-1.5 rounded-full bg-primary"
                                          />
                                          <motion.div
                                            animate={{
                                              opacity: [0.3, 1, 0.3],
                                              y: [0, -3, 0],
                                            }}
                                            transition={{
                                              repeat: Infinity,
                                              duration: 1.2,
                                              delay: 0.2,
                                            }}
                                            className="h-1.5 w-1.5 rounded-full bg-primary"
                                          />
                                          <motion.div
                                            animate={{
                                              opacity: [0.3, 1, 0.3],
                                              y: [0, -3, 0],
                                            }}
                                            transition={{
                                              repeat: Infinity,
                                              duration: 1.2,
                                              delay: 0.4,
                                            }}
                                            className="h-1.5 w-1.5 rounded-full bg-primary"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ) : msg.isEscalation ? (
                                    <div className="flex flex-col bg-red-500/10 border border-red-500/20 rounded-xl p-5 w-[280px]">
                                      <div className="flex items-center gap-3 mb-3">
                                        <Headphones
                                          size={24}
                                          className="text-red-500"
                                        />
                                        <h4 className="font-bold text-red-500 uppercase tracking-widest text-xs">
                                          Human Support
                                        </h4>
                                      </div>
                                      <p className="text-sm text-content-muted mb-4 leading-relaxed font-medium">
                                        To provide the best help, we've
                                        escalated this thread to a live human
                                        agent.
                                      </p>
                                      <button
                                        onClick={async () => {
                                           if (user?.id) {
                                               await supabase.from("message_logs")
                                                 .update({ is_escalated: true } as any)
                                                 .eq("session_id", sessionId.current);
                                           }
                                           window.dispatchEvent(
                                              new CustomEvent("ADMIN_ESCALATE", {
                                                detail: { sessionId: sessionId.current },
                                              })
                                           );
                                        }}
                                        className="bg-red-500 hover:bg-red-600 text-white w-full py-2.5 rounded-lg flex items-center justify-center font-bold text-sm shadow-lg shadow-red-500/20 transition-all cursor-pointer"
                                      >
                                        🙋‍♂️ Talk to a Human
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col">
                                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                                        {msg.text}
                                      </p>
                                      {msg.showCalendar && (
                                        <div className="flex gap-2 w-full max-w-[280px] sm:max-w-xs overflow-x-auto pb-2 pt-3 scrollbar-none snap-x">
                                          {[...Array(7)].map((_, i) => {
                                            const d = new Date();
                                            d.setDate(d.getDate() + i);
                                            return (
                                              <button
                                                key={i}
                                                onClick={() =>
                                                  handleSend(
                                                    d.toLocaleDateString(
                                                      "en-US",
                                                      {
                                                        weekday: "short",
                                                        month: "short",
                                                        day: "numeric",
                                                      },
                                                    ),
                                                  )
                                                }
                                                className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-surface shrink-0 snap-start hover:border-primary transition-colors"
                                              >
                                                <span className="text-xs uppercase hover:text-primary text-content-muted font-bold">
                                                  {d.toLocaleDateString(
                                                    "en-US",
                                                    { weekday: "short" },
                                                  )}
                                                </span>
                                                <span className="text-lg font-black">
                                                  {d.getDate()}
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {msg.pills && msg.pills.length > 0 && (
                                  <div className="flex flex-wrap gap-2 pt-2">
                                    {msg.pills.map((pill, i) => (
                                      <button
                                        key={i}
                                        data-pill={pill}
                                        className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white rounded-xl px-4 py-2 text-sm font-medium transition-transform hover:scale-105 active:scale-95 shadow-sm"
                                      >
                                        {pill}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {msg.menuCategories &&
                                  msg.menuCategories.length > 0 && (
                                    <div className="flex flex-col gap-4 mt-4 w-full">
                                      <input
                                        type="text"
                                        placeholder="🔍 Search entire menu..."
                                        value={menuSearchQuery}
                                        onChange={(e) => {
                                          // We use the global menuSearchQuery state
                                          // but this is attached to ChatApp, so it will live-update
                                          setMenuSearchQuery(e.target.value);
                                        }}
                                        className="w-full bg-surface border border-border text-content px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm shadow-sm transition-all"
                                      />
                                      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none snap-x mt-2">
                                        <motion.button
                                          layout
                                          onClick={() =>
                                            setActiveCategoryFilter("All")
                                          }
                                          className={cn(
                                            "flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border transition-colors snap-start",
                                            activeCategoryFilter === "All"
                                              ? "bg-primary text-[#0F172A] dark:text-white border-primary"
                                              : "bg-surface text-content-muted border-border hover:border-primary/50",
                                          )}
                                        >
                                          All
                                        </motion.button>
                                        {msg.menuCategories.map((cat, idx) => (
                                          <motion.button
                                            layout
                                            key={idx}
                                            onClick={() =>
                                              setActiveCategoryFilter(
                                                cat.category,
                                              )
                                            }
                                            className={cn(
                                              "flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border transition-colors snap-start whitespace-nowrap flex items-center gap-2",
                                              activeCategoryFilter ===
                                                cat.category
                                                ? "bg-primary text-[#0F172A] dark:text-white border-primary"
                                                : "bg-surface text-content-muted border-border hover:border-primary/50",
                                            )}
                                          >
                                            {cat.category === "Burgers"
                                              ? "🍔"
                                              : cat.category === "Pizza"
                                                ? "🍕"
                                                : cat.category === "Biryani"
                                                  ? "🍚"
                                                  : "🥤"}{" "}
                                            {cat.category}
                                          </motion.button>
                                        ))}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                                        <AnimatePresence mode="popLayout">
                                          {(() => {
                                            const categoriesToRender = activeCategoryFilter === "Most Popular"
                                              ? [{
                                                  category: "Most Popular",
                                                  items: msg.menuCategories.flatMap((c: any) => c.items.map((item: any) => ({...item, originalCategory: c.category})))
                                                    .sort((a: any, b: any) => (itemFrequencies[b.name] || 0) - (itemFrequencies[a.name] || 0))
                                                    .slice(0, 4)
                                                }]
                                              : msg.menuCategories.filter((cat: any) => activeCategoryFilter === "All" || cat.category === activeCategoryFilter);

                                            return categoriesToRender.map((cat: any, i: number) => {
                                              const filteredItems = cat.items.filter((item: any) =>
                                                item.name.toLowerCase().includes(menuSearchQuery.toLowerCase())
                                              );
                                              if (filteredItems.length === 0) return null;

                                              // Distinctive category accent colors
                                              const catBg =
                                                cat.category === "Most Popular"
                                                  ? "bg-[#D4AF37]/20"
                                                  : cat.category === "Burgers"
                                                  ? "bg-[#D4AF37]/10"
                                                  : cat.category === "Pizza"
                                                    ? "bg-red-500/10"
                                                    : cat.category === "Biryani"
                                                      ? "bg-[#D4AF37]/10"
                                                      : "bg-blue-500/10";
                                              const catBorder =
                                                cat.category === "Most Popular"
                                                  ? "border-[#D4AF37]"
                                                  : cat.category === "Burgers"
                                                  ? "border-[#D4AF37]/20"
                                                  : cat.category === "Pizza"
                                                    ? "border-red-500/20"
                                                    : cat.category === "Biryani"
                                                      ? "border-[#D4AF37]/20"
                                                      : "border-blue-500/20";
                                              const catText =
                                                cat.category === "Most Popular"
                                                  ? "text-[#D4AF37] drop-shadow-md"
                                                  : cat.category === "Burgers"
                                                  ? "text-[#D4AF37]"
                                                  : cat.category === "Pizza"
                                                    ? "text-red-600 dark:text-red-400"
                                                    : cat.category === "Biryani"
                                                      ? "text-[#D4AF37]"
                                                      : "text-blue-600 dark:text-blue-400";

                                              return (
                                                <motion.div
                                                  layout
                                                  initial={{
                                                    opacity: 0,
                                                    scale: 0.95,
                                                  }}
                                                  animate={{
                                                    opacity: 1,
                                                    scale: 1,
                                                  }}
                                                  exit={{
                                                    opacity: 0,
                                                    scale: 0.95,
                                                  }}
                                                  transition={{
                                                    layout: {
                                                      type: "spring",
                                                      stiffness: 300,
                                                      damping: 30,
                                                    },
                                                    opacity: { duration: 0.2 },
                                                    scale: { duration: 0.2 },
                                                    delay: i * 0.05,
                                                  }}
                                                  key={cat.category}
                                                  className={`p-4 rounded-2xl border ${catBg} ${catBorder} shadow-sm backdrop-blur-sm transition-colors`}
                                                >
                                                  <h4
                                                    className={`font-black text-lg ${catText} mb-3 flex items-center gap-2`}
                                                  >
                                                    {cat.category === "Most Popular"
                                                        ? "🔥"
                                                        : cat.category === "Burgers"
                                                      ? "🍔"
                                                      : cat.category === "Pizza"
                                                        ? "🍕"
                                                        : cat.category ===
                                                            "Biryani"
                                                          ? "🍚"
                                                          : "🥤"}{" "}
                                                    {cat.category}
                                                  </h4>
                                                  <div className="flex flex-col gap-2">
                                                    {filteredItems.map(
                                                      (
                                                        item: any,
                                                        j: number,
                                                      ) => (
                                                        <motion.button
                                                          layout
                                                          initial={{
                                                            opacity: 0,
                                                          }}
                                                          animate={{
                                                            opacity: 1,
                                                          }}
                                                          key={item.name}
                                                          onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setSelectedProduct({
                                                              name: item.name,
                                                              price: item.price,
                                                              category:
                                                                item.originalCategory || item.category,
                                                            });
                                                            setProductQty(1);
                                                            setProductSize(
                                                              "Medium",
                                                            );
                                                          }}
                                                          className="text-left w-full bg-base/50 hover:bg-base/80 p-2.5 rounded-xl transition-all flex items-center group shadow-sm border border-transparent hover:border-border gap-3"
                                                        >
                                                          <div className="flex-1 flex flex-col justify-center shrink-0 min-w-0">
                                                            <span className="font-bold text-sm text-content group-hover:text-primary transition-colors truncate">
                                                              {item.name}
                                                            </span>
                                                          </div>
                                                          <div className="bg-surface px-2 py-1 rounded text-xs font-black text-content-muted border border-border group-hover:border-primary/30 transition-colors shrink-0">
                                                            Rs. {item.price}
                                                          </div>
                                                        </motion.button>
                                                      ),
                                                    )}
                                                  </div>
                                                </motion.div>
                                              );
                                            })
                                          })()}
                                        </AnimatePresence>
                                      </div>
                                    </div>
                                  )}
                                {msg.orderData && (
                                  <div className="flex gap-2 pt-2">
                                    <button
                                      onClick={() =>
                                        generatePDFReceipt(msg.orderData)
                                      }
                                      className="flex items-center gap-2 bg-base border border-border text-primary hover:bg-primary/10 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
                                    >
                                      <Download size={14} /> Download Receipt
                                    </button>
                                    <button
                                      onClick={() =>
                                        onCancelOrder(msg.orderData.id)
                                      }
                                      className="flex items-center gap-2 bg-base border border-border text-red-500 hover:bg-red-500/10 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
                                    >
                                      <XCircle size={14} /> Cancel Order
                                    </button>
                                  </div>
                                )}
                                {msg.trackingData && (
                                  <div className="mt-4 p-4 rounded-xl bg-surface border border-border flex flex-col gap-4">
                                    <div className="text-xs font-black uppercase tracking-widest text-primary">
                                      Live Tracking
                                    </div>
                                    <div className="flex flex-col gap-4 relative mt-2 pt-2">
                                      <div className="absolute top-4 left-4 right-4 h-1 bg-border rounded-full z-0"></div>
                                      <motion.div
                                        layout
                                        initial={{ width: "0%" }}
                                        animate={{
                                          width: ["Delivered"].includes(
                                            msg.trackingData.status,
                                          )
                                            ? "100%"
                                            : ["Out for Delivery"].includes(
                                                  msg.trackingData.status,
                                                )
                                              ? "65%"
                                              : ["Preparing"].includes(
                                                    msg.trackingData.status,
                                                  )
                                                ? "33%"
                                                : "0%",
                                        }}
                                        transition={{
                                          duration: 1,
                                          ease: "easeInOut",
                                        }}
                                        className="absolute top-4 left-4 h-1 bg-primary rounded-full z-0 origin-left shadow-[0_0_8px_var(--color-primary)]"
                                      ></motion.div>

                                      <div className="flex justify-between relative z-10 -mt-[14px]">
                                        <div className="flex flex-col items-center gap-2">
                                          <motion.div
                                            layout
                                            className={cn(
                                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-colors duration-500",
                                              msg.trackingData.status !==
                                                "Cancelled"
                                                ? "bg-primary text-[#0F172A] dark:text-white border-2 border-primary"
                                                : "bg-base border border-border text-transparent",
                                            )}
                                          >
                                            <Check size={14} strokeWidth={4} />
                                          </motion.div>
                                          <motion.div
                                            layout
                                            className={cn(
                                              "text-[10px] sm:text-xs font-bold text-center",
                                              msg.trackingData.status !==
                                                "Cancelled"
                                                ? "text-content"
                                                : "text-content-muted",
                                            )}
                                          >
                                            Placed
                                          </motion.div>
                                        </div>

                                        <div className="flex flex-col items-center gap-2">
                                          <motion.div
                                            layout
                                            className={cn(
                                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 bg-base transition-colors duration-500",
                                              [
                                                "Preparing",
                                                "Out for Delivery",
                                                "Delivered",
                                              ].includes(
                                                msg.trackingData.status,
                                              )
                                                ? "border-primary bg-primary text-[#0F172A] dark:text-white shadow-[0_0_10px_var(--color-primary)]"
                                                : "border-border text-transparent",
                                            )}
                                          >
                                            <Check size={14} strokeWidth={4} />
                                          </motion.div>
                                          <motion.div
                                            layout
                                            className={cn(
                                              "text-[10px] sm:text-xs font-bold text-center",
                                              [
                                                "Preparing",
                                                "Out for Delivery",
                                                "Delivered",
                                              ].includes(
                                                msg.trackingData.status,
                                              )
                                                ? "text-content"
                                                : "text-content-muted",
                                            )}
                                          >
                                            Kitchen
                                          </motion.div>
                                        </div>

                                        <div className="flex flex-col items-center gap-2">
                                          <motion.div
                                            layout
                                            className={cn(
                                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 bg-base transition-colors duration-500",
                                              [
                                                "Out for Delivery",
                                                "Delivered",
                                              ].includes(
                                                msg.trackingData.status,
                                              )
                                                ? "border-primary bg-primary text-[#0F172A] dark:text-white shadow-[0_0_10px_var(--color-primary)]"
                                                : "border-border text-transparent",
                                            )}
                                          >
                                            <Check size={14} strokeWidth={4} />
                                          </motion.div>
                                          <motion.div
                                            layout
                                            className={cn(
                                              "text-[10px] sm:text-xs font-bold text-center",
                                              [
                                                "Out for Delivery",
                                                "Delivered",
                                              ].includes(
                                                msg.trackingData.status,
                                              )
                                                ? "text-content"
                                                : "text-content-muted",
                                            )}
                                          >
                                            Out
                                          </motion.div>
                                        </div>

                                        <div className="flex flex-col items-center gap-2">
                                          <motion.div
                                            layout
                                            className={cn(
                                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 bg-base transition-colors duration-500",
                                              msg.trackingData.status ===
                                                "Delivered"
                                                ? "border-[#10B981] bg-[#10B981] text-black shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                                : "border-border text-transparent",
                                            )}
                                          >
                                            <Check size={14} strokeWidth={4} />
                                          </motion.div>
                                          <motion.div
                                            layout
                                            className={cn(
                                              "text-[10px] sm:text-xs font-bold text-center transition-colors duration-500",
                                              msg.trackingData.status ===
                                                "Delivered"
                                                ? "text-[#10B981]"
                                                : "text-content-muted",
                                            )}
                                          >
                                            Delivered
                                          </motion.div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Spacer removed */}

                      {/* Input Footer */}
                      <div className="p-6 bg-base/90 border-t border-border relative">
                        <div className="mx-auto flex max-w-4xl items-center space-x-4 bg-surface-hover p-2 rounded-2xl border border-border shadow-inner">
                          <button className="p-3 text-content-muted hover:text-white transition-colors">
                            <Paperclip size={20} />
                          </button>
                          <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder={`Ask ${activeBotConfig?.name || "BiteBuddy"} or type your order...`}
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
                          <p className="text-[10px] text-content-muted font-mono tracking-widest uppercase">
                            SECURED BY SPICE-CORE v2.4.1
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Overlays */}
                  <AnimatePresence>
                    {isCartDrawerOpen && (
                      <motion.div
                        key="cart-drawer-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex justify-end"
                      >
                        <motion.div
                          ref={cartDrawerRef}
                          key="cart-drawer-content"
                          initial={{ x: "100%", opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: "100%", opacity: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30,
                          }}
                          className="w-full max-w-2xl bg-base h-full shadow-2xl flex flex-col p-6 overflow-y-auto border-l border-border"
                        >
                          <div className="flex justify-between items-center pb-6 border-b border-border">
                            <button
                              autoFocus
                              onClick={() => setIsCartDrawerOpen(false)}
                              className="text-content-muted hover:text-content transition-colors p-2 rounded-full outline-none focus:ring-2 focus:ring-primary mr-4 bg-surface-hover"
                            >
                              <X size={24} />
                            </button>
                            <h2 className="text-2xl font-semibold text-content tracking-tight flex items-center gap-3 flex-1">
                              <ShoppingBag size={24} /> Total Checkout
                            </h2>
                          </div>

                          {orderCart.length === 0 ? (
                            <div className="py-24 text-center flex flex-col items-center justify-center gap-4 flex-1">
                              <ShoppingBag
                                size={48}
                                className="text-content-muted/30"
                              />
                              <p className="font-medium text-content-muted">
                                Your cart is currently empty.
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col flex-1 mt-6 w-full">
                              <div className="flex flex-col gap-3 overflow-y-auto pr-2 pb-10">
                                {orderCart.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center bg-base px-4 py-3 rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow"
                                  >
                                    <div className="flex items-center gap-4">
                                      <span className="text-content-muted font-mono bg-surface px-2 py-1 rounded text-sm">
                                        {item.qty}x
                                      </span>
                                      <span className="font-semibold text-content text-base">
                                        {item.name}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-content text-base">
                                      Rs. {item.price * item.qty}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="pt-6 border-t border-border flex justify-between items-center mt-auto pb-4 sticky bottom-0 bg-base">
                                <span className="font-bold text-2xl text-content tracking-tight">
                                  Total: Rs.{" "}
                                  {orderCart.reduce(
                                    (acc, item) => acc + item.price * item.qty,
                                    0,
                                  )}
                                </span>
                                <button
                                  onClick={() => {
                                    handleSend("Checkout");
                                    setIsCartDrawerOpen(false);
                                  }}
                                  className="bg-primary text-[#0F172A] dark:text-white px-8 py-3 rounded-xl font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-95 shadow-md"
                                >
                                  Proceed to Checkout
                                </button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </motion.div>
                    )}
                    {showOrderHistory && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center"
                      >
                        <div className="w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl relative">
                          <h2 className="text-xl font-bold mb-4 flex items-center text-content">
                            <ShoppingBag className="mr-2" /> Your Order History
                          </h2>
                          <div className="space-y-3 h-64 overflow-y-auto">
                            {orderHistory.length === 0 ? (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="h-full flex flex-col items-center justify-center p-6 text-center"
                              >
                                <motion.div
                                  animate={{ rotate: [0, 5, -5, 0] }}
                                  transition={{ repeat: Infinity, duration: 4 }}
                                  className="mb-4 text-primary opacity-20"
                                >
                                  <History size={64} strokeWidth={1} />
                                </motion.div>
                                <h4 className="text-content font-bold mb-1">
                                  Aapki History Khali Hai
                                </h4>
                                <p className="text-content-muted text-xs">
                                  Aapne abhi tak koi order nahi kiya.
                                </p>
                              </motion.div>
                            ) : (
                              orderHistory.map((order, idx) => (
                                <div
                                  key={idx}
                                  className="p-4 bg-surface-hover rounded-xl border border-border text-sm flex flex-col gap-2 relative group"
                                >
                                  <div className="flex justify-between items-center text-content">
                                    <span className="font-bold">
                                      {order.id}
                                    </span>
                                    <span className="text-primary font-bold">
                                      Rs. {order.total}
                                    </span>
                                  </div>
                                  <p className="text-content-muted">
                                    {order.details}
                                  </p>
                                  <div className="flex justify-between items-center mt-1">
                                    <div>
                                      <span className="text-[10px] text-content-muted block">
                                        {new Date(order.date).toLocaleString()}
                                      </span>
                                      <span
                                        className={cn(
                                          "text-xs px-2 py-0.5 rounded-full inline-block mt-1 font-medium",
                                          getStatusColor(order.status),
                                        )}
                                      >
                                        {order.status}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {order.status !== "Delivered" && (
                                        <button
                                          onClick={() =>
                                            markAsDelivered(order.id)
                                          }
                                          className="flex items-center justify-center w-8 h-8 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors"
                                          title="Mark as Delivered test"
                                        >
                                          <CheckCircle size={16} />
                                        </button>
                                      )}
                                      {order.status === "Preparing" && (
                                        <button
                                          onClick={() =>
                                            onCancelOrder(order.id)
                                          }
                                          className="flex items-center justify-center w-8 h-8 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                                          title="Cancel Order"
                                        >
                                          <XCircle size={16} />
                                        </button>
                                      )}
                                      <button
                                        onClick={() =>
                                          onQuickReorder(order)
                                        }
                                        className="flex items-center justify-center w-8 h-8 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-lg transition-colors"
                                        title="Quick Reorder"
                                      >
                                        <RefreshCw size={16} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          generatePDFReceipt(order)
                                        }
                                        className="flex items-center justify-center w-8 h-8 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                                        title="Download PDF Receipt"
                                      >
                                        <Download size={16} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          <button
                            onClick={() => setShowOrderHistory(false)}
                            className="mt-6 w-full px-6 py-3 bg-primary font-bold text-[#0F172A] dark:text-white rounded-xl hover:bg-primary/90 transition-transform active:scale-95 shadow-md shadow-primary/20"
                          >
                            Close
                          </button>
                        </div>
                      </motion.div>
                    )}
                    {successPopup && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center"
                      >
                        <div className="w-full max-w-sm bg-surface flex flex-col items-center p-8 rounded-[2rem] shadow-2xl border border-primary/30 relative overflow-hidden">
                          <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{
                              type: "spring",
                              stiffness: 200,
                              damping: 12,
                              delay: 0.1,
                            }}
                            className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6 border-2 border-green-500/50"
                          >
                            <Check size={40} className="text-green-500" />
                          </motion.div>
                          <h2 className="text-2xl font-bold text-white mb-2 text-center">
                            {successPopup.title}
                          </h2>
                          <p className="text-content-muted text-center mb-4 whitespace-pre-line">
                            {successPopup.message}
                          </p>

                          {successPopup.trackingId && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.4 }}
                              className="bg-surface border border-primary p-4 rounded-xl w-full text-center mb-6 shadow-sm"
                            >
                              <div className="text-[11px] text-primary uppercase tracking-widest font-black mb-1">
                                Tracking ID
                              </div>
                              <div className="text-xl font-mono text-content tracking-widest">
                                {successPopup.trackingId}
                              </div>
                            </motion.div>
                          )}
                          <button
                            onClick={() => setSuccessPopup(null)}
                            className="w-full px-6 py-3 bg-primary text-[#0F172A] dark:text-white font-black uppercase tracking-wider rounded-xl shadow-lg hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
                          >
                            Done
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {reviewPopup && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                      >
                        <div className="w-full max-w-md bg-surface border border-border p-6 rounded-[2rem] shadow-2xl">
                          <h2 className="text-xl font-bold mb-2 text-center text-content">
                            Rate Your Order
                          </h2>
                          <p className="text-sm text-content-muted text-center mb-6">
                            How was your experience with order {reviewPopup}?
                          </p>
                          <div className="flex justify-center gap-2 mb-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setRating(star)}
                                className="focus:outline-none hover:scale-110 transition-transform"
                              >
                                <Star
                                  size={32}
                                  className={
                                    star <= rating
                                      ? "text-[#D4AF37] fill-[#D4AF37]"
                                      : "text-border"
                                  }
                                />
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
                            <button
                              onClick={() => setReviewPopup(null)}
                              className="flex-1 px-4 py-2 bg-surface-hover text-content text-sm font-bold rounded-xl hover:bg-border transition-colors active:scale-95"
                            >
                              Skip
                            </button>
                            <button
                              onClick={submitReview}
                              className="flex-1 px-4 py-2 bg-primary text-[#0F172A] dark:text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-transform hover:scale-[1.02] active:scale-95 shadow-md shadow-primary/20"
                            >
                              Submit Review
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {selectedProduct && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                      >
                        <div className="w-full max-w-md bg-surface border border-border p-6 rounded-3xl shadow-2xl relative">
                          <button
                            onClick={() => setSelectedProduct(null)}
                            className="absolute top-4 right-4 z-50 text-white bg-black/60 hover:bg-black p-1 rounded-full backdrop-blur-md transition-colors border border-white/20 shadow-lg"
                          >
                            <XCircle size={24} />
                          </button>

                          <div className="flex flex-col mb-6 relative group overflow-hidden rounded-2xl border border-border">
                            <div className="h-32 w-full bg-gradient-to-r from-zinc-900 to-[#D4AF37]/20 flex flex-col items-center justify-center relative overflow-hidden">
                              <div className="absolute inset-0 bg-base/50"></div>
                              <div className="z-10 flex items-center gap-4 text-white p-4 absolute bottom-0 left-0 w-full">
                                <div className="w-16 h-16 rounded-2xl bg-base/80 backdrop-blur-xl border border-white/10 flex items-center justify-center text-primary shadow-xl">
                                  <ShoppingBag size={28} />
                                </div>
                                <div>
                                  <h2 className="text-2xl font-black drop-shadow-md text-content">
                                    {selectedProduct.name}
                                  </h2>
                                  <p className="text-content-muted font-medium text-sm drop-shadow-md">
                                    {selectedProduct.category}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div>
                              <p className="font-bold mb-3">Select Size</p>
                              <div className="flex gap-3">
                                {["Small", "Medium", "Large"].map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => setProductSize(s as any)}
                                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${productSize === s ? "bg-primary border-primary text-white shadow-md" : "bg-surface border-border text-content hover:bg-surface-hover"}`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="font-bold mb-3">Quantity</p>
                              <div className="flex items-center gap-4 border border-border bg-surface rounded-xl p-2 w-fit">
                                <button
                                  onClick={() =>
                                    setProductQty(Math.max(1, productQty - 1))
                                  }
                                  className="p-2 rounded-lg bg-surface-hover text-content hover:bg-border transition-colors"
                                >
                                  -
                                </button>
                                <span className="font-bold w-4 text-center">
                                  {productQty}
                                </span>
                                <button
                                  onClick={() => setProductQty(productQty + 1)}
                                  className="p-2 rounded-lg bg-surface-hover text-content hover:bg-border transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-8 flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={(e) => {
                                const sizeMultiplier =
                                  productSize === "Small"
                                    ? 0.8
                                    : productSize === "Large"
                                      ? 1.3
                                      : 1;
                                const finalPrice = Math.round(
                                  selectedProduct.price * sizeMultiplier,
                                );
                                
                                const rect = e.currentTarget.getBoundingClientRect();
                                const id = crypto.randomUUID();
                                const emoji = selectedProduct.name.split(" ")[0] || "🛒";
                                setFlyingCartItems(prev => [...prev, { id, startX: rect.left + rect.width / 2, startY: rect.top, emoji }]);
                                setTimeout(() => {
                                  setFlyingCartItems(prev => prev.filter(item => item.id !== id));
                                }, 800);

                                orderCart.push({
                                  name: `${selectedProduct.name} (${productSize})`,
                                  price: finalPrice,
                                  qty: productQty,
                                });
                                setCartTick((t) => t + 1);
                                showToast("Item added to cart", {
                                  label: "View Cart",
                                  onClick: () => setIsCartDrawerOpen(true),
                                });
                                setSelectedProduct(null);
                                setChatState("GENERAL");

                                const cartTotal = orderCart.reduce(
                                  (sum, item) => sum + item.price * item.qty,
                                  0,
                                );
                                const hasDrink = orderCart.some(
                                  (item) =>
                                    item.name.toLowerCase().includes("drink") ||
                                    item.name.toLowerCase().includes("water"),
                                );
                                let comboMsg = "";
                                if (cartTotal > 1000 && !hasDrink) {
                                  comboMsg =
                                    currentLanguage === "english"
                                      ? "\n\n💡 Combo Deal: Your order is over Rs. 1000! Would you like to add a Cold Drink?"
                                      : "\n\n💡 Combo Deal: Aapka bill Rs. 1000 se zyada hai! Cold Drink add karein?";
                                }

                                addBotMessage(
                                  currentLanguage === "english"
                                    ? `${productQty}x ${selectedProduct.name} (${productSize}) added to cart! 🛒${comboMsg}`
                                    : `${productQty}x ${selectedProduct.name} (${productSize}) cart mein add ho gaye! 🛒${comboMsg}`,
                                  currentLanguage === "english"
                                    ? comboMsg
                                      ? ["Cold Drink 350ml", "Menu", "Checkout"]
                                      : ["Menu", "Checkout"]
                                    : comboMsg
                                      ? ["Cold Drink 350ml", "Menu", "Checkout"]
                                      : ["Menu", "Checkout"],
                                );
                              }}
                              className="flex-1 py-4 bg-surface-hover border border-border text-content text-sm font-bold tracking-wide rounded-2xl hover:bg-surface transition-all"
                            >
                              Add to Cart • Rs.{" "}
                              {Math.round(
                                selectedProduct.price *
                                  (productSize === "Small"
                                    ? 0.8
                                    : productSize === "Large"
                                      ? 1.3
                                      : 1) *
                                  productQty,
                              )}
                            </button>

                            <button
                              onClick={() => {
                                const sizeMultiplier =
                                  productSize === "Small"
                                    ? 0.8
                                    : productSize === "Large"
                                      ? 1.3
                                      : 1;
                                const finalPrice = Math.round(
                                  selectedProduct.price * sizeMultiplier,
                                );
                                orderCart.push({
                                  name: `${selectedProduct.name} (${productSize})`,
                                  price: finalPrice,
                                  qty: productQty,
                                });
                                setCartTick((t) => t + 1);
                                showToast("Item added to cart", {
                                  label: "View Cart",
                                  onClick: () => setIsCartDrawerOpen(true),
                                });
                                setSelectedProduct(null);
                                handleSend("Checkout");
                              }}
                              className="flex-1 py-4 bg-primary text-[#0F172A] dark:text-white text-sm font-black tracking-wide rounded-2xl shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                              Proceed to Checkout
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
            {showShortcuts && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
              >
                <div className="w-full max-w-sm bg-surface flex flex-col p-8 rounded-[2rem] shadow-2xl border border-white/10 relative">
                  <button
                    onClick={() => setShowShortcuts(false)}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                  >
                    <XCircle size={24} />
                  </button>
                  <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Sparkles size={20} className="text-primary" /> App
                    Shortcuts
                  </h2>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                      <span className="text-zinc-300 font-medium whitespace-nowrap">
                        Close Modals
                      </span>
                      <div className="flex gap-1">
                        <kbd className="bg-white/10 px-2 py-1 rounded text-xs font-mono text-zinc-300">
                          Esc
                        </kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                      <span className="text-zinc-300 font-medium whitespace-nowrap">
                        New Form / Reset
                      </span>
                      <div className="flex gap-1">
                        <kbd className="bg-white/10 px-2 py-1 rounded text-xs font-mono text-zinc-300">
                          Ctrl
                        </kbd>
                        <span className="text-white">+</span>
                        <kbd className="bg-white/10 px-2 py-1 rounded text-xs font-mono text-zinc-300">
                          N
                        </kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                      <span className="text-zinc-300 font-medium whitespace-nowrap">
                        Shortcuts
                      </span>
                      <div className="flex gap-1">
                        <kbd className="bg-white/10 px-2 py-1 rounded text-xs font-mono text-zinc-300">
                          Ctrl
                        </kbd>
                        <span className="text-white">+</span>
                        <kbd className="bg-white/10 px-2 py-1 rounded text-xs font-mono text-zinc-300">
                          /
                        </kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100000] bg-surface border border-border shadow-2xl rounded-full px-4 py-3 flex items-center gap-4 min-w-max"
          >
            <span className="text-content font-semibold text-sm">
              {toastMessage.message}
            </span>
            {toastMessage.action && (
              <button
                onClick={() => {
                  toastMessage.action?.onClick();
                  setToastMessage(null);
                }}
                className="bg-primary/20 hover:bg-primary/30 text-primary text-xs font-black px-3 py-1.5 rounded-full transition-colors uppercase tracking-wider"
              >
                {toastMessage.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setIsWidgetOpen(!isWidgetOpen)}
        className={`fixed bottom-6 right-6 z-[90] w-16 h-16 bg-primary text-[#0F172A] dark:text-white rounded-full flex flex-col items-center justify-center shadow-2xl hover:scale-105 transition-transform border-4 border-white/10 dark:border-white/5 ${isWidgetOpen ? "hidden md:flex" : "flex"}`}
      >
        {isWidgetOpen ? (
          <XCircle size={28} />
        ) : (
          <motion.div
            initial={{ y: -5 }}
            animate={{ y: 5 }}
            transition={{
              repeat: Infinity,
              repeatType: "reverse",
              duration: 1.5,
            }}
          >
            <MessageSquarePlus size={28} />
          </motion.div>
        )}
      </button>
    </div>
  );
}
