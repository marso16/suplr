package com.suplr.backend.config;

import com.itextpdf.kernel.colors.DeviceRgb;

import java.time.Duration;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class Constants {

    public static final ExecutorService EXECUTOR =
            Executors.newCachedThreadPool();

    public static final DateTimeFormatter CSV_DATE_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneOffset.UTC);

    public static final Duration TTL_WEBHOOK = Duration.ofHours(24);
    public static final Duration TTL_REPORT = Duration.ofMinutes(2);

    public static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("MMMM dd, yyyy");

    public static final List<String> SETTLED = List.of("confirmed", "fulfilled", "invoiced");
    public static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("MMM yyyy");
    public static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("MMM dd");

    public static final Set<String> INVOICEABLE_STATUSES = Set.of("confirmed", "fulfilled");

    public static final DateTimeFormatter CSV_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    public static final Set<String> YES_WORDS = Set.of(
            "yes", "y", "oui", "si", "ok", "okay", "sure", "confirm",
            "نعم", "أكيد", "تمام", "ايه", "اه"
    );
    public static final Set<String> NO_WORDS = Set.of(
            "no", "n", "non", "cancel", "annuler", "لا", "إلغاء", "نو"
    );

    public static final Set<String> HISTORY_PHRASES = Set.of(
            "history", "last order", "last time", "previous order", "my orders",
            "order history", "past order", "recent order", "what did i order",
            "what have i ordered", "show my orders",
            "historique", "dernière commande", "la dernière fois", "mes commandes",
            "commandes précédentes", "mes dernières commandes",
            "طلبياتي", "آخر طلبية", "ماذا طلبت", "تاريخ طلبياتي",
            "طلبياتي السابقة", "ما طلبته", "الطلبية السابقة", "طلباتي"
    );

    public static final Set<String> SKIP_WORDS = Set.of(
            "skip", "no", "none", "-", "n/a", "لا", "non", "passer", "aucun"
    );

    public static final Map<String, Map<String, String>> MSG = Map.of(
            "en", Map.ofEntries(
                    Map.entry("welcome", "Welcome! Before we get started, could you please tell us your name?\nBienvenue ! Quel est votre nom ?\nأهلاً! ما اسمك؟"),
                    Map.entry("ask_email", "Got it, {name}! Do you have an email address? Reply with it or type *skip*."),
                    Map.entry("email_saved", "Perfect! Your email has been saved. You can now send your order."),
                    Map.entry("email_skipped", "No problem! You can now send your order."),
                    Map.entry("name_saved", "Thank you, {name}! You can now send your order."),
                    Map.entry("summary_header", "Here's a summary of your order:\n"),
                    Map.entry("confirm_prompt", "\nReply *YES* to confirm or *NO* to cancel."),
                    Map.entry("total", "\nTotal: *{total} {currency}*"),
                    Map.entry("order_received", "Your order has been received. We'll be in touch shortly."),
                    Map.entry("order_cancelled", "Your order has been cancelled. Feel free to reach out if you'd like to place a new order."),
                    Map.entry("order_confirmed", "Your order #{order_id} has been confirmed. Thank you — we'll keep you updated."),
                    Map.entry("history_header", "Here are your recent orders:"),
                    Map.entry("history_empty", "You haven't placed any confirmed orders yet."),
                    Map.entry("history_order", "Order #{id} · {date}")
            ),
            "fr", Map.ofEntries(
                    Map.entry("welcome", "Welcome! Before we get started, could you please tell us your name?\nBienvenue ! Quel est votre nom ?\nأهلاً! ما اسمك؟"),
                    Map.entry("ask_email", "Compris, {name} ! Avez-vous une adresse email ? Répondez avec ou tapez *passer*."),
                    Map.entry("email_saved", "Parfait ! Votre email a été enregistré. Vous pouvez maintenant passer votre commande."),
                    Map.entry("email_skipped", "Pas de problème ! Vous pouvez maintenant passer votre commande."),
                    Map.entry("name_saved", "Merci, {name} ! Vous pouvez maintenant passer votre commande."),
                    Map.entry("summary_header", "Voici le récapitulatif de votre commande :\n"),
                    Map.entry("confirm_prompt", "\nRépondez *OUI* pour confirmer ou *NON* pour annuler."),
                    Map.entry("total", "\nTotal : *{total} {currency}*"),
                    Map.entry("order_received", "Votre commande a bien été reçue. Nous vous contacterons sous peu."),
                    Map.entry("order_cancelled", "Votre commande a été annulée. N'hésitez pas à nous contacter pour passer une nouvelle commande."),
                    Map.entry("order_confirmed", "Votre commande #{order_id} a été confirmée. Merci — nous vous tiendrons informé."),
                    Map.entry("history_header", "Voici vos commandes récentes :"),
                    Map.entry("history_empty", "Vous n'avez pas encore de commandes confirmées."),
                    Map.entry("history_order", "Commande #{id} · {date}")
            ),
            "ar", Map.ofEntries(
                    Map.entry("welcome", "Welcome! Before we get started, could you please tell us your name?\nBienvenue ! Quel est votre nom ?\nأهلاً! ما اسمك؟"),
                    Map.entry("ask_email", "حسناً، {name}! هل لديك بريد إلكتروني؟ أرسله أو اكتب *تخطي*."),
                    Map.entry("email_saved", "ممتاز! تم حفظ بريدك الإلكتروني. يمكنك الآن إرسال طلبيتك."),
                    Map.entry("email_skipped", "لا بأس! يمكنك الآن إرسال طلبيتك."),
                    Map.entry("name_saved", "شكراً، {name}! يمكنك الآن إرسال طلبيتك."),
                    Map.entry("summary_header", "إليك ملخص طلبيتك:\n"),
                    Map.entry("confirm_prompt", "\nأجب بـ *نعم* للتأكيد أو *لا* للإلغاء."),
                    Map.entry("total", "\nالمجموع: *{total} {currency}*"),
                    Map.entry("order_received", "تم استلام طلبيتك. سنتواصل معك قريباً."),
                    Map.entry("order_cancelled", "تم إلغاء طلبيتك. لا تتردد في التواصل معنا لتقديم طلبية جديدة."),
                    Map.entry("order_confirmed", "تم تأكيد طلبيتك رقم #{order_id}. شكراً لك — سنبقيك على اطلاع."),
                    Map.entry("history_header", "إليك طلبياتك الأخيرة:"),
                    Map.entry("history_empty", "لم تقم بأي طلبية مؤكدة بعد."),
                    Map.entry("history_order", "طلبية #{id} · {date}")
            )
    );

    public static final DeviceRgb C_DARK = rgb(0x0F, 0x17, 0x2A);
    public static final DeviceRgb C_ACCENT = rgb(0x10, 0xB9, 0x81);
    public static final DeviceRgb C_MUTED = rgb(0x64, 0x74, 0x8B);
    public static final DeviceRgb C_LIGHT = rgb(0xF8, 0xFA, 0xFC);
    public static final DeviceRgb C_BORDER = rgb(0xE2, 0xE8, 0xF0);
    public static final DeviceRgb C_NAVY = rgb(0x1E, 0x29, 0x3B);
    public static final DeviceRgb C_PAID_BG = rgb(0xDC, 0xFC, 0xE7);
    public static final DeviceRgb C_PAID_FG = rgb(0x16, 0x65, 0x34);
    public static final DeviceRgb C_DUE_BG = rgb(0xFE, 0xF3, 0xC7);
    public static final DeviceRgb C_DUE_FG = rgb(0x92, 0x40, 0x0E);

    private static DeviceRgb rgb(int r, int g, int b) {
        return new DeviceRgb(r, g, b);
    }
}