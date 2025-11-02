const mongoose = require('mongoose');

const uri = "mongodb+srv://praneethkumarn_db_user:jGywVpz7I7uGb5lQ@cluster0.5mtczee.mongodb.net/smart_hazard_db?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
  .then(() => console.log('✅ Connected to MongoDB Atlas!'))
  .catch(err => console.error('❌ Connection failed:', err));
