import nodemailer from "nodemailer";
import { config } from "../config.js";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: config.emailUser,
    pass: config.emailPass,
  },
});

export const sendEmail = async (to, subject, text) => {
  await transporter.sendMail({
    from: config.emailUser,
    to,
    subject,
    text,
  });
};
