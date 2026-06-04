require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const vsSocket = require('./src/sockets/vsSocket');

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

if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', require('./routes/debug.routes'));
}


app.get('/ping', (req, res) => {
  res.json({ message: 'pong from main server' });
});

vsSocket(io);

connectDB();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server on ${PORT}`);
});
