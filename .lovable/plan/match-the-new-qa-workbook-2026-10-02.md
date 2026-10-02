# Match the new QA workbook

## Changes
- Update QA upload to locate the worksheet containing the actual QA export instead of always reading the workbook's first worksheet.
- Match the uploaded `JUN QA` headers, including `Gerente.1` and `NOTA SUC`, while keeping the existing QA database fields.
- Reject a workbook clearly when no worksheet has the required QA columns.
- Verify the uploaded June workbook maps valid QA rows and preserves the selected date-range replacement behavior.

## Technical details
- Extend the spreadsheet reader with required-header worksheet selection, used only by QA so other uploads keep their current behavior.
- Keep all QA reads and writes behind the existing authenticated administration functions; no database policy changes are needed.
