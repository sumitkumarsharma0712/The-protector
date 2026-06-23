const twilio = require('twilio');

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_TOKEN;
const fromNumber = process.env.TWILIO_FROM;

let client = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

const sendOtp = (phoneNumber, otp) => {
  if (!client) return Promise.reject(new Error('Twilio not configured'));
  return client.messages.create({ body: `Your otp is ${otp}`, from: fromNumber, to: phoneNumber });
};

module.exports = sendOtp;