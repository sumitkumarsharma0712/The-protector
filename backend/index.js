require('dotenv').config();
const fs = require('fs');
const path = require('path');
let express= require('express')  //npm i express
  let mongoose=     require('mongoose')  //npm i mongoose
mongoose.set('bufferCommands', false);
  const mysql = require('mysql2/promise') //npm i mysql2
   const sendOtp = require('./twilioService'); //npm i twilio
const Otp = require('./model/otp'); 
let User=    require('./user')         
let bcrypt=    require('bcrypt')       //npm i bcrypt
let jwt=    require('jsonwebtoken')   //npm i jsonwebtoken
  const crypto = require('crypto');  //npm i crypto
  const cors = require('cors');     //npm i cors

 let {sendEmail} = require('./sendEmail')
  mongoose.connect("mongodb://127.0.0.1:27017/MindGuardian").
 then(async ()=>{
  console.log("db connected to MindGuardian");
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log("Seeding default users...");
      const hashedPassword = await bcrypt.hash("Health123", 10);
      const defaultUsers = [
        { userName: "Khushi", email: "student@college.edu", passWord: hashedPassword, role: "student" },
        { userName: "Sneha M.", email: "counsellor@college.edu", passWord: hashedPassword, role: "counsellor" },
        { userName: "Admin Officer", email: "admin@college.edu", passWord: hashedPassword, role: "admin" },
        { userName: "Corporate Partner", email: "employer@college.edu", passWord: hashedPassword, role: "employer" }
      ];
      await User.insertMany(defaultUsers);
      console.log("Default users seeded!");
    }
  } catch (err) {
    console.error("Error seeding database:", err);
  }
 }).catch(err => {
  console.log("MongoDB connection failed, running in test mode");
 });
 
 // Initialize MySQL (creates DB and users table if missing)
 async function initMySQL() {
    // PHQ-9 follow-up endpoint: receives score and optionally triggers referral/email/SOS
   try {
     const host = process.env.MYSQL_HOST || '127.0.0.1';
     const user = process.env.MYSQL_USER || 'root';
     const password = process.env.MYSQL_PASSWORD || '';
     const connection = await mysql.createConnection({ host, user, password });
     await connection.query("CREATE DATABASE IF NOT EXISTS MindGuardianSQL DEFAULT CHARACTER SET utf8mb4");
     await connection.query("USE MindGuardianSQL");
     await connection.query(`CREATE TABLE IF NOT EXISTS users_sql (
       id INT AUTO_INCREMENT PRIMARY KEY,
       userName VARCHAR(255),
       email VARCHAR(255) UNIQUE,
       passWord VARCHAR(255),
       role VARCHAR(50),
       resetToken VARCHAR(255),
       resetTokenExpiry BIGINT,
       createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`);
     await connection.end();
     console.log('MySQL: MindGuardianSQL database and users_sql table ready');
   } catch (err) {
     console.error('MySQL initialization failed:', err.message || err);
   }
 }

 initMySQL();
    
  let app=     express()    
  app.use(express.json())   
    // Serve frontend index with runtime injection of the Google Maps API key
  app.use(cors())          //npm i cors



  let memoryUsers = [];

  //Signup Page  API
   app.post('/signup',  async(req,res)=>{
          let {userName,email,passWord,role}=   req.body
      console.log(userName,email ,"Done");
    // Serve static assets (images, scripts, styles)
      
      if (mongoose.connection.readyState !== 1) {
          console.log("MongoDB offline - running signup in mock/in-memory mode");
          const existing = memoryUsers.find(u => u.email === email);
          if (existing) {
              return res.status(400).send("User Found");
          }
          memoryUsers.push({ userName, email, passWord, role: role || 'student' });
          return res.send("Account Successfully Created");
      }
      
     let user=     await  User.findOne({email})
     console.log(user,"Done");
     
     if(user){
        return res.status(400).send("User Found");
     }
          let updatedP=     await  bcrypt.hash(passWord,10)
          console.log(updatedP,"Done");
          
         let userData=   new  User({
             userName,
             email,
             passWord:updatedP,
             role:role||'student'
          })
               await userData.save()
               res.send("Account Successfully Created")
             ;
             
 })


