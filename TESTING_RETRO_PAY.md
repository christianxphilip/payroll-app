# Retro Pay Test Environment

This workflow uses a separate MongoDB database named `espro_payroll_test`. The backend refuses to start in test mode unless the selected database name ends in `_test`.

## Seed the fixture

```bash
cd backend
cp .env.test.example .env.test
npm run seed:retro-test
```

The seed copies the historical source records without modifying them:

- Source timesheet: `6aa8adf642130104c230c30e`
- Source paid payrun: `6aa8fe088771c59291a83e6f`
- Test draft payrun: printed by the seed command

## Run locally

Start the test backend:

```bash
cd backend
npm run start:test
```

Start the frontend in a second terminal:

```bash
cd frontend
cp .env.test.example .env.test
npm run dev:test
```

Sign in with the admin credentials configured in `backend/.env.test`, open the seeded draft payrun, and use **Prior pay** on an employee row. Adjustments can only be added or removed while the destination payrun is `DRAFT`.

## Expected behavior

- Prior-period OT requires approved OT hours, work date, approver, approval date, and reason.
- Attendance corrections can record corrected punches, break minutes, regular/OT/night hours, holiday type, source references, and approval details.
- Historical hourly rates are read from the source payrun when provided.
- The same source time log cannot have two active adjustments of the same type.
- An adjustment updates gross and net earnings immediately and appears as a separate payslip row.
- Paying the destination payrun locks the adjustment as `PAID`; deleting a draft detaches it for a future payrun.
