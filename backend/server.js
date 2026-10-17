require("dotenv").config();
const app = require("./index");
const { query } = require("./src/config/db");

const PORT = process.env.PORT || 5000;

query("SELECT 1")
  .then(() => console.log("Database connected"))
  .catch((err) => console.log("Database NOT connected:", err.message));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));