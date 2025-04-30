const speakeasy = require('speakeasy');
const nodemailer = require('nodemailer');

//Using the speakeasy library to generate OTPs
// OTP generator function
function generateOTP() {
    const otp = speakeasy.totp({
        secret: 'doctorWannaSync',  // Use a secure key in production
        encoding: 'base32',
        step: 300,  // OTP validity period in seconds
    });
    return otp;
}

//generate an unique secret key for each user
function generateSecret(){
    return speakeasy.generateSecret({ length: 20 }).base32;
}

// Using the nodemailer library to send OTPs via email
// Email sender function
async function sendOTPEmail(email, otp) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',  // Adjust this according to your email service
        auth: {
            user: 'connect.doctorsync@gmail.com',
            pass: 'svfg jzes dvcc kuox'
        }
    });

    try {
        let info = await transporter.sendMail({
            from: '"OTP Service" <connect.doctorsync@gmail.com>',
            to: email,
            subject: 'Your OTP Code',
            text: `Your OTP code is: ${otp}. It will expire in 5 minutes.`,
            html: `<p>Your OTP code is: <strong>${otp}</strong>. It will expire in 5 minutes.</p>`
        });
        console.log('Message sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }

}

// OTP verification function
function verifyOTP(token, secret) {
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 1, // 1 step window (5 minutes)
        step: 300
    });
}

module.exports = {
    generateOTP,
    sendOTPEmail,
    verifyOTP,
    generateSecret
};