/********************************************************************
KABINI AGROGLOBAL
GLOBAL AGRICULTURE MARKETPLACE BACKEND
Enterprise Node.js Server
********************************************************************/

const express = require("express")
const mysql = require("mysql2/promise")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const cors = require("cors")
const multer = require("multer")
const path = require("path")

const app = express()

/********************************************************************
CONFIGURATION
********************************************************************/

const PORT = 5000
const JWT_SECRET = "KABINI_AGROGLOBAL_SECURE_KEY"

/********************************************************************
MIDDLEWARE
********************************************************************/

app.use(cors())
app.use(express.json())
app.use(express.static("public"))

/********************************************************************
FILE UPLOAD SYSTEM
********************************************************************/

const storage = multer.diskStorage({

destination: function (req, file, cb) {
cb(null, "uploads/")
},

filename: function (req, file, cb) {
cb(null, Date.now() + path.extname(file.originalname))
}

})

const upload = multer({ storage })

/********************************************************************
DATABASE CONNECTION
********************************************************************/

let db

async function connectDB(){

db = await mysql.createPool({

host:"localhost",
user:"root",
password:"",
database:"kabini_agroglobal",

waitForConnections:true,
connectionLimit:10

})

console.log("Database Connected")

}

connectDB()

/********************************************************************
AUTH MIDDLEWARE
********************************************************************/

function authenticate(req,res,next){

const token=req.headers.authorization

if(!token) return res.status(401).json({message:"Unauthorized"})

try{

const decoded=jwt.verify(token,JWT_SECRET)
req.user=decoded
next()

}catch(err){

res.status(403).json({message:"Invalid token"})

}

}

/********************************************************************
AUTH ROUTES
********************************************************************/

/* REGISTER */

app.post("/api/register",async(req,res)=>{

const {name,email,password,role}=req.body

const hash=await bcrypt.hash(password,10)

await db.query(

"INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",

[name,email,hash,role]

)

res.json({message:"User Registered"})

})

/* LOGIN */

app.post("/api/login",async(req,res)=>{

const {email,password}=req.body

const [rows]=await db.query(

"SELECT * FROM users WHERE email=?",[email]

)

if(rows.length===0){

return res.status(404).json({message:"User not found"})

}

const user=rows[0]

const valid=await bcrypt.compare(password,user.password)

if(!valid){

return res.status(401).json({message:"Invalid password"})

}

const token=jwt.sign(

{id:user.id,role:user.role},

JWT_SECRET,

{expiresIn:"7d"}

)

res.json({token,user})

})

/********************************************************************
PRODUCT MARKETPLACE
********************************************************************/

/* GET PRODUCTS */

app.get("/api/products",async(req,res)=>{

const [rows]=await db.query(

"SELECT * FROM products ORDER BY created_at DESC"

)

res.json(rows)

})

/* GET PRODUCT */

app.get("/api/products/:id",async(req,res)=>{

const [rows]=await db.query(

"SELECT * FROM products WHERE id=?",

[req.params.id]

)

res.json(rows[0])

})

/* CREATE PRODUCT */

app.post("/api/products",authenticate,upload.single("image"),async(req,res)=>{

const {name,price,description,category}=req.body

await db.query(

`INSERT INTO products(name,price,description,category,image)
VALUES(?,?,?,?,?)`,

[name,price,description,category,req.file.filename]

)

res.json({message:"Product Added"})

})

/********************************************************************
CART SYSTEM
********************************************************************/

/* ADD TO CART */

app.post("/api/cart/add",async(req,res)=>{

const {user_id,product_id,qty}=req.body

await db.query(

`INSERT INTO cart(user_id,product_id,qty)
VALUES(?,?,?)`,

[user_id,product_id,qty]

)

res.json({message:"Added to cart"})

})

/* GET CART */

