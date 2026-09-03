package com.suplr.backend.service;

import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.suplr.backend.config.Constants;
import com.suplr.backend.entity.Invoice;
import com.suplr.backend.entity.Order;
import com.suplr.backend.entity.OrderItem;
import com.suplr.backend.entity.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;

@Slf4j
@Service
public class PdfService {


    @Value("${app.lbp-rate:90000}")
    private int lbpRate;

    public byte[] renderInvoicePdf(Invoice invoice, Order order, Supplier supplier) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        try (PdfWriter writer = new PdfWriter(baos);
             PdfDocument pdf = new PdfDocument(writer);
             Document doc = new Document(pdf)) {

            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont normal = PdfFontFactory.createFont(StandardFonts.HELVETICA);

            Table header = new Table(UnitValue.createPercentArray(new float[]{60, 40}))
                    .useAllAvailableWidth()
                    .setBackgroundColor(Constants.C_DARK)
                    .setPadding(20);

            header.addCell(cell(supplier.getName(), bold, 17, ColorConstants.WHITE)
                    .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
            header.addCell(cell("INVOICE", bold, 22, ColorConstants.WHITE)
                    .setTextAlignment(TextAlignment.RIGHT)
                    .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));

            String contact = supplier.getEmail() != null ? supplier.getEmail() : "";
            if (supplier.getPhone() != null) contact += "  ·  " + supplier.getPhone();
            if (!contact.isBlank()) {
                header.addCell(cell(contact, normal, 8, Constants.C_MUTED)
                        .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
            }

            header.addCell(cell(invoice.getNumber(), bold, 11, Constants.C_ACCENT)
                    .setTextAlignment(TextAlignment.RIGHT)
                    .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
            doc.add(header);

            doc.add(new Table(1).useAllAvailableWidth()
                    .setBackgroundColor(Constants.C_ACCENT)
                    .setHeight(4)
                    .addCell(new Cell().setBorder(com.itextpdf.layout.borders.Border.NO_BORDER)));

            String clientName = order.getClient() != null ? order.getClient().getName() : "";
            String clientPhone = order.getClient() != null
                    ? order.getClient().getWhatsappNumber()
                    .replaceAll("@(s\\.whatsapp\\.net|lid)$", "")
                    : "";
            String issued = invoice.getIssuedAt().format(Constants.DATE_FMT);

            Table meta = new Table(UnitValue.createPercentArray(new float[]{48, 4, 48}))
                    .useAllAvailableWidth()
                    .setMarginTop(16);

            Cell billTo = new Cell()
                    .setBackgroundColor(Constants.C_LIGHT)
                    .setPadding(12)
                    .setBorderLeft(new SolidBorder(Constants.C_ACCENT, 3))
                    .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER)
                    .add(new Paragraph("BILL TO").setFont(bold).setFontSize(7).setFontColor(Constants.C_MUTED))
                    .add(new Paragraph(clientName).setFont(bold).setFontSize(12).setFontColor(Constants.C_NAVY))
                    .add(new Paragraph(clientPhone).setFont(normal).setFontSize(9).setFontColor(Constants.C_MUTED));
            meta.addCell(billTo);
            meta.addCell(new Cell().setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));

            Cell metaCard = new Cell()
                    .setBackgroundColor(Constants.C_LIGHT)
                    .setPadding(12)
                    .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER)
                    .setTextAlignment(TextAlignment.RIGHT)
                    .add(new Paragraph("INVOICE DATE").setFont(bold).setFontSize(7).setFontColor(Constants.C_MUTED))
                    .add(new Paragraph(issued).setFont(normal).setFontSize(9).setFontColor(Constants.C_NAVY))
                    .add(new Paragraph("ORDER REFERENCE").setFont(bold).setFontSize(7).setFontColor(Constants.C_MUTED).setMarginTop(8))
                    .add(new Paragraph("#" + order.getId()).setFont(normal).setFontSize(9).setFontColor(Constants.C_NAVY));
            meta.addCell(metaCard);
            doc.add(meta);

            Table items = new Table(UnitValue.createPercentArray(new float[]{46, 16, 20, 18}))
                    .useAllAvailableWidth()
                    .setMarginTop(20);

