package com.suplr.backend.service;

import com.suplr.backend.entity.Invoice;
import com.suplr.backend.entity.Order;
import com.suplr.backend.entity.OrderItem;
import com.suplr.backend.entity.Supplier;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.Properties;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    @Value("${app.email.smtp-host:smtp.gmail.com}")
    private String smtpHost;

    @Value("${app.email.smtp-port:587}")
    private int smtpPort;

    @Value("${app.email.smtp-user:}")
    private String smtpUser;

    @Value("${app.email.smtp-pass:}")
    private String smtpPass;

    @Value("${app.email.from:}")
    private String emailFrom;

    @Value("${app.lbp-rate:90000}")
    private int lbpRate;

    @Async
    public void sendInvoiceEmail(
            Invoice invoice,
            Order order,
            Supplier supplier,
            String toEmail,
            byte[] pdfBytes
    ) {
        if (!isConfigured()) {
            throw new IllegalStateException("SMTP_USER and SMTP_PASS are not configured");
        }

        try {
            Session session = buildSession();
            String fromAddr = emailFrom.isBlank() ? smtpUser : emailFrom;

            MimeMessage msg = new MimeMessage(session);
            msg.setFrom(new InternetAddress(fromAddr));
            msg.setRecipient(Message.RecipientType.TO, new InternetAddress(toEmail));
            msg.setSubject("Invoice " + invoice.getNumber() + " from " + supplier.getName());
            if (supplier.getEmail() != null) {
                msg.setHeader("Reply-To", supplier.getEmail());
            }

            MimeMultipart multipart = new MimeMultipart("mixed");

            // HTML part
            MimeBodyPart htmlPart = new MimeBodyPart();
            htmlPart.setContent(buildInvoiceHtml(invoice, order, supplier), "text/html; charset=utf-8");
            multipart.addBodyPart(htmlPart);

            // PDF attachment
            MimeBodyPart pdfPart = new MimeBodyPart();
            pdfPart.setContent(pdfBytes, "application/pdf");
            pdfPart.setFileName(invoice.getNumber() + ".pdf");
            pdfPart.setDisposition(MimeBodyPart.ATTACHMENT);
            multipart.addBodyPart(pdfPart);

            msg.setContent(multipart);
            Transport.send(msg, smtpUser, smtpPass);
            log.info("Invoice email sent: invoice={} to={}", invoice.getNumber(), toEmail);

        } catch (MessagingException e) {
            log.warn("Invoice email failed for {}: {}", toEmail, e.getMessage());
            throw new RuntimeException("Email delivery failed: " + e.getMessage(), e);
        }
    }

    @Async
    public void sendWelcomeEmail(String supplierName, String toEmail, String password) {
        if (!isConfigured()) {
            log.warn("Welcome email skipped — SMTP not configured");
            return;
        }
        try {
            Session session = buildSession();
            String fromAddr = emailFrom.isBlank() ? smtpUser : emailFrom;

            MimeMessage msg = new MimeMessage(session);
            msg.setFrom(new InternetAddress(fromAddr));
            msg.setRecipient(Message.RecipientType.TO, new InternetAddress(toEmail));
            msg.setSubject("Welcome to Suplr — your account is ready");

            MimeBodyPart htmlPart = new MimeBodyPart();
            htmlPart.setContent(
                    buildWelcomeHtml(supplierName, toEmail, password),
                    "text/html; charset=utf-8"
            );

            MimeMultipart multipart = new MimeMultipart("mixed");
            multipart.addBodyPart(htmlPart);
            msg.setContent(multipart);

            Transport.send(msg, smtpUser, smtpPass);
            log.info("Welcome email sent to {}", toEmail);

        } catch (MessagingException e) {
            log.warn("Welcome email failed for {}: {}", toEmail, e.getMessage());
        }
    }

    @Async
    public void sendBroadcastEmail(String toEmail, String subject, String message) {
        if (!isConfigured()) {
            log.warn("Broadcast email skipped — SMTP not configured");
            return;
        }
        try {
            Session session = buildSession();
            String fromAddr = emailFrom.isBlank() ? smtpUser : emailFrom;

            MimeMessage msg = new MimeMessage(session);
            msg.setFrom(new InternetAddress(fromAddr));
            msg.setRecipient(Message.RecipientType.TO, new InternetAddress(toEmail));
            msg.setSubject(subject);

            MimeBodyPart textPart = new MimeBodyPart();
            textPart.setText(message, "utf-8");

            MimeMultipart multipart = new MimeMultipart("mixed");
            multipart.addBodyPart(textPart);
            msg.setContent(multipart);

            Transport.send(msg, smtpUser, smtpPass);
            log.info("Broadcast email sent to {}", toEmail);
        } catch (MessagingException e) {
            log.warn("Broadcast email failed for {}: {}", toEmail, e.getMessage());
        }
    }

    private Session buildSession() {
        Properties props = new Properties();
        props.put("mail.smtp.host", smtpHost);
        props.put("mail.smtp.port", String.valueOf(smtpPort));
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        return Session.getInstance(props);
    }

    public boolean isConfigured() {
        return !smtpUser.isBlank() && !smtpPass.isBlank();
    }

    private String buildInvoiceHtml(Invoice invoice, Order order, Supplier supplier) {
        boolean isPaid = invoice.getPaidAt() != null;
        String statusBg = isPaid ? "#dcfce7" : "#fef3c7";
        String statusFg = isPaid ? "#166534" : "#92400E";
        String statusTxt = isPaid ? "PAID IN FULL" : "PAYMENT OUTSTANDING";

        String clientName = order.getClient() != null ? order.getClient().getName() : "";
        String clientPhone = order.getClient() != null
                ? order.getClient().getWhatsappNumber().replaceAll("@(s\\.whatsapp\\.net|lid)$", "")
                : "";
        String issued = invoice.getIssuedAt()
                .format(DateTimeFormatter.ofPattern("MMMM dd, yyyy"));

        StringBuilder rows = new StringBuilder();
        for (OrderItem item : order.getItems()) {
            BigDecimal lineTotal = item.getPrice().multiply(item.getQuantity())
                    .setScale(2, RoundingMode.HALF_UP);
            rows.append(String.format("""
                            <tr>
                              <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;">%s</td>
                              <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;text-align:center;">%s %s</td>
                              <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;text-align:right;font-family:monospace;">%.2f %s</td>
                              <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;text-align:right;font-family:monospace;font-weight:600;">%.2f</td>
                            </tr>""",
                    item.getProductName(),
                    item.getQuantity().stripTrailingZeros().toPlainString(), item.getUnit(),
                    item.getPrice(), invoice.getCurrency(),
                    lineTotal));
        }

        String lbpRow = "";
        if ("USD".equals(invoice.getCurrency())) {
            long lbpAmt = invoice.getTotal().longValue() * lbpRate;
            lbpRow = String.format(
                    "<tr><td colspan=\"4\" style=\"padding:4px 16px 12px;text-align:right;color:#94a3b8;font-size:12px;\">≈ %,d LBP</td></tr>",
                    lbpAmt);
        }

        String contactHtml = supplier.getEmail() != null ? supplier.getEmail() : "";
        if (supplier.getPhone() != null) contactHtml += "  ·  " + supplier.getPhone();
        String addressHtml = supplier.getAddress() != null
                ? "<br/><span style=\"color:#94a3b8;\">" + supplier.getAddress() + "</span>" : "";

        return """
                <!DOCTYPE html><html lang="en">
                <head><meta charset="UTF-8"/></head>
                <body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
                <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
                  <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%;">
                    <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:28px;">
                      <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">%s</p>%s
                      <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">%s</p>
                    </td></tr>
                    <tr><td style="background:#10b981;height:4px;"></td></tr>
                    <tr><td style="background:#fff;padding:24px 28px;">
                      <p style="margin:0 0 4px;font-size:10px;color:#94a3b8;">BILL TO</p>
                      <p style="margin:0;font-size:15px;font-weight:700;color:#1e293b;">%s</p>
                      <p style="margin:2px 0;font-size:13px;color:#64748b;">%s</p>
                      <p style="margin:12px 0 0;text-align:right;font-size:13px;color:#1e293b;">%s &nbsp;|&nbsp; Order #%d</p>
                    </td></tr>
                    <tr><td style="background:#fff;padding:0 28px;">
                      <table width="100%%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;">
                        <thead><tr style="background:#1e293b;">
                          <th style="padding:10px 16px;color:#fff;font-size:11px;text-align:left;">Description</th>
                          <th style="padding:10px 16px;color:#fff;font-size:11px;text-align:center;">Qty</th>
                          <th style="padding:10px 16px;color:#fff;font-size:11px;text-align:right;">Unit Price</th>
                          <th style="padding:10px 16px;color:#fff;font-size:11px;text-align:right;">Amount</th>
                        </tr></thead>
                        <tbody>%s
                          <tr style="background:#0f172a;">
                            <td colspan="3" style="padding:12px 16px;color:#fff;font-weight:600;text-align:right;">Total</td>
                            <td style="padding:12px 16px;color:#fff;font-weight:700;text-align:right;font-family:monospace;">%.2f %s</td>
                          </tr>%s
                        </tbody>
                      </table>
                    </td></tr>
                    <tr><td style="background:#fff;padding:24px 28px 28px;">
                      <table width="100%%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;">
                        <tr>
                          <td style="background:%s;padding:14px 20px;width:35%%;"><p style="margin:0;font-size:12px;font-weight:700;color:%s;text-align:center;">%s</p></td>
                          <td style="padding:14px 20px;text-align:right;"><p style="margin:0;font-size:13px;color:#64748b;">Thank you for your business, <strong>%s</strong>!</p></td>
                        </tr>
                      </table>
                    </td></tr>
                    <tr><td style="background:#0f172a;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;">
                      <p style="margin:0;font-size:11px;color:#475569;">Generated with <span style="color:#10b981;font-weight:600;">Suplr</span></p>
                    </td></tr>
                  </table>
                  </td></tr>
                </table>
                </body></html>
                """.formatted(
                supplier.getName(), addressHtml, contactHtml,
                clientName, clientPhone, issued, order.getId(),
                rows,
                invoice.getTotal(), invoice.getCurrency(), lbpRow,
                statusBg, statusFg, statusTxt, clientName
        );
    }

    private String buildWelcomeHtml(String supplierName, String email, String password) {
        return """
                <!DOCTYPE html><html lang="en">
                <head><meta charset="UTF-8"/></head>
                <body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
                <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
                  <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%;">
                    <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:32px;">
                      <p style="margin:0;font-size:28px;font-weight:800;color:#fff;">Suplr</p>
                      <p style="margin:6px 0 0;font-size:14px;color:#94a3b8;">Your B2B order management platform</p>
                    </td></tr>
                    <tr><td style="background:#10b981;height:4px;"></td></tr>
                    <tr><td style="background:#fff;padding:32px;">
                      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Welcome, %s! 👋</p>
                      <p style="margin:0 0 24px;font-size:15px;color:#475569;">Your Suplr account is ready. Use the credentials below to sign in.</p>
                      <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
                        <tr><td style="padding:20px 24px;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Email</p>
                          <p style="margin:0 0 16px;font-size:14px;color:#1e293b;font-family:monospace;">%s</p>
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Temporary Password</p>
                          <p style="margin:0;font-size:14px;color:#1e293b;font-family:monospace;">%s</p>
                        </td></tr>
                      </table>
                      <p style="margin:0;font-size:13px;color:#94a3b8;">Please change your password after first login in Settings → Security.</p>
                    </td></tr>
                    <tr><td style="background:#0f172a;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;">
                      <p style="margin:0;font-size:11px;color:#475569;">Generated with <span style="color:#10b981;font-weight:600;">Suplr</span></p>
                    </td></tr>
                  </table>
                  </td></tr>
                </table>
                </body></html>
                """.formatted(supplierName, email, password);
    }
}