app.get("/api/cart/:user",async(req,res)=>{

const [rows]=await db.query(

`SELECT cart.*,products.name,products.price
FROM cart
JOIN products ON cart.product_id=products.id
WHERE user_id=?`,

[req.params.user]

)

res.json(rows)

})

/********************************************************************
CHECKOUT SYSTEM
********************************************************************/

app.post("/api/checkout",async(req,res)=>{

const {user_id,total}=req.body

const [result]=await db.query(

`INSERT INTO orders(user_id,total,status)
VALUES(?,?,?)`,

[user_id,total,"pending"]

)

res.json({order_id:result.insertId})

})

/********************************************************************
PAYMENT SYSTEM
********************************************************************/

app.post("/api/pay",async(req,res)=>{

const {order_id,method,amount}=req.body

await db.query(

`INSERT INTO payments(order_id,method,amount,status)
VALUES(?,?,?,"completed")`,

[order_id,method,amount]

)

await db.query(

"UPDATE orders SET status='paid' WHERE id=?",

[order_id]

)

res.json({message:"Payment Successful"})

})

/********************************************************************
FLASH SALES
********************************************************************/

app.get("/api/flashsales",async(req,res)=>{

const [rows]=await db.query(

`SELECT products.*,flash_sales.discount
FROM flash_sales
JOIN products ON flash_sales.product_id=products.id
WHERE flash_sales.end_time > NOW()`

)

res.json(rows)

})

/********************************************************************
INVOICE SYSTEM
********************************************************************/

app.get("/api/invoice/:order",async(req,res)=>{

const [rows]=await db.query(

`SELECT orders.*,users.name
FROM orders
JOIN users ON orders.user_id=users.id
WHERE orders.id=?`,

[req.params.order]

)

res.json(rows[0])

})

/********************************************************************
RECEIPT SYSTEM
********************************************************************/

app.get("/api/receipt/:order",async(req,res)=>{

const [rows]=await db.query(

`SELECT payments.*,orders.total
FROM payments
JOIN orders ON payments.order_id=orders.id
WHERE payments.order_id=?`,

[req.params.order]

)

res.json(rows[0])

})

/********************************************************************
FARMER MARKETPLACE
********************************************************************/

app.post("/api/farmers/register",async(req,res)=>{

const {user_id,farm_name,location}=req.body

await db.query(

`INSERT INTO farmers(user_id,farm_name,location)
VALUES(?,?,?)`,

[user_id,farm_name,location]

)

res.json({message:"Farmer registered"})

})

app.get("/api/farmers",async(req,res)=>{

const [rows]=await db.query("SELECT * FROM farmers")

res.json(rows)

})

/********************************************************************
SHIPMENT TRACKING
********************************************************************/

app.get("/api/shipment/:tracking",async(req,res)=>{

const [rows]=await db.query(

"SELECT * FROM shipments WHERE tracking_number=?",

[req.params.tracking]

)

res.json(rows[0])

})

/********************************************************************
ADMIN DASHBOARD
********************************************************************/

app.get("/api/admin/metrics",async(req,res)=>{

const [[products]]=await db.query("SELECT COUNT(*) total FROM products")
const [[orders]]=await db.query("SELECT COUNT(*) total FROM orders")
const [[users]]=await db.query("SELECT COUNT(*) total FROM users")

res.json({

products:products.total,
orders:orders.total,
users:users.total

})

})

/********************************************************************
ANALYTICS
********************************************************************/

app.get("/api/admin/sales",async(req,res)=>{

const [rows]=await db.query(

`SELECT DATE(created_at) day,
SUM(total) revenue
FROM orders
GROUP BY day
ORDER BY day DESC`

)

res.json(rows)

})

/********************************************************************
SERVER HEALTH
********************************************************************/

app.get("/",(req,res)=>{

res.send("Kabini AgroGlobal Backend Running")

})

/********************************************************************
START SERVER
********************************************************************/

app.listen(PORT,()=>{

console.log("Kabini AgroGlobal Server running on port "+PORT)

})