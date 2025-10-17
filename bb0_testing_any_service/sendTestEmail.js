import dotenv from "dotenv";
dotenv.config();

console.log("EMAIL_USER:", !!process.env.EMAIL_USER);
console.log("EMAIL_PASS:", !!process.env.EMAIL_PASS);
import nodemailer from "nodemailer";

(async () => {
  //   const t = nodemailer.createTransport({
  //     host: "smtp.gmail.com",
  //     port: 465,
  //     secure: true,
  //     auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  //   });
  const t1 = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "adhikariratxen@gmail.com", //process.env.EMAIL_USER,
      pass: "fkclmsoibzfhnzsw", //process.env.EMAIL_PASS,
    },
    debug: true,
    logger: true,
  });

  const t = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // SSL
    auth: {
      user: "adhikariratxen@gmail.com", //process.env.EMAIL_USER,
      pass: "fkclmsoibzfhnzsw", //process.env.EMAIL_PASS,
    },
    logger: true,
    debug: true,
  });

  try {
    await t.verify();
    console.log("SMTP OK");
    const r = await t.sendMail({
      from: "adhikariratxen@gmail.com",
      to: "kunalratxen@gmail.com",
      subject: "SMTP Test",
      text: "It works!",
    });
    console.log("Mail sent:", r.messageId);
  } catch (err) {
    console.error("Test failed:", err);
  }
})();
