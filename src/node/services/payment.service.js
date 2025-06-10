import Payment from '../models/payment.model.js';
import AppError from '../utils/AppError.js';

class PaymentService {
  async createPayment(paymentData) {
    const payment = new Payment(paymentData);
    await payment.save();
    return payment;
  }

  async getPaymentById(id) {
    const payment = await Payment.findById(id);
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }
    return payment;
  }

  async updatePayment(id, updateData) {
    const payment = await Payment.findByIdAndUpdate(id, updateData, { new: true });
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }
    return payment;
  }

  async listPayments(filter = {}) {
    return await Payment.find(filter);
  }

  async convertToNGN(id, rate) {
    const payment = await this.getPaymentById(id);
    payment.convertToNGN(rate);
    await payment.save();
    return payment;
  }
}

export default new PaymentService(); 