//Otp Verification API
//  app.post('/send-otp', async (req, res) => {
//   const { phoneNumber } = req.body;
//   console.log(phoneNumber,"hey");
//   const otp = Math.floor(100000 + Math.random() * 900000).toString();
//   const expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 1 minute

//   try {
    
//     await sendOtp(phoneNumber, otp);
//     const newOtp = new Otp({
//       phoneNumber,
//       otp,
//      //expiresAt: expiresAt.toString()
//         expiresAt: expiresAt

//     });
//     await newOtp.save();

//     res.status(200).send({ message: 'OTP sent successfully' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ error: 'Failed to send OTP' });
//   }
// });

app.post('/send-otp', async (req, res) => {
  const { phoneNumber } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 1 minute

  try {
    await sendOtp(phoneNumber, otp);

    await new Otp({
      phoneNumber,
      otp,
      expiresAt  // << FIXED
    }).save();

    res.status(200).send({ message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Failed to send OTP' });
  }
});

app.post('/verify', async (req, res) => {
  const { otp } = req.body;

  try {

   // const otpRecord =       await Otp.findOne({ otp });
const otpRecord = await Otp.findOne({ otp }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).send({ error: 'Invalid OTP' });
    }

    const currentTime = new Date();
    if (currentTime > otpRecord.expiresAt) {
      return res.status(400).send({ error: 'OTP has expired' });
    }


    res.status(200).send({ message: 'OTP verified successfully' });


    await Otp.deleteOne({ _id: otpRecord._id });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: 'Failed to verify OTP' });
  }
});



  // Test Login API (no database required)
  app.post("/login",async(req,res)=>{
    let {email,passWord}=   req.body
    console.log("Login attempt email:", email, "password:", passWord);
    
    if (mongoose.connection.readyState !== 1) {
      console.log("MongoDB offline - running login in fallback/mock mode");
      
      // Check in-memory database first
      let memUser = memoryUsers.find(u => u.email === email);
      if (memUser && memUser.passWord === passWord) {
          let token = jwt.sign({ email: memUser.email, role: memUser.role }, "z");
          return res.send({ message: "Login Successful", token, role: memUser.role });
      }

      const fallbacks = {
        "student@college.edu": { role: "student", pass: "password123" },
        "counsellor@college.edu": { role: "counsellor", pass: "password123" },
        "admin@college.edu": { role: "admin", pass: "password123" },
        "employer@college.edu": { role: "employer", pass: "password123" },
        "royalking2513@gmail.com": { role: "employer", pass: "Sumit0712" }
      };
      if (fallbacks[email] && passWord === fallbacks[email].pass) {
        let token = jwt.sign({ email, role: fallbacks[email].role }, "z");
        return res.send({ message: "Login Successful", token, role: fallbacks[email].role });
      }
      return res.status(401).send({ message: "Invalid credentials" });
    }
    try {
      let user = await User.findOne({ email });
      if (!user) {
        // Fallback for default student credentials
        if(email === "student@college.edu" && passWord === "password123") {
          let token = jwt.sign({ email: email, role: "student" }, "z");
          return res.send({ message: "Login Successful", token, role: "student" });
        }
        return res.status(401).send({ message: "Invalid credentials" });
      }
      
      let match = await bcrypt.compare(passWord, user.passWord);
      if (!match) {
        return res.status(401).send({ message: "Invalid credentials" });
      }
      
      let token = jwt.sign({ email: user.email, role: user.role }, "z");
      res.send({ message: "Login Successful", token, role: user.role });
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Server error" });
    }
 })

 // Test Appointment API (no database required)
  app.post("/api/appointment", async (req, res) => {
    const { email, date, doctor } = req.body;
    console.log('Appointment request:', { email, date, doctor });
    
    // Simulate saving appointment (in real app, this would update database)
    res.json({ status: 'saved' });
  });

 //Role Based Access System
 function checkRole(role,role1){
   return (req,res,next)=>{
      let token = req.headers.authorization;
      if (!token) {
         return res.send('Unauthorizeddd User');
     }else{
     // let deCodedToken = jwt.verify(token,  "JHBFIUWBFIUWB");
         let deCodedToken = jwt.verify(token, "z");

      if (role!==deCodedToken.role ) {
         return res.send('Access denied')
     }
     else {
         next();
     }

     }

   }
 }



  //Forgot Password  API
 app.post('/forgot-password', async (req, res) => {
   const { email } = req.body;
   if (mongoose.connection.readyState !== 1) {
     return res.status(200).send('Password reset email sent (Test Mode)');
   }
   try {
     const user = await User.findOne({ email });
     if (!user) {
       return res.status(404).send('User not found');
     }
 
   
     const resetToken = crypto.randomBytes(20).toString('hex');
     user.resetToken = resetToken;
     user.resetTokenExpiry = Date.now() + 3600000; //token expire in 6 min
     await user.save();
 
 
    
    let resetUrl=`http://localhost:5173/reset/${resetToken}`
     await sendEmail(
       user.email,
       'Password Reset Request',
       `Click the link below to reset your password:\n\n${resetUrl}`
     );
 
     res.status(200).send('Password reset email sent');
   } catch (error) {
     res.status(500).send('Error sending password reset email: ' + error.message);
   }
 });



  
 // Reset Password  API
 app.post('/reset-password/:token', async (req, res) => {
   const { token } = req.params;
   const { newPassword } = req.body;
   if (mongoose.connection.readyState !== 1) {
     return res.status(200).send('Password reset successfully (Test Mode)');
   }
 
   try {
     const user = await User.findOne({
       resetToken: token,
       resetTokenExpiry: { $gt: Date.now() }, 
     });
 
     if (!user) {
       return res.status(400).send('Invalid or expired token');
     }
     const hashedPassword = await bcrypt.hash(newPassword, 10);
     user.passWord = hashedPassword;
     user.resetToken = undefined;
     user.resetTokenExpiry = undefined;
     await user.save();
 
     res.status(200).send('Password reset successfully');
   } catch (error) {
     res.status(500).send('Error resetting password: ' + error.message);
   }
 });
 


 //Role Based API
  app.get('/public',(req,res)=>{
   res.send("Access  Granted")

  })
  
  app.get('/private', checkRole('admin') , (req,res)=>{
   res.send(" ADMIN ACESS GRANTED") //User Not Found AND

  })
  // PHQ-9 follow-up endpoint: receives score and optionally triggers referral/email/SOS
  app.post('/phq-result', async (req, res) => {
    const { email, score, severity, details, phone } = req.body;
    console.log('PHQ result received', { email, score, severity });
    try {
      const adminEmail = process.env.SOS_EMAIL_TO;
      if (adminEmail && (severity === 'Severe' || severity === 'Moderately severe')) {
        await sendEmail(adminEmail, `PHQ Alert: ${email} (${score})`, `User ${email} scored ${score} (${severity}).\n\nDetails:\n${details || '—'}`);
        console.log('Alert email sent to', adminEmail);
      }

      if (phone && process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
        try {
          await sendOtp(phone, `ALERT: PHQ score ${score} (${severity}) — please seek help.`);
          console.log('SMS alert sent to', phone);
        } catch (smsErr) {
          console.error('Failed to send SMS alert', smsErr.message || smsErr);
        }
      }

      res.send({ status: 'ok' });
    } catch (err) {
      console.error(err);
      res.status(500).send({ status: 'error' });
    }
  });

  // Serve frontend index with runtime injection of the Google Maps API key
  const frontendDir = path.join(__dirname, '..', 'frontend');
  app.get('/', (req, res) => {
    const indexPath = path.join(frontendDir, 'index.html');
    fs.readFile(indexPath, 'utf8', (err, data) => {
      if (err) return res.status(500).send('Error loading frontend');
      const injected = data.replace('YOUR_GOOGLE_MAPS_API_KEY', process.env.GOOGLE_MAPS_API_KEY || '');
      res.send(injected);
    });
  });

  // Serve static assets (images, scripts, styles)
  app.use(express.static(frontendDir));

  //Server Creation
  app.listen(4000,()=>{
   console.log("server running on port no 4000");
   
  })






