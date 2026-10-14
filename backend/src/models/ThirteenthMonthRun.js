import mongoose from 'mongoose';

const thirteenthMonthRunSchema = new mongoose.Schema({
  coverageStart: { type: Date, required: true, index: true },
  coverageEnd: { type: Date, required: true, index: true },
  actualCutoff: { type: Date, required: true },
  payoutDate: { type: Date, required: true },
  status: { type: String, enum: ['DRAFT', 'APPROVED', 'PAID'], default: 'DRAFT', index: true },
  paymentMethod: { type: String, enum: ['PAY_RUN', 'SEPARATE'], required: true },
  attachedPayRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayRun', default: null, index: true },
  createdBy: { type: String, trim: true },
  approvedAt: Date,
  paidAt: Date
}, { timestamps: true });

thirteenthMonthRunSchema.index({ coverageStart: 1, coverageEnd: 1 });

export default mongoose.model('ThirteenthMonthRun', thirteenthMonthRunSchema, 'payroll_app_13thmonthruns');
