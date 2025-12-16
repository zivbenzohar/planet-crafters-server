require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const soloSocket = require('./src/sockets/soloSocket');
const coopSocket = require('./src/sockets/coopSocket');

const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// ✅ add these
app.use("/", require("./routes/index"));
app.use("/api/auth", require("./routes/api/auth"));
app.use("/api/users", require("./routes/api/users"));
app.use("/api/stages", require("./routes/api/stageState"));


app.get('/ping', (req, res) => {
  res.json({ message: 'pong from main server' });
});

app.get("/", (req, res) => {
  res.send("Hello from main server!");
});

// מעבירים את io לשני מודולי המשחק
soloSocket(io);
coopSocket(io);

connectDB();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server on ${PORT}`);
});