            for (String h : new String[]{"Description", "Qty", "Unit Price", "Amount"}) {
                items.addHeaderCell(new Cell()
                        .setBackgroundColor(Constants.C_DARK)
                        .add(new Paragraph(h).setFont(bold).setFontSize(8).setFontColor(ColorConstants.WHITE))
                        .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
            }

            boolean alt = false;
            for (OrderItem item : order.getItems()) {
                BigDecimal lineTotal = item.getPrice().multiply(item.getQuantity())
                        .setScale(2, RoundingMode.HALF_UP);
                DeviceRgb rowBg = alt ? Constants.C_LIGHT : null;
                alt = !alt;

                addItemCell(items, item.getProductName(), normal, Constants.C_NAVY, rowBg, TextAlignment.LEFT);
                addItemCell(items,
                        item.getQuantity().stripTrailingZeros().toPlainString() + " " + item.getUnit(),
                        normal, Constants.C_MUTED, rowBg, TextAlignment.CENTER);
                addItemCell(items,
                        String.format("%.2f %s", item.getPrice(), invoice.getCurrency()),
                        normal, Constants.C_NAVY, rowBg, TextAlignment.RIGHT);
                addItemCell(items,
                        String.format("%.2f", lineTotal),
                        bold, Constants.C_NAVY, rowBg, TextAlignment.RIGHT);
            }

            items.addCell(new Cell(1, 3)
                    .setBackgroundColor(Constants.C_DARK)
                    .setTextAlignment(TextAlignment.RIGHT)
                    .setPadding(10)
                    .add(new Paragraph("Total").setFont(bold).setFontSize(11).setFontColor(ColorConstants.WHITE))
                    .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
            items.addCell(new Cell()
                    .setBackgroundColor(Constants.C_DARK)
                    .setTextAlignment(TextAlignment.RIGHT)
                    .setPadding(10)
                    .add(new Paragraph(String.format("%.2f %s", invoice.getTotal(), invoice.getCurrency()))
                            .setFont(bold).setFontSize(11).setFontColor(ColorConstants.WHITE))
                    .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));

            doc.add(items);

            if ("USD".equals(invoice.getCurrency())) {
                long lbpAmt = invoice.getTotal().longValue() * lbpRate;
                doc.add(new Paragraph(String.format("≈ %,d LBP", lbpAmt))
                        .setFont(normal).setFontSize(8).setFontColor(Constants.C_MUTED)
                        .setTextAlignment(TextAlignment.RIGHT));
            }

            if (order.getNotes() != null && !order.getNotes().isBlank()) {
                Table notesTable = new Table(1).useAllAvailableWidth()
                        .setBackgroundColor(Constants.C_LIGHT)
                        .setMarginTop(16);
                notesTable.addCell(new Cell()
                        .setBorder(new SolidBorder(Constants.C_BORDER, 0.5f))
                        .setPadding(12)
                        .add(new Paragraph("SPECIAL INSTRUCTIONS").setFont(bold).setFontSize(7).setFontColor(Constants.C_MUTED))
                        .add(new Paragraph(order.getNotes().strip()).setFont(normal).setFontSize(9).setFontColor(Constants.C_NAVY)));
                doc.add(notesTable);
            }

            boolean isPaid = invoice.getPaidAt() != null;
            DeviceRgb badgeBg = isPaid ? Constants.C_PAID_BG : Constants.C_DUE_BG;
            DeviceRgb badgeFg = isPaid ? Constants.C_PAID_FG : Constants.C_DUE_FG;
            String badgeTxt = isPaid ? "PAID IN FULL" : "PAYMENT OUTSTANDING";

            Table footer = new Table(UnitValue.createPercentArray(new float[]{30, 70}))
                    .useAllAvailableWidth()
                    .setMarginTop(24)
                    .setBorder(new SolidBorder(Constants.C_BORDER, 0.5f));
            footer.addCell(new Cell()
                    .setBackgroundColor(badgeBg)
                    .setPadding(12)
                    .setTextAlignment(TextAlignment.CENTER)
                    .add(new Paragraph(badgeTxt).setFont(bold).setFontSize(9).setFontColor(badgeFg))
                    .setBorderRight(new SolidBorder(Constants.C_BORDER, 0.5f))
                    .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
            footer.addCell(new Cell()
                    .setPadding(12)
                    .setTextAlignment(TextAlignment.RIGHT)
                    .add(new Paragraph("Thank you for your business, " + clientName + "!")
                            .setFont(normal).setFontSize(9).setFontColor(Constants.C_MUTED))
                    .add(new Paragraph("Generated with Suplr")
                            .setFont(normal).setFontSize(7).setFontColor(Constants.C_MUTED))
                    .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER));
            doc.add(footer);

        } catch (IOException e) {
            log.error("PDF generation failed for invoice {}: {}", invoice.getNumber(), e.getMessage());
            throw new RuntimeException("PDF generation failed", e);
        }

        return baos.toByteArray();
    }

    private static DeviceRgb rgb(int r, int g, int b) {
        return new DeviceRgb(r, g, b);
    }

    private static Cell cell(String text, PdfFont font, float size, com.itextpdf.kernel.colors.Color color) {
        return new Cell().add(new Paragraph(text).setFont(font).setFontSize(size).setFontColor(color))
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER);
    }

    private static void addItemCell(Table table, String text, PdfFont font,
                                    DeviceRgb color, DeviceRgb bg, TextAlignment align) {
        Cell c = new Cell()
                .add(new Paragraph(text).setFont(font).setFontSize((float) 9).setFontColor(color))
                .setTextAlignment(align)
                .setPadding(8)
                .setBorderBottom(new SolidBorder(Constants.C_BORDER, 0.4f))
                .setBorderLeft(com.itextpdf.layout.borders.Border.NO_BORDER)
                .setBorderRight(com.itextpdf.layout.borders.Border.NO_BORDER)
                .setBorderTop(com.itextpdf.layout.borders.Border.NO_BORDER);
        if (bg != null) c.setBackgroundColor(bg);
        table.addCell(c);
    }
}
