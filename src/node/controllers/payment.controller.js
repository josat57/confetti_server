import paymentService from '../services/payment.service.js';
import AppError from '../utils/AppError.js';

export const createPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.createPayment(req.body);
    res.status(201).json(payment);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const getPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    res.status(200).json(payment);
  } catch (error) {
    next(new AppError(error.message, 404));
  }
};

export const updatePayment = async (req, res, next) => {
  try {
    const payment = await paymentService.updatePayment(req.params.id, req.body);
    res.status(200).json(payment);
  } catch (error) {
    next(new AppError(error.message, 404));
  }
};

export const listPayments = async (req, res, next) => {
  try {
    const payments = await paymentService.listPayments(req.query);
    res.status(200).json(payments);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const convertToNGN = async (req, res, next) => {
  try {
    const { rate } = req.body;
    const payment = await paymentService.convertToNGN(req.params.id, rate);
    res.status(200).json(payment);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
}; 