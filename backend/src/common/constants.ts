export const INVOICEABLE_STATUSES = new Set(['confirmed', 'fulfilled']);
export const SETTLED = ['confirmed', 'fulfilled', 'invoiced'];

export const YES_WORDS = new Set([
  'yes','y','oui','si','ok','okay','sure','confirm',
  'نعم','أكيد','تمام','ايه','اه',
]);
export const NO_WORDS = new Set([
  'no','n','non','cancel','annuler','لا','إلغاء','نو',
]);
export const HISTORY_PHRASES = [
  'history','last order','last time','previous order','my orders',
  'order history','past order','recent order','what did i order',
  'what have i ordered','show my orders',
  'historique','dernière commande','la dernière fois','mes commandes',
  'طلبياتي','آخر طلبية','ماذا طلبت','تاريخ طلبياتي',
];
export const SKIP_WORDS = new Set(['skip','no','none','-','n/a','لا','non','passer','aucun']);

export const TTL_WEBHOOK_SECS = 86400;
export const TTL_REPORT_SECS = 120;

export const MSG: Record<string, Record<string, string>> = {
  en: {
    welcome: "Welcome! Before we get started, could you please tell us your name?\nBienvenue ! Quel est votre nom ?\nأهلاً! ما اسمك؟",
    ask_email: "Got it, {name}! Do you have an email address? Reply with it or type *skip*.",
    email_saved: "Perfect! Your email has been saved. You can now send your order.",
    email_skipped: "No problem! You can now send your order.",
    name_saved: "Thank you, {name}! You can now send your order.",
    summary_header: "Here's a summary of your order:\n",
    confirm_prompt: "\nReply *YES* to confirm or *NO* to cancel.",
    total: "\nTotal: *{total} {currency}*",
    order_received: "Your order has been received. We'll be in touch shortly.",
    order_cancelled: "Your order has been cancelled. Feel free to reach out if you'd like to place a new order.",
    order_confirmed: "Your order #{order_id} has been confirmed. Thank you — we'll keep you updated.",
    history_header: "Here are your recent orders:",
    history_empty: "You haven't placed any confirmed orders yet.",
    history_order: "Order #{id} · {date}",
  },
  fr: {
    welcome: "Welcome! Before we get started, could you please tell us your name?\nBienvenue ! Quel est votre nom ?\nأهلاً! ما اسمك؟",
    ask_email: "Compris, {name} ! Avez-vous une adresse email ? Répondez avec ou tapez *passer*.",
    email_saved: "Parfait ! Votre email a été enregistré. Vous pouvez maintenant passer votre commande.",
    email_skipped: "Pas de problème ! Vous pouvez maintenant passer votre commande.",
    name_saved: "Merci, {name} ! Vous pouvez maintenant passer votre commande.",
    summary_header: "Voici le récapitulatif de votre commande :\n",
    confirm_prompt: "\nRépondez *OUI* pour confirmer ou *NON* pour annuler.",
    total: "\nTotal : *{total} {currency}*",
    order_received: "Votre commande a bien été reçue. Nous vous contacterons sous peu.",
    order_cancelled: "Votre commande a été annulée. N'hésitez pas à nous contacter pour passer une nouvelle commande.",
    order_confirmed: "Votre commande #{order_id} a été confirmée. Merci — nous vous tiendrons informé.",
    history_header: "Voici vos commandes récentes :",
    history_empty: "Vous n'avez pas encore de commandes confirmées.",
    history_order: "Commande #{id} · {date}",
  },
  ar: {
    welcome: "Welcome! Before we get started, could you please tell us your name?\nBienvenue ! Quel est votre nom ?\nأهلاً! ما اسمك؟",
    ask_email: "حسناً، {name}! هل لديك بريد إلكتروني؟ أرسله أو اكتب *تخطي*.",
    email_saved: "ممتاز! تم حفظ بريدك الإلكتروني. يمكنك الآن إرسال طلبيتك.",
    email_skipped: "لا بأس! يمكنك الآن إرسال طلبيتك.",
    name_saved: "شكراً، {name}! يمكنك الآن إرسال طلبيتك.",
    summary_header: "إليك ملخص طلبيتك:\n",
    confirm_prompt: "\nأجب بـ *نعم* للتأكيد أو *لا* للإلغاء.",
    total: "\nالمجموع: *{total} {currency}*",
    order_received: "تم استلام طلبيتك. سنتواصل معك قريباً.",
    order_cancelled: "تم إلغاء طلبيتك. لا تتردد في التواصل معنا لتقديم طلبية جديدة.",
    order_confirmed: "تم تأكيد طلبيتك رقم #{order_id}. شكراً لك — سنبقيك على اطلاع.",
    history_header: "إليك طلبياتك الأخيرة:",
    history_empty: "لم تقم بأي طلبية مؤكدة بعد.",
    history_order: "طلبية #{id} · {date}",
  },
};

export function t(lang: string, key: string, vars?: Record<string, unknown>): string {
  const dict = MSG[lang] ?? MSG['en'];
  let str = dict[key] ?? MSG['en'][key] ?? '';
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}
