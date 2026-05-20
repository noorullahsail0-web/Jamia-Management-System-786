# Project Guidelines

## UI & Design
- **Report Card Layout**: The report card in `/src/pages/Results.tsx` (element with ID `#report-card-print`) is precisely sized (15.5cm x 21.5cm) for PDF generation.
- **Styling Preservation**: Do NOT modify the margins, padding, font sizes, or alignment of the report card elements without explicit request. These have been carefully adjusted to ensure proper Urdu Nastaleeq rendering and centering within the fixed-size container.
- **Top Alignment**: Many table cells and header elements use `align-top` and specific `pt-*` padding for vertical centering of Urdu text. Preserve these as standard `align-middle` often breaks for Urdu fonts in this layout.
- **Signatures**: The signature section at the bottom uses `flex items-end` and `border-b-2` for signature lines. Ensure they remain horizontally aligned and properly spaced.

- **Dakhal-Kharij Layout**: The "Dakhil Kharij" register in `/src/pages/DakhilKharij.tsx` (elements with class `.print-page`) is designed for A4 landscape printing (297mm x 210mm).
- **Table Constraints**: The table uses `table-fixed` with precise column widths (in percentages) and small font sizes (9px to 13px) to fit all 11 columns on a single page. Do NOT increase these font sizes or change column widths without explicit request, as it will break the layout.
- **Print Logic**: The header and certain styling are managed via the `print-header-active` class and `@media print` CSS. Ensure any modifications to the header or table structure are tested for both PDF generation and browser printing.

- **Collective Result Sheet Layout**: The collective results sheet in `/src/pages/Results.tsx` (element with ref `collectiveRef`) is designed for A4 landscape printing (`297mm x 210mm`).
- **Marginal Spacing**: The sheet container uses `pt-4 pb-12 px-10` to optimize the vertical space and leave maximum area at the bottom for signatures.
- **Printed Date Alignment**: The printed date text container uses `relative -top-[3px]` and `font-mono` to align perfectly horizontal with the Urdu label "تاریخ طباعت".
- **Table Row Spacing**:
  - The first row (the table header row `thead tr`) uses taller padding (`py-3 px-2`) and `text-sm` bold / black text to make column labels highly readable.
  - The student data rows (`tbody tr`) use condensed cell padding (`py-1.5 px-2`), `text-xs` (or `text-sm` for total marks, `text-base` for student name) to allow fitting more data on a single page.
- **Signature Styling**: Signatures at the bottom should use `font-nastaleeq` and maintain horizontal alignment with bottom-bordered lines.

- **Attendance Register Layout (حاضری رجسٹر)**: The monthly attendance register in `/src/pages/Attendance.tsx` (element with ID `#print-area`) matches a clean, flat, black-and-white printed register style.
- **Flat Header**: It utilizes a single aligned horizontal borderless row for "سیکشن", "درجہ", "حاضری رجسٹر جامعہ تعلیم القرآن ناگمان" (centered), "ماہ", and code (e.g. `DN2026-05`). No colored background pills or modern emerald cards are permitted.
- **Table Solid Borders**: The grid table uses solid black borders (`border-black`) on all cells with a white background. No emerald colors or colored backgrounds are permitted.
- **Signatures**: The bottom signature blocks are exactly "دستخط مہتمم", "مہر جامعہ", and "دستخط ناظم", formatted with bottom-bordered horizontal helper lines (`border-b-2 border-black`).

