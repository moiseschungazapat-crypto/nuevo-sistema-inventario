# Template contract for Informe de Formación Práctica 2

## Reference

- Source: `C:\Users\HP\Downloads\CNIU-108 INFORME FPE (1).docx`
- SHA-256: `ef37bce166d7d8da93137745ad11479f63e64d4030f7627c8ad1650c99a95ff1`
- Reference render: `C:\nuevo-sistema-inventario\tmp\informe2\template-reference-render`
- Package inventory: `C:\nuevo-sistema-inventario\tmp\informe2\package-inventory.json`
- Page count: 13
- Section count: 2

## Page system

- Both sections use A4 portrait, 8.27 x 11.69 inches.
- Margins in both sections: left 0.98 in, right 0.79 in, top 0.98 in, bottom 0.98 in.
- Each section starts on a new page.
- Section 1 header is not linked to a previous section; its footer is linked.
- Section 2 header and footer are independent.
- No odd/even or first-page variants are enabled.

## Typography and recurring components

- The template uses Calibri for most content and Arial in selected labels.
- Cover title: 26 pt, centered, bold through Heading 5.
- Identity fields: 12 pt Normal paragraphs with existing line/border furniture.
- Main report headings: 14 pt or 12 pt, centered and bold through the existing paragraph formatting.
- Body/report prompts: 11 pt Normal paragraphs with existing bottom-border writing lines.
- Tables retain their existing borders, gray header cells, row heights, column widths, alignment, and pagination.
- Repeated SENATI logo/header images and all floating shapes remain unchanged.
- The final intellectual-property page remains unchanged.

## Table system

- Table 0: rotation table, 17 rows x 4 columns. Only row 3 is an editable rotation record.
- Table 1: PEA, 160 rows x 7 columns. Only rows 2-17 receive the 16 previously supplied PEA operations and progress marks; rows 18-159 remain unchanged and blank.
- Tables 2 and 3: weekly work records, each 8 rows x 3 columns. Rows 1-6 receive date, activity, and hours; row 7 receives the weekly total.
- Table 4: diagram placeholder, 2 rows x 1 column. Only row 1 receives a diagram image.
- Table 5: instructor evaluation, monitor observations, and signatures. This remains blank because it must be completed by the corresponding people.

## Editable slot map

- `word/document.xml` body paragraph 29: append report code `02`.
- Text boxes containing `DIRECCIÓN ZONAL____________________________`: replace only the underscore text with `LIMA - CALLAO`, preserving both compatibility copies.
- Body paragraphs 50, 53, 56, 59, 62, and 66: fill school, student, ID/block, program, instructor, semester, and reporting period.
- Table 0 row 3: fill company/area, start date, end date, and two weeks.
- Table 1 rows 2-17: fill the 16 PEA descriptions. Preserve first-repetition evidence from report 1 and mark the second repetition only for PEA operations 08 and 14.
- Tables 2 and 3 rows 1-6 and totals: fill two six-day work weeks at four hours per day.
- Body paragraph 125: fill the significant task and its relation to PEA operations 08 and 14.
- Body paragraphs 127-144: fill the ordered process, one concise step per available ruled paragraph.
- Body paragraphs 146-147: fill tools and materials.
- Body paragraph 148 plus the next available ruled paragraph: fill safety and information-security controls.
- Body paragraphs 149-151: fill results and recommendations.
- Table 4 row 1: add the authentication and transactional-inventory flow diagram, centered inside the existing placeholder.

## Content flow

1. Cover and report number.
2. Student and reporting-period identification.
3. Official unchanged instructions.
4. Rotation record.
5. Cumulative PEA control.
6. Two weekly activity records.
7. Significant task and execution process.
8. Tools, safety, results, and recommendations.
9. Technical flow diagram and blank evaluation/signatures.
10. Unchanged SENATI intellectual-property page.

## Package preservation

- Preserve all `customXml`, styles, numbering, headers, footers, settings, theme, font table, footnotes, endnotes, and existing relationships.
- Expected editable package parts are `word/document.xml`, `word/_rels/document.xml.rels`, `[Content_Types].xml`, one added PNG under `word/media`, and document properties changed by the save operation.
- Existing media `image1.png`, `image2.png`, and `hdphoto1.wdp` must remain present and unchanged.
- The retained source must remain byte-for-byte unchanged.

## Fidelity gates

- Final output remains 13 A4 portrait pages.
- Cover, instructions, unused PEA continuation pages, evaluation/signature area, and final SENATI page retain their original geometry and visual treatment.
- No text is clipped, overlapped, or reduced below a readable size.
- The diagram fits entirely inside the existing page-12 placeholder.
- Every page must be visually inspected from a Word-produced PDF render.
