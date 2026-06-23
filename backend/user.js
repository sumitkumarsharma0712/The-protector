let mongoose=     require('mongoose')
 let userSchema=   mongoose.Schema({
    userName:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true

    },passWord:{
        type:String,

    },
    role:{
        type:String,
        enum:['admin','patient','doctor','student','counsellor','employer'],
        default:'student'
    },
    resetToken: String,
  resetTokenExpiry: Date,
})

let User=  mongoose.model('user',userSchema)
module.exports=User