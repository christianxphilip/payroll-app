import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import holidayRoutes from './routes/holidayRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import timesheetEntryRoutes from './routes/timesheetEntryRoutes.js';
import timesheetRoutes from './routes/timesheetRoutes.js';
import payRunRoutes from './routes/payRunRoutes.js';
import payRunPayslipRoutes from './routes/payRunPayslipRoutes.js';
import allowanceDeductionRoutes from './routes/allowanceDeductionRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import operatingHoursRoutes from './routes/operatingHoursRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import shiftAllocationRoutes from './routes/shiftAllocationRoutes.js';
import employeePortalRoutes from './routes/employeePortalRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((error) => console.error('❌ MongoDB connection error:', error));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Payroll Timesheet System API', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/timesheet-entries', timesheetEntryRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/pay-runs', payRunRoutes);
app.use('/api', payRunPayslipRoutes);
app.use('/api', allowanceDeductionRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/operating-hours', operatingHoursRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/shift-allocations', shiftAllocationRoutes);
app.use('/api/employee-portal', employeePortalRoutes);

// Error Handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